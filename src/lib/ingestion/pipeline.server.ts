import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_CITY_ID } from "../scene-constants";
import { getAdapter } from "./adapters/registry.server";
import { AdapterDisabledError, type AdapterContext, type SourceRow } from "./adapters/types";
import { sha256Hex, slugify } from "./adapters/shared";
import { compareRecords, duplicateConfidenceFrom } from "./dedupe";
import { enrichRecord } from "./enrich.server";
import { completenessOf, computeQualityScore, nextRefreshAt, passesPublishGate, verificationStateFor } from "./quality";
import { isTransient } from "./safe-fetch.server";
import { crossSourceState, detectFieldConflicts, fieldValuesFrom, PROVENANCE_FIELDS, type FieldObservation } from "./provenance";
import { promoteValidatedCandidates, runDiscoveryResolver } from "./discovery.server";
import { hostOf, validateMumbaiVenue } from "./mumbai-geo";
import { scoreVenueCompleteness } from "./venue-profile";
import {
  DEFAULT_CADENCE,
  DEFAULT_GATE,
  DEFAULT_WEIGHTS,
  type NormalisedRecord,
  type QualityGate,
  type QualityWeights,
  type RefreshCadence,
  type VerificationState,
} from "./types";

type DB = SupabaseClient<Database>;

export interface JobCounters {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface Settings {
  weights: QualityWeights;
  gate: QualityGate;
  cadence: RefreshCadence;
}

const emptyCounters = (): JobCounters => ({ fetched: 0, created: 0, updated: 0, skipped: 0, failed: 0 });

export async function loadSettings(db: DB): Promise<Settings> {
  const { data } = await db.from("ingestion_settings").select("key,value");
  const map = new Map((data ?? []).map((r) => [r.key, r.value as Record<string, number>]));
  return {
    weights: { ...DEFAULT_WEIGHTS, ...(map.get("quality_weights") ?? {}) } as QualityWeights,
    gate: { ...DEFAULT_GATE, ...(map.get("quality_gate") ?? {}) } as QualityGate,
    cadence: { ...DEFAULT_CADENCE, ...(map.get("refresh_cadence") ?? {}) } as RefreshCadence,
  };
}

/** Ingestion funnel analytics reuse the existing interactions table. */
async function trackIngestion(db: DB, eventType: string, metadata: Record<string, unknown>) {
  await db.from("interactions").insert({ event_type: eventType, city_id: DEFAULT_CITY_ID, metadata: metadata as never });
}

async function startJob(db: DB, source: { id?: string | null; name: string } | null, jobType: string) {
  const { data } = await db
    .from("ingestion_jobs")
    .insert({ source_id: source?.id ?? null, source_name: source?.name ?? null, job_type: jobType, status: "running" })
    .select("id")
    .single();
  return data?.id ?? null;
}

async function finishJob(
  db: DB,
  jobId: string | null,
  counters: JobCounters,
  status: "success" | "partial" | "failed",
  errorSummary: string | null,
  details: Record<string, unknown> = {},
) {
  if (!jobId) return;
  await db
    .from("ingestion_jobs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      records_fetched: counters.fetched,
      records_created: counters.created,
      records_updated: counters.updated,
      records_skipped: counters.skipped,
      records_failed: counters.failed,
      error_summary: errorSummary,
      details: details as never,
    })
    .eq("id", jobId);
}

/** Fetch one source, store raw records idempotently (content hash), enrich and score them. */
export async function runSource(db: DB, source: SourceRow, settings: Settings): Promise<{ counters: JobCounters; status: "success" | "partial" | "failed"; error: string | null }> {
  const counters = emptyCounters();
  const logs: string[] = [];
  const ctx: AdapterContext = { source, now: new Date(), log: (m) => logs.push(m) };
  const jobId = await startJob(db, { id: source.id, name: source.name }, `ingest:${source.adapter_key}`);
  await trackIngestion(db, "source_fetch_started", { source: source.slug, adapter: source.adapter_key });

  const adapter = getAdapter(source.adapter_key);
  if (!adapter) {
    await finishJob(db, jobId, counters, "failed", `No adapter registered for "${source.adapter_key}"`);
    await trackIngestion(db, "source_fetch_failed", { source: source.slug, reason: "missing adapter" });
    return { counters, status: "failed", error: `No adapter registered for "${source.adapter_key}"` };
  }

  let items: Awaited<ReturnType<typeof adapter.fetch>> = [];
  try {
    items = await adapter.fetch(ctx);
    counters.fetched = items.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const disabled = error instanceof AdapterDisabledError;
    await finishJob(db, jobId, counters, disabled ? "partial" : "failed", message, { logs, transient: isTransient(error) });
    await db.from("ingestion_sources").update({ last_run_at: new Date().toISOString(), last_status: disabled ? "partial" : "failed", last_error: message, next_run_at: new Date(Date.now() + source.refresh_interval_minutes * 60000).toISOString() }).eq("id", source.id);
    await trackIngestion(db, "source_fetch_failed", { source: source.slug, reason: message.slice(0, 200) });
    return { counters, status: disabled ? "partial" : "failed", error: message };
  }

  for (const item of items) {
    try {
      const parsed = adapter.parse(item, ctx);
      if (!parsed) {
        counters.skipped += 1;
        await trackIngestion(db, "record_skipped", { source: source.slug, reason: "unparseable" });
        continue;
      }
      const normalisedBase = adapter.normalise(parsed, ctx);
      if (!normalisedBase || !normalisedBase.name) {
        counters.skipped += 1;
        continue;
      }
      const enrichment = await enrichRecord(normalisedBase);
      const normalised: NormalisedRecord = {
        ...normalisedBase,
        description: normalisedBase.description ?? enrichment.shortDescription,
        categoryHint: enrichment.categoryHint ?? normalisedBase.categoryHint,
        areaHint: enrichment.areaHint ?? normalisedBase.areaHint,
        moodTags: enrichment.moodTags.length ? enrichment.moodTags : normalisedBase.moodTags,
        occasionTags: enrichment.occasionTags,
        groupTags: enrichment.groupTags,
        keywords: enrichment.keywords,
      };

      const externalId = adapter.getExternalId(parsed, ctx);
      const sourceUrl = adapter.getSourceUrl(parsed, ctx);
      const lastModified = adapter.getLastModified(parsed, ctx);
      const contentHash = await sha256Hex(JSON.stringify(normalised));
      const nowIso = new Date().toISOString();

      const { data: existing } = await db
        .from("source_records")
        .select("id,content_hash,review_status,linked_entity_type,linked_entity_id")
        .eq("source_name", source.slug)
        .eq("external_id", externalId)
        .maybeSingle();

      const authority = source.authority_level;
      const duplicateConfidence = 1;
      // Events must carry a sourced start time; a venue/experience has no date to confirm,
      // so its core fact is an identified place (same rule the catalogue re-verifier uses).
      const coreConfirmed =
        normalised.kind === "event"
          ? normalised.confirmed.date
          : normalised.confirmed.venue || normalised.confirmed.location || !!normalised.address;
      const score = computeQualityScore(
        {
          authorityLevel: authority,
          ageHours: 0,
          dateConfirmed: coreConfirmed,
          priceConfirmed: normalised.confirmed.price,
          venueConfirmed: normalised.confirmed.venue,
          locationConfirmed: normalised.confirmed.location,
          duplicateConfidence,
          completeness: completenessOf(normalised),
        },
        settings.weights,
        settings.gate,
      );
      const state = verificationStateFor(score, { ageHours: 0, dateConfirmed: coreConfirmed, duplicateConfidence }, settings.gate);
      // Social signals and unclear classifications never auto-publish.
      const forceReview = source.source_type === "social_api" || source.source_type === "organiser_submission" || enrichment.needsReview;

      const row = {
        source_id: source.id,
        source_name: source.slug,
        source_type: source.source_type,
        source_url: sourceUrl,
        external_id: externalId,
        raw_payload: item.raw as never,
        normalised: normalised as never,
        content_hash: contentHash,
        source_last_modified_at: lastModified,
        last_seen_at: nowIso,
        last_checked_at: nowIso,
        fetch_status: "ok" as const,
        parse_status: (forceReview ? "needs_review" : "ok") as "ok" | "needs_review",
        source_confidence: Math.min(100, authority * 20),
        verification_status: state,
        quality_score: score,
        error_message: null,
      };

      if (!existing) {
        await db.from("source_records").insert({ ...row, review_status: forceReview ? "needs_review" : "new" });
        counters.created += 1;
        await trackIngestion(db, "record_created", { source: source.slug, external_id: externalId, score });
      } else if (existing.content_hash === contentHash) {
        await db.from("source_records").update({ last_seen_at: nowIso, last_checked_at: nowIso, verification_status: state, quality_score: score }).eq("id", existing.id);
        counters.skipped += 1;
        await trackIngestion(db, "record_skipped", { source: source.slug, reason: "unchanged" });
      } else {
        const keepDecision = existing.review_status === "rejected";
        await db
          .from("source_records")
          .update({ ...row, review_status: keepDecision ? "rejected" : existing.linked_entity_id ? "changed" : forceReview ? "needs_review" : "new" })
          .eq("id", existing.id);
        counters.updated += 1;
        await trackIngestion(db, "record_updated", { source: source.slug, external_id: externalId, score });
      }
    } catch (error) {
      counters.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      logs.push(message);
      await trackIngestion(db, "record_failed", { source: source.slug, reason: message.slice(0, 200) });
    }
  }

  const status = counters.failed > 0 ? "partial" : "success";
  await finishJob(db, jobId, counters, status, counters.failed ? `${counters.failed} record(s) failed` : null, { logs });
  // Official page lists are read in rotating batches: advance the cursor so the next run
  // continues where this one stopped.
  const patch: Record<string, unknown> = {
    last_run_at: new Date().toISOString(),
    last_status: status,
    last_error: counters.failed ? logs.slice(-1)[0] ?? null : null,
    next_run_at: new Date(Date.now() + source.refresh_interval_minutes * 60000).toISOString(),
  };
  if (source.adapter_key === "official_site") {
    const cfg = (source.config ?? {}) as Record<string, unknown>;
    const pages = Array.isArray(cfg["pages"]) ? (cfg["pages"] as unknown[]).length : 0;
    const perRun = Math.min(Math.max(Number(cfg["pages_per_run"] ?? 20) || 20, 1), 40);
    if (pages > perRun) {
      const cursor = (Number(cfg["page_cursor"] ?? 0) || 0) + perRun;
      patch["config"] = { ...cfg, page_cursor: cursor % pages };
    }
  }
  await db.from("ingestion_sources").update(patch as never).eq("id", source.id);
  await trackIngestion(db, "source_fetch_completed", { source: source.slug, ...counters });
  return { counters, status, error: null };
}

async function resolveArea(db: DB, cityId: string, hint: string | null): Promise<string | null> {
  if (!hint) return null;
  const slug = slugify(hint);
  const { data } = await db.from("areas").select("id,slug,name").eq("city_id", cityId);
  const match = (data ?? []).find((a) => a.slug === slug || slugify(a.name) === slug || slug.includes(a.slug));
  return match?.id ?? null;
}

/**
 * Link an event to a venue already in the catalogue.
 * Matches on the venue name the source states, or on the venue's own official domain when the
 * event was published on that same first-party site. Never creates a venue and never guesses:
 * an unmatched event simply stays unlinked.
 */
async function resolveVenue(
  db: DB,
  cityId: string,
  venueName: string | null,
  pageUrls: (string | null | undefined)[] = [],
): Promise<string | null> {
  const { data } = await db.from("venues").select("id,slug,name,website_url,source_url").eq("city_id", cityId).eq("is_active", true).limit(1000);
  const venues = data ?? [];

  const slug = venueName ? slugify(venueName) : "";
  if (slug) {
    const exact = venues.find((v) => v.slug === slug || slugify(v.name) === slug);
    if (exact) return exact.id;
    // A stated name that fully contains (or is contained by) a catalogue venue name is still
    // that venue, e.g. "antisocial-mumbai" vs "antisocial".
    const contained = venues.find((v) => {
      const vs = slugify(v.name);
      return vs.length >= 5 && (slug.startsWith(`${vs}-`) || slug.endsWith(`-${vs}`) || vs.startsWith(`${slug}-`) || vs.endsWith(`-${slug}`));
    });
    if (contained) return contained.id;
  }

  const hosts = new Set(pageUrls.map((u) => hostOf(u ?? null)).filter((h): h is string => Boolean(h)));
  if (hosts.size > 0) {
    const byDomain = venues.find((v) => {
      const vh = hostOf(v.website_url) ?? hostOf(v.source_url);
      return vh ? hosts.has(vh) : false;
    });
    if (byDomain) return byDomain.id;
  }
  return null;
}

async function resolveCategory(db: DB, hint: string | null): Promise<string | null> {
  if (!hint) return null;
  const slug = slugify(hint);
  const { data } = await db.from("categories").select("id,slug,name");
  const match = (data ?? []).find((c) => c.slug === slug || slugify(c.name) === slug);
  return match?.id ?? null;
}

async function uniqueSlug(db: DB, table: "venues" | "events" | "experiences", cityId: string, base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || "listing";
  for (let i = 0; i < 12; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { data } = await db.from(table).select("id").eq("city_id", cityId).eq("slug", candidate).maybeSingle();
    if (!data || data.id === ignoreId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * Turn approved / gate-passing source records into catalogue rows.
 * Idempotent: a source record maps to at most one catalogue row (unique source_record_id).
 */
export async function publishReadyRecords(db: DB, settings: Settings, limit = 50) {
  const counters = emptyCounters();
  const jobId = await startJob(db, null, "publish");
  const { data: records } = await db
    .from("source_records")
    .select("id,source_name,source_type,source_url,normalised,quality_score,verification_status,review_status,linked_entity_type,linked_entity_id,last_checked_at,source_confidence")
    .in("review_status", ["new", "approved", "changed"])
    .order("last_seen_at", { ascending: true })
    .limit(limit);

  for (const rec of records ?? []) {
    const normalised = rec.normalised as NormalisedRecord | null;
    if (!normalised?.name) {
      counters.skipped += 1;
      continue;
    }
    const state = rec.verification_status as VerificationState;
    const score = Number(rec.quality_score ?? 0);
    const approved = rec.review_status === "approved";
    const publish = approved || passesPublishGate(score, state, settings.gate);

    if (!publish && !rec.linked_entity_id) {
      // Not good enough to publish and not live yet: leave it in the review queue.
      if (rec.review_status === "new") await db.from("source_records").update({ review_status: "needs_review" }).eq("id", rec.id);
      counters.skipped += 1;
      continue;
    }

    const cityId = DEFAULT_CITY_ID;
    const areaId = await resolveArea(db, cityId, normalised.areaHint);
    const categoryId = await resolveCategory(db, normalised.categoryHint);
    const table = normalised.kind === "event" ? "events" : normalised.kind === "experience" ? "experiences" : "venues";
    const nowIso = new Date().toISOString();

    const shared = {
      city_id: cityId,
      area_id: areaId,
      category_id: categoryId,
      name: normalised.name,
      description: normalised.description,
      image_url: normalised.imageUrl,
      price_min: normalised.priceMin,
      price_max: normalised.priceMax,
      moods: normalised.moodTags,
      group_types: normalised.groupTags,
      tags: normalised.keywords,
      booking_url: normalised.bookingUrl,
      source_url: rec.source_url,
      source_name: rec.source_name,
      source_record_id: rec.id,
      source_last_checked_at: rec.last_checked_at,
      last_seen_at: nowIso,
      verification_status: state,
      quality_score: score,
      is_verified: state === "VERIFIED",
    };

    try {
      const existingId = rec.linked_entity_id;
      let entityId = existingId;
      if (table === "events") {
        const lifecycle = publish ? "ACTIVE" : "PENDING_REVIEW";
        const payload = {
          ...shared,
          venue_id: await resolveVenue(db, cityId, normalised.venueName, [rec.source_url, normalised.websiteUrl]),
          starts_at: normalised.startsAt,
          ends_at: normalised.endsAt,
          timezone: normalised.timezone,
          currency: normalised.currency,
          organiser: normalised.organiser,
          website_url: normalised.websiteUrl,
          age_min: normalised.ageMin,
          language: normalised.language,
          occasion_tags: normalised.occasionTags,
          lifecycle_status: lifecycle as Database["public"]["Enums"]["event_lifecycle"],
          next_refresh_at: nextRefreshAt("event", normalised.startsAt, new Date(), settings.cadence),
        };
        if (!normalised.startsAt) {
          // Never publish an event without a stored start time from the source.
          await db.from("source_records").update({ review_status: "needs_review", parse_status: "needs_review", error_message: "No start time in source payload" }).eq("id", rec.id);
          counters.skipped += 1;
          continue;
        }
        if (existingId) {
          await db.from("events").update({ ...payload, starts_at: normalised.startsAt }).eq("id", existingId);

          counters.updated += 1;
        } else {
          const slug = await uniqueSlug(db, "events", cityId, `${normalised.name}-${normalised.startsAt.slice(0, 10)}`);
          const { data, error } = await db.from("events").insert({ ...payload, slug, starts_at: normalised.startsAt }).select("id").single();
          if (error) throw error;
          entityId = data.id;
          counters.created += 1;
        }
      } else if (table === "experiences") {
        const payload = { ...shared, next_refresh_at: nextRefreshAt("experience", null, new Date(), settings.cadence), is_active: publish };
        if (existingId) {
          await db.from("experiences").update(payload).eq("id", existingId);
          counters.updated += 1;
        } else {
          const slug = await uniqueSlug(db, "experiences", cityId, normalised.name);
          const { data, error } = await db.from("experiences").insert({ ...payload, slug }).select("id").single();
          if (error) throw error;
          entityId = data.id;
          counters.created += 1;
        }
      } else {
        // A venue only joins the Mumbai catalogue when its own published address/coordinates
        // put it in the Mumbai region. Anything else is quarantined, never silently listed.
        const geo = validateMumbaiVenue({
          name: normalised.name,
          address: normalised.address,
          locality: normalised.venue?.locality ?? normalised.areaHint,
          lat: normalised.lat,
          lng: normalised.lng,
          websiteUrl: normalised.websiteUrl,
        });
        const quarantined = geo.status === "OUT_OF_REGION";
        const profile = venueProfileColumns(normalised);
        const base = {
          ...shared,
          ...profile,
          address: normalised.address,
          lat: normalised.lat,
          lng: normalised.lng,
          website_url: normalised.websiteUrl,
          next_refresh_at: nextRefreshAt("venue", null, new Date(), settings.cadence),
          geo_status: geo.status,
          geo_notes: geo.reasons.join("; ").slice(0, 400),
          quarantined_at: quarantined ? nowIso : null,
          quarantine_reason: quarantined ? geo.reasons.join("; ").slice(0, 300) : null,
          last_verified_at: quarantined ? null : rec.last_checked_at,
          verification_status: (quarantined ? "REVIEW_REQUIRED" : shared.verification_status) as VerificationState,
          is_verified: quarantined ? false : shared.is_verified,
          is_active: publish && !quarantined,
        };
        const completeness = scoreVenueCompleteness(base);
        const payload = { ...base, completeness_score: completeness.score, missing_fields: completeness.missing };
        if (quarantined) {
          await db
            .from("source_records")
            .update({ review_status: "needs_review", error_message: `Quarantined: ${geo.reasons.join("; ")}`.slice(0, 500) })
            .eq("id", rec.id);
          await trackIngestion(db, "venue_quarantined", { source: rec.source_name, reason: geo.reasons[0] ?? "outside Mumbai" });
        }
        if (existingId) {
          await db.from("venues").update(payload).eq("id", existingId);
          counters.updated += 1;
        } else {
          const slug = await uniqueSlug(db, "venues", cityId, normalised.name);
          const { data, error } = await db.from("venues").insert({ ...payload, slug }).select("id").single();
          if (error) throw error;
          entityId = data.id;
          counters.created += 1;
        }
      }

      await db
        .from("source_records")
        .update({
          review_status: publish ? "published" : "needs_review",
          linked_entity_type: normalised.kind,
          linked_entity_id: entityId,
        })
        .eq("id", rec.id);
      if (entityId) {
        await recordProvenance(
          db,
          normalised.kind,
          entityId,
          { id: rec.id, source_name: rec.source_name, source_type: rec.source_type, source_url: rec.source_url },
          normalised,
          Math.max(1, Math.round((rec.source_confidence ?? 40) / 20)),
        );
      }
      await trackIngestion(db, publish ? "record_published" : "record_updated", { source: rec.source_name, kind: normalised.kind, score });
    } catch (error) {
      counters.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await db.from("source_records").update({ error_message: message.slice(0, 500), review_status: "needs_review" }).eq("id", rec.id);
      await trackIngestion(db, "record_failed", { source: rec.source_name, reason: message.slice(0, 200) });
    }
  }

  await finishJob(db, jobId, counters, counters.failed ? "partial" : "success", null);
  return counters;
}

/**
 * Field-level provenance: store which source stated each individual fact, with its URL.
 * Only fields the source actually stated are written — silence is never recorded as a value.
 */
export async function recordProvenance(
  db: DB,
  entityType: "event" | "venue" | "experience",
  entityId: string,
  rec: { id: string; source_name: string | null; source_type: string | null; source_url: string | null },
  normalised: NormalisedRecord,
  authorityLevel: number,
) {
  const values = fieldValuesFrom(normalised);
  const observedAt = new Date().toISOString();
  const rows = PROVENANCE_FIELDS.filter((f) => values[f] !== null && values[f] !== undefined).map((field) => ({
    entity_type: entityType,
    entity_id: entityId,
    field,
    value_text: String(values[field]).slice(0, 500),
    source_record_id: rec.id,
    source_name: rec.source_name,
    source_type: (rec.source_type ?? null) as Database["public"]["Enums"]["ingestion_source_type"] | null,
    source_url: rec.source_url,
    authority_level: authorityLevel,
    confidence: Math.min(1, authorityLevel / 5),
    observed_at: observedAt,
  }));
  if (rows.length === 0) return;
  await db.from("field_provenance").upsert(rows as never, { onConflict: "entity_type,entity_id,field,source_name" });
}

/**
 * Cross-source verification: compare every source that stated each field, detect contradictions
 * and set the public verification state. Conflicts are queued for admin review — never auto-resolved,
 * and no source record is ever deleted or overwritten.
 */
export async function crossVerify(db: DB, settings: Settings, limit = 400) {
  const counters = emptyCounters();
  const jobId = await startJob(db, null, "cross-verify");
  const now = new Date();

  const { data: observations } = await db
    .from("field_provenance")
    .select("entity_type,entity_id,field,value_text,source_name,source_type,source_url,authority_level,source_record_id,observed_at")
    .order("observed_at", { ascending: false })
    .limit(5000);

  const byEntity = new Map<string, FieldObservation[]>();
  for (const o of observations ?? []) {
    const key = `${o.entity_type}:${o.entity_id}`;
    const list = byEntity.get(key) ?? [];
    list.push({
      field: o.field as FieldObservation["field"],
      value: o.value_text,
      sourceName: o.source_name ?? "unknown",
      sourceType: o.source_type ?? "official_site",
      sourceUrl: o.source_url,
      authorityLevel: o.authority_level ?? 2,
      sourceRecordId: o.source_record_id,
      observedAt: o.observed_at,
    });
    byEntity.set(key, list);
  }

  let processed = 0;
  for (const [key, obs] of byEntity) {
    if (processed >= limit) break;
    processed += 1;
    const [entityType, entityId] = key.split(":") as ["event" | "venue" | "experience", string];
    counters.fetched += 1;

    const newest = obs.reduce((max, o) => Math.max(max, new Date(o.observedAt).getTime()), 0);
    const ageHours = (now.getTime() - newest) / 3600000;
    const conflicts = detectFieldConflicts(obs);
    const verdict = crossSourceState({ observations: obs, conflicts, ageHours, staleAfterHours: settings.gate.stale_after_hours });

    // Open a review candidate per conflicting field; close ones the sources now agree on.
    const conflictFields = new Set(conflicts.map((c) => c.field));
    for (const conflict of conflicts) {
      const { data: existing } = await db
        .from("field_conflicts")
        .select("id,status")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("field", conflict.field)
        .maybeSingle();
      const row = { conflicting_values: conflict.values as never, status: "open", detected_at: new Date().toISOString() };
      if (existing) {
        if (existing.status === "open") await db.from("field_conflicts").update({ conflicting_values: conflict.values as never }).eq("id", existing.id);
        else await db.from("field_conflicts").update(row).eq("id", existing.id);
      } else {
        await db.from("field_conflicts").insert({ entity_type: entityType, entity_id: entityId, field: conflict.field, ...row });
        await trackIngestion(db, "source_conflict_detected", { entity_type: entityType, entity_id: entityId, field: conflict.field });
      }
    }
    const { data: openConflicts } = await db.from("field_conflicts").select("id,field").eq("entity_type", entityType).eq("entity_id", entityId).eq("status", "open");
    for (const open of openConflicts ?? []) {
      if (!conflictFields.has(open.field as FieldObservation["field"])) {
        await db.from("field_conflicts").update({ status: "resolved", resolved_at: new Date().toISOString(), resolution: "Sources now agree" }).eq("id", open.id);
      }
    }

    const table = entityType === "event" ? "events" : entityType === "experience" ? "experiences" : "venues";
    const { error } = await db
      .from(table)
      .update({ verification_status: verdict.state, is_verified: verdict.state === "VERIFIED" })
      .eq("id", entityId);
    if (error) counters.failed += 1;
    else counters.updated += 1;
    await trackIngestion(db, "record_cross_verified", {
      entity_type: entityType,
      entity_id: entityId,
      state: verdict.state,
      sources: verdict.distinctSources,
      conflicts: conflicts.length,
    });
  }

  await finishJob(db, jobId, counters, counters.failed ? "partial" : "success", null, { entities: processed });
  return counters;
}

/** Non-destructive duplicate detection: writes reviewable candidate pairs only. */
export async function scanDuplicates(db: DB, windowDays = 60) {
  const counters = emptyCounters();
  const jobId = await startJob(db, null, "deduplicate");
  const horizon = new Date(Date.now() + windowDays * 86400000).toISOString();
  const { data: events } = await db
    .from("events")
    .select("id,name,starts_at,venue_id,area_id,description,source_name,lifecycle_status")
    .gte("starts_at", new Date().toISOString())
    .lte("starts_at", horizon)
    .not("lifecycle_status", "in", '("CANCELLED","EXPIRED")')
    .limit(500);

  const rows = events ?? [];
  counters.fetched = rows.length;
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i]!;
      const b = rows[j]!;
      const verdict = compareRecords(
        { name: a.name, startsAt: a.starts_at, venueId: a.venue_id, areaId: a.area_id, description: a.description, sourceName: a.source_name },
        { name: b.name, startsAt: b.starts_at, venueId: b.venue_id, areaId: b.area_id, description: b.description, sourceName: b.source_name },
      );
      if (!verdict.isCandidate) continue;
      const [primary, candidate] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      const { data: existing } = await db
        .from("duplicate_candidates")
        .select("id,status")
        .eq("entity_type", "event")
        .eq("primary_id", primary)
        .eq("candidate_id", candidate)
        .maybeSingle();
      if (existing) {
        counters.skipped += 1;
        continue;
      }
      await db.from("duplicate_candidates").insert({
        entity_type: "event",
        primary_id: primary,
        candidate_id: candidate,
        match_score: verdict.score,
        signals: verdict.signals as never,
      });
      counters.created += 1;
      await trackIngestion(db, "dedupe_candidate_created", { score: verdict.score });
    }
  }
  await finishJob(db, jobId, counters, "success", null);
  return counters;
}

/** Recompute freshness / verification state and schedule the next refresh. */
export async function verifyCatalogue(db: DB, settings: Settings) {
  const counters = emptyCounters();
  const jobId = await startJob(db, null, "verify");
  const now = new Date();

  const { data: sources } = await db.from("ingestion_sources").select("slug,authority_level");
  const authorityBySource = new Map((sources ?? []).map((s) => [s.slug, s.authority_level]));

  const { data: openDupes } = await db.from("duplicate_candidates").select("primary_id,candidate_id").eq("status", "open");
  const dupeCount = new Map<string, number>();
  for (const d of openDupes ?? []) {
    dupeCount.set(d.primary_id, (dupeCount.get(d.primary_id) ?? 0) + 1);
    dupeCount.set(d.candidate_id, (dupeCount.get(d.candidate_id) ?? 0) + 1);
  }

  for (const table of ["events", "venues", "experiences"] as const) {
    const { data: rows } = await db
      .from(table)
      .select("id,name,description,image_url,price_min,booking_url,source_name,source_url,source_last_checked_at,updated_at,verification_status,area_id,category_id" + (table === "events" ? ",starts_at,venue_id,lifecycle_status" : ""))
      .limit(500);
    for (const row of (rows ?? []) as unknown as Record<string, unknown>[]) {
      const checkedAt = (row["source_last_checked_at"] as string | null) ?? (row["updated_at"] as string);
      const ageHours = (now.getTime() - new Date(checkedAt).getTime()) / 3600000;
      const dateConfirmed = table === "events" ? !!row["starts_at"] : true;
      const completeness =
        [!!row["name"], !!row["description"], !!row["image_url"], !!row["booking_url"], !!row["area_id"], !!row["category_id"]].filter(Boolean).length / 6;
      const duplicateConfidence = duplicateConfidenceFrom(dupeCount.get(row["id"] as string) ?? 0);
      const score = computeQualityScore(
        {
          authorityLevel: authorityBySource.get((row["source_name"] as string) ?? "") ?? 2,
          ageHours,
          dateConfirmed,
          priceConfirmed: row["price_min"] !== null && row["price_min"] !== undefined,
          venueConfirmed: table === "events" ? !!row["venue_id"] : true,
          locationConfirmed: !!row["area_id"],
          duplicateConfidence,
          completeness,
        },
        settings.weights,
        settings.gate,
      );
      const state = verificationStateFor(score, { ageHours, dateConfirmed, duplicateConfidence }, settings.gate);
      const refresh =
        table === "events"
          ? nextRefreshAt("event", (row["starts_at"] as string | null) ?? null, now, settings.cadence)
          : nextRefreshAt(table === "venues" ? "venue" : "experience", null, now, settings.cadence);
      await db
        .from(table)
        .update({ verification_status: state, quality_score: score, is_verified: state === "VERIFIED", next_refresh_at: refresh })
        .eq("id", row["id"] as string);
      counters.updated += 1;
      if (state === "VERIFIED") await trackIngestion(db, "record_verified", { table, id: row["id"], score });
    }
  }
  await finishJob(db, jobId, counters, "success", null);
  return counters;
}

/** Events past their end (or 6h past start when no end is stored) become EXPIRED. */
export async function expireEvents(db: DB) {
  const counters = emptyCounters();
  const jobId = await startJob(db, null, "expire");
  const now = new Date();
  const { data: rows } = await db
    .from("events")
    .select("id,starts_at,ends_at,lifecycle_status")
    .not("lifecycle_status", "in", '("EXPIRED","CANCELLED")')
    .lte("starts_at", now.toISOString())
    .limit(1000);
  for (const row of rows ?? []) {
    const end = row.ends_at ? new Date(row.ends_at).getTime() : new Date(row.starts_at).getTime() + 6 * 3600000;
    if (end > now.getTime()) {
      counters.skipped += 1;
      continue;
    }
    await db.from("events").update({ lifecycle_status: "EXPIRED" }).eq("id", row.id);
    counters.updated += 1;
    await trackIngestion(db, "record_expired", { id: row.id });
  }
  await finishJob(db, jobId, counters, "success", null);
  return counters;
}

export interface OrchestrateOptions {
  /** near = only sources whose next_run_at is due; full = every enabled source. */
  mode?: "near" | "full";
  sourceSlug?: string | null;
  maxSources?: number;
}

/** a-i: discover sources, fetch, store, normalise, dedupe, verify, publish, expire. */
export async function orchestrate(db: DB, options: OrchestrateOptions = {}) {
  const mode = options.mode ?? "near";
  const settings = await loadSettings(db);
  const jobId = await startJob(db, null, `orchestrate:${mode}`);
  const nowIso = new Date().toISOString();

  // Verified discoveries become authorised official-page sources before anything is fetched,
  // so newly validated venues are read in this same run.
  const promoted = options.sourceSlug ? null : await promoteValidatedCandidates(db, mode === "full" ? 120 : 30);

  let query = db.from("ingestion_sources").select("*").eq("enabled", true).neq("source_type", "discovery");
  if (options.sourceSlug) query = query.eq("slug", options.sourceSlug);
  else if (mode === "near") query = query.or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);
  const { data: sources } = await query.limit(options.maxSources ?? 10);

  const perSource: Record<string, JobCounters> = {};
  const totals = emptyCounters();
  for (const source of (sources ?? []) as unknown as SourceRow[]) {
    const result = await runSource(db, source, settings);
    perSource[source.slug] = result.counters;
    totals.fetched += result.counters.fetched;
    totals.created += result.counters.created;
    totals.updated += result.counters.updated;
    totals.skipped += result.counters.skipped;
    totals.failed += result.counters.failed;
  }

  // Full runs also re-check discovered candidates for their official / what's-on pages.
  const discovery = mode === "full" && !options.sourceSlug ? await runDiscoveryResolver(db, 40, 4) : null;
  const published = await publishReadyRecords(db, settings, mode === "full" ? 200 : 60);
  const dupes = await scanDuplicates(db);
  const verified = mode === "full" ? await verifyCatalogue(db, settings) : emptyCounters();
  const crossVerified = await crossVerify(db, settings);
  const expired = await expireEvents(db);

  await finishJob(db, jobId, totals, totals.failed ? "partial" : "success", null, {
    mode,
    sources: perSource,
    promoted,
    published,
    duplicate_candidates: dupes.created,
    verified: verified.updated,
    cross_verified: crossVerified.updated,
    discovery,
    expired: expired.updated,
  });

  return { mode, sources: perSource, promoted, totals, published, duplicates: dupes, verified, crossVerified, discovery, expired };
}

/**
 * Venue-profile columns from a normalised record.
 * Only fields the source actually stated are written, so a later run by a source that
 * stays silent about (say) opening hours never erases what another source published.
 */
export function venueProfileColumns(normalised: NormalisedRecord): Record<string, unknown> {
  const p = normalised.venue;
  if (!p) return {};
  const candidate: Record<string, unknown> = {
    phone: p.phone,
    email: p.email,
    contact_url: p.contactUrl,
    reservation_url: p.reservationUrl,
    booking_provider: p.bookingProvider,
    menu_url: p.menuUrl,
    events_url: p.eventsUrl,
    map_url: p.mapUrl,
    locality: p.locality ?? normalised.areaHint,
    social_urls: Object.keys(p.socialUrls).length ? p.socialUrls : null,
    opening_hours: p.openingHours,
    special_hours: p.specialHours,
    reservations_available: p.reservationsAvailable,
    cuisines: p.cuisines.length ? p.cuisines : null,
    dietary_options: p.dietaryOptions.length ? p.dietaryOptions : null,
    service_type: p.serviceType,
    amenities: p.amenities.length ? p.amenities : null,
    dress_code: p.dressCode,
    accessibility: p.accessibility,
    parking: p.parking,
    age_restriction: p.ageRestriction,
    pet_policy: p.petPolicy,
    price_band: p.priceBand,
    cover_charge: p.coverCharge,
    currency: normalised.currency,
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

export interface VenueAuditReport {
  checked: number;
  valid: number;
  unverified: number;
  quarantined: number;
  released: number;
  averageCompleteness: number;
  incomplete: number;
  rows: { id: string; name: string; geoStatus: string; completeness: number; missing: string[]; quarantineReason: string | null }[];
}

/**
 * Re-check every venue already in the catalogue: Mumbai geography, profile completeness and
 * freshness. Out-of-region venues are deactivated and stamped with a reason; their source
 * records and discovery evidence are left untouched so the decision stays auditable.
 */
export async function auditVenues(db: DB, limit = 500): Promise<VenueAuditReport> {
  const jobId = await startJob(db, null, "audit-venues");
  const counters = emptyCounters();
  const report: VenueAuditReport = {
    checked: 0, valid: 0, unverified: 0, quarantined: 0, released: 0, averageCompleteness: 0, incomplete: 0, rows: [],
  };
  const { data: venues } = await db
    .from("venues")
    .select(
      "id,name,slug,address,locality,lat,lng,website_url,source_url,phone,email,contact_url,opening_hours,reservation_url,booking_url,menu_url,price_min,price_max,price_band,description,category_id,service_type,cuisines,moods,tags,group_types,best_times,image_url,source_last_checked_at,verification_status,is_active,geo_status,quarantined_at",
    )
    .limit(limit);

  const nowIso = new Date().toISOString();
  let scoreTotal = 0;

  for (const v of venues ?? []) {
    counters.fetched += 1;
    const geo = validateMumbaiVenue({
      name: v.name,
      address: v.address,
      locality: v.locality,
      lat: v.lat,
      lng: v.lng,
      websiteUrl: v.website_url,
    });
    const completeness = scoreVenueCompleteness(v);
    const quarantine = geo.status === "OUT_OF_REGION";
    const wasQuarantined = !!v.quarantined_at;

    const update: Record<string, unknown> = {
      geo_status: geo.status,
      geo_notes: geo.reasons.join("; ").slice(0, 400),
      completeness_score: completeness.score,
      missing_fields: completeness.missing,
    };
    if (quarantine) {
      update["is_active"] = false;
      update["is_verified"] = false;
      update["verification_status"] = "REVIEW_REQUIRED";
      update["quarantined_at"] = v.quarantined_at ?? nowIso;
      update["quarantine_reason"] = geo.reasons.join("; ").slice(0, 300);
      report.quarantined += 1;
      if (!wasQuarantined) await trackIngestion(db, "venue_quarantined", { venue: v.name, reason: geo.reasons[0] ?? "outside Mumbai" });
    } else if (wasQuarantined) {
      // The record now checks out: clear the quarantine stamp but leave activation to the gates.
      update["quarantined_at"] = null;
      update["quarantine_reason"] = null;
      report.released += 1;
    }
    if (geo.status === "VALID") report.valid += 1;
    if (geo.status === "UNVERIFIED") report.unverified += 1;
    if (completeness.score < 60) report.incomplete += 1;
    scoreTotal += completeness.score;

    const { error } = await db.from("venues").update(update as never).eq("id", v.id);
    if (error) counters.failed += 1;
    else counters.updated += 1;
    report.checked += 1;
    report.rows.push({
      id: v.id,
      name: v.name,
      geoStatus: geo.status,
      completeness: completeness.score,
      missing: completeness.missing,
      quarantineReason: quarantine ? geo.reasons.join("; ") : null,
    });
  }

  report.averageCompleteness = report.checked ? Number((scoreTotal / report.checked).toFixed(1)) : 0;
  await finishJob(db, jobId, counters, counters.failed ? "partial" : "success", null, {
    valid: report.valid,
    unverified: report.unverified,
    quarantined: report.quarantined,
    released: report.released,
    average_completeness: report.averageCompleteness,
  });
  return report;
}
