import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Every function here is admin-only: the caller's role is verified through RLS-scoped queries. */
async function assertAdmin(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

const QUEUES = ["new", "needs_review", "changed", "expiring", "stale", "failed", "duplicates", "cancelled"] as const;
export type ReviewQueue = (typeof QUEUES)[number];

export const listReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ queue: z.enum(QUEUES), limit: z.number().min(1).max(100).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = data.limit ?? 50;
    const now = new Date();

    if (data.queue === "duplicates") {
      const { data: rows } = await supabaseAdmin
        .from("duplicate_candidates")
        .select("id,entity_type,primary_id,candidate_id,match_score,signals,status,created_at")
        .eq("status", "open")
        .order("match_score", { ascending: false })
        .limit(limit);
      const ids = [...new Set((rows ?? []).flatMap((r) => [r.primary_id, r.candidate_id]))];
      const { data: events } = ids.length
        ? await supabaseAdmin.from("events").select("id,name,starts_at,source_name,lifecycle_status").in("id", ids)
        : { data: [] };
      const byId = new Map((events ?? []).map((e) => [e.id, e]));
      return {
        kind: "duplicates" as const,
        rows: (rows ?? []).map((r) => ({ ...r, primary: byId.get(r.primary_id) ?? null, candidate: byId.get(r.candidate_id) ?? null })),
      };
    }

    if (data.queue === "expiring" || data.queue === "cancelled" || data.queue === "stale") {
      let q = supabaseAdmin
        .from("events")
        .select("id,name,slug,starts_at,ends_at,lifecycle_status,verification_status,quality_score,source_name,source_url,source_last_checked_at")
        .order("starts_at", { ascending: true })
        .limit(limit);
      if (data.queue === "expiring") {
        q = q
          .gte("starts_at", now.toISOString())
          .lte("starts_at", new Date(now.getTime() + 36 * 3600000).toISOString())
          .eq("lifecycle_status", "ACTIVE");
      } else if (data.queue === "cancelled") {
        q = q.in("lifecycle_status", ["CANCELLED", "POSTPONED", "SOLD_OUT"]);
      } else {
        q = q.eq("verification_status", "STALE");
      }
      const { data: rows } = await q;
      return { kind: "events" as const, rows: rows ?? [] };
    }

    const statusMap: Record<string, string[]> = { new: ["new"], needs_review: ["needs_review"], changed: ["changed"], failed: [] };
    let q = supabaseAdmin
      .from("source_records")
      .select("id,source_name,source_type,source_url,external_id,normalised,quality_score,verification_status,review_status,parse_status,fetch_status,error_message,first_seen_at,last_seen_at,last_checked_at,linked_entity_type,linked_entity_id")
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (data.queue === "failed") q = q.or("parse_status.eq.failed,fetch_status.eq.failed,error_message.not.is.null");
    else q = q.in("review_status", statusMap[data.queue] ?? ["new"]);
    const { data: rows } = await q;
    return { kind: "records" as const, rows: rows ?? [] };
  });

export const actOnSourceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["approve", "reject", "verify", "retry", "needs_review"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pipeline = await import("@/lib/ingestion/pipeline.server");
    const settings = await pipeline.loadSettings(supabaseAdmin);

    if (data.action === "reject") {
      const { data: rec } = await supabaseAdmin.from("source_records").select("linked_entity_type,linked_entity_id").eq("id", data.id).maybeSingle();
      if (rec?.linked_entity_id && rec.linked_entity_type) {
        const table = rec.linked_entity_type === "event" ? "events" : rec.linked_entity_type === "experience" ? "experiences" : "venues";
        if (table === "events") await supabaseAdmin.from("events").update({ lifecycle_status: "DRAFT" }).eq("id", rec.linked_entity_id);
        else await supabaseAdmin.from(table).update({ is_active: false }).eq("id", rec.linked_entity_id);
      }
      await supabaseAdmin.from("source_records").update({ review_status: "rejected" }).eq("id", data.id);
      await supabaseAdmin.from("interactions").insert({ event_type: "record_rejected", metadata: { source_record: data.id } });
      return { ok: true };
    }

    if (data.action === "needs_review") {
      await supabaseAdmin.from("source_records").update({ review_status: "needs_review" }).eq("id", data.id);
      return { ok: true };
    }

    if (data.action === "verify") {
      await supabaseAdmin.from("source_records").update({ verification_status: "VERIFIED", last_checked_at: new Date().toISOString() }).eq("id", data.id);
      await supabaseAdmin.from("interactions").insert({ event_type: "record_verified", metadata: { source_record: data.id, by: "admin" } });
    }

    // approve / verify / retry all end with a publish attempt for this record.
    await supabaseAdmin.from("source_records").update({ review_status: "approved", error_message: null }).eq("id", data.id);
    const published = await pipeline.publishReadyRecords(supabaseAdmin, settings, 50);
    return { ok: true, published };
  });

export const setEventLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        lifecycle: z.enum(["DRAFT", "PENDING_REVIEW", "ACTIVE", "SOLD_OUT", "POSTPONED", "CANCELLED", "EXPIRED"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("events").update({ lifecycle_status: data.lifecycle }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Non-destructive merge: the duplicate is retired, but its source record is always kept. */
export const mergeDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["merge", "reject"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pair } = await supabaseAdmin.from("duplicate_candidates").select("*").eq("id", data.id).maybeSingle();
    if (!pair) throw new Error("Duplicate candidate not found");

    if (data.action === "merge") {
      // Keep the primary live; retire the candidate but preserve its provenance.
      await supabaseAdmin.from("events").update({ lifecycle_status: "DRAFT" }).eq("id", pair.candidate_id);
      await supabaseAdmin
        .from("source_records")
        .update({ review_status: "needs_review", linked_entity_id: pair.primary_id })
        .eq("linked_entity_id", pair.candidate_id);
      await supabaseAdmin.from("interactions").insert({ event_type: "dedupe_candidate_merged", metadata: { pair: data.id } });
    }

    await supabaseAdmin
      .from("duplicate_candidates")
      .update({ status: data.action === "merge" ? "merged" : "rejected", resolved_by: context.userId, resolved_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sources } = await supabaseAdmin.from("ingestion_sources").select("*").order("authority_level", { ascending: false });
    const { data: jobs } = await supabaseAdmin
      .from("ingestion_jobs")
      .select("source_name,status,started_at,finished_at,records_created,records_updated,records_failed,error_summary")
      .order("started_at", { ascending: false })
      .limit(120);
    // Report only whether each credential is present — never the value.
    return {
      sources: (sources ?? []).map((s) => ({
        ...s,
        credentials_ready: s.credential_env_keys.every((k) => !!process.env[k]),
        missing_credentials: s.credential_env_keys.filter((k) => !process.env[k]),
      })),
      jobs: jobs ?? [],
    };
  });

export const updateSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        enabled: z.boolean().optional(),
        authority_level: z.number().min(1).max(5).optional(),
        refresh_interval_minutes: z.number().min(15).max(20160).optional(),
        base_url: z.string().nullable().optional(),
        config: z.record(z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { isSafeExternalUrl } = await import("@/lib/ingestion/url-guard");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { id, ...patch } = data;
    if (patch.base_url && !isSafeExternalUrl(patch.base_url)) throw new Error("Base URL must be a public http(s) URL");
    if (patch.config) {
      const pages = (patch.config as { pages?: unknown }).pages;
      if (Array.isArray(pages)) {
        for (const p of pages) {
          if (typeof p !== "string" || !isSafeExternalUrl(p)) throw new Error(`Rejected page URL: ${String(p)} — must be a public http(s) URL`);
        }
      }
      const feed = (patch.config as { feed_url?: unknown }).feed_url;
      if (typeof feed === "string" && feed && !isSafeExternalUrl(feed)) throw new Error("Feed URL must be a public http(s) URL");
    }
    const { error } = await supabaseAdmin.from("ingestion_sources").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Run one source (or the whole orchestrator) immediately from the admin UI. */
export const runIngestionNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ source: z.string().optional(), task: z.enum(["orchestrate", "verify", "expire", "dedupe", "publish"]).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pipeline = await import("@/lib/ingestion/pipeline.server");
    const settings = await pipeline.loadSettings(supabaseAdmin);
    switch (data.task ?? "orchestrate") {
      case "verify":
        return { ok: true, result: await pipeline.verifyCatalogue(supabaseAdmin, settings) };
      case "expire":
        return { ok: true, result: await pipeline.expireEvents(supabaseAdmin) };
      case "dedupe":
        return { ok: true, result: await pipeline.scanDuplicates(supabaseAdmin) };
      case "publish":
        return { ok: true, result: await pipeline.publishReadyRecords(supabaseAdmin, settings) };
      default:
        return { ok: true, result: await pipeline.orchestrate(supabaseAdmin, { mode: "full", sourceSlug: data.source ?? null }) };
    }
  });

/** Admin/organiser submission: stored as a source record, always routed to review. */
export const submitOrganiserRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["event", "venue", "experience"]),
        name: z.string().min(2).max(160),
        description: z.string().max(4000).optional(),
        /** Wall-clock Mumbai time, e.g. 2026-10-02T20:30 */
        startsAtIst: z.string().optional(),
        endsAtIst: z.string().optional(),
        venueName: z.string().max(160).optional(),
        area: z.string().max(80).optional(),
        address: z.string().max(300).optional(),
        priceMin: z.number().nonnegative().optional(),
        priceMax: z.number().nonnegative().optional(),
        bookingUrl: z.string().optional(),
        websiteUrl: z.string().optional(),
        imageUrl: z.string().optional(),
        sourceUrl: z.string().optional(),
        organiser: z.string().max(160).optional(),
        category: z.string().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { istLocalToUtcIso } = await import("@/lib/ingestion/timezone");
    const { isSafeExternalUrl } = await import("@/lib/ingestion/url-guard");
    const { sha256Hex } = await import("@/lib/ingestion/adapters/shared");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (const [label, url] of [["booking", data.bookingUrl], ["website", data.websiteUrl], ["image", data.imageUrl], ["source", data.sourceUrl]] as const) {
      if (url && !isSafeExternalUrl(url)) throw new Error(`${label} URL must be a public http(s) URL`);
    }

    const payload = {
      kind: data.kind,
      name: data.name,
      description: data.description ?? null,
      starts_at: data.startsAtIst ? istLocalToUtcIso(data.startsAtIst) : null,
      ends_at: data.endsAtIst ? istLocalToUtcIso(data.endsAtIst) : null,
      venue_name: data.venueName ?? null,
      area: data.area ?? null,
      address: data.address ?? null,
      price_min: data.priceMin ?? null,
      price_max: data.priceMax ?? null,
      booking_url: data.bookingUrl ?? null,
      website_url: data.websiteUrl ?? null,
      image_url: data.imageUrl ?? null,
      source_url: data.sourceUrl ?? null,
      organiser: data.organiser ?? null,
      category: data.category ?? null,
      submission_id: crypto.randomUUID(),
      submitted_by: context.userId,
      updated_at: new Date().toISOString(),
    };

    const { organiserSubmissionAdapter } = await import("@/lib/ingestion/adapters/organiser-submission.server");
    const ctx = { source: { slug: "organiser-submissions" } as never, now: new Date(), log: () => {} };
    const parsed = organiserSubmissionAdapter.parse({ raw: payload, sourceUrl: payload.source_url }, ctx);
    const normalised = parsed ? organiserSubmissionAdapter.normalise(parsed, ctx) : null;
    if (!normalised) throw new Error("Submission could not be normalised");

    const { data: source } = await supabaseAdmin.from("ingestion_sources").select("id,authority_level").eq("slug", "organiser-submissions").maybeSingle();
    const { error } = await supabaseAdmin.from("source_records").insert({
      source_id: source?.id ?? null,
      source_name: "organiser-submissions",
      source_type: "organiser_submission",
      source_url: payload.source_url,
      external_id: payload.submission_id,
      raw_payload: payload as never,
      normalised: normalised as never,
      content_hash: await sha256Hex(JSON.stringify(normalised)),
      parse_status: "needs_review",
      fetch_status: "ok",
      review_status: "needs_review",
      source_confidence: (source?.authority_level ?? 3) * 20,
      verification_status: "REVIEW_REQUIRED",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getIngestionHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { istDayBounds, istDayKey } = await import("@/lib/ingestion/timezone");
    const now = new Date();
    const today = istDayBounds(istDayKey(now));
    const day = new Date(now.getTime() - 86400000).toISOString();

    const tables = ["venues", "events", "experiences", "offers"] as const;
    const catalogue = await Promise.all(
      tables.map(async (t) => {
        const base = () => supabaseAdmin.from(t).select("id", { count: "exact", head: true });
        // offers has no updated_at column; created_at is its freshness stamp.
        const freshColumn = t === "offers" ? "created_at" : "updated_at";
        const [total, verified, fresh, stale] = await Promise.all([
          base().then((r) => r.count ?? 0),
          base().eq("verification_status", "VERIFIED").then((r) => r.count ?? 0),
          base().gte(freshColumn, day).then((r) => r.count ?? 0),
          base().eq("verification_status", "STALE").then((r) => r.count ?? 0),
        ]);
        return { table: t, total, verified, fresh24h: fresh, stale };
      }),
    );


    const [
      { count: duplicates },
      { count: reviewQueue },
      { count: expiringToday },
      { count: cancelled },
      { data: jobs },
      { data: sources },
    ] = await Promise.all([
      supabaseAdmin.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabaseAdmin.from("source_records").select("id", { count: "exact", head: true }).in("review_status", ["new", "needs_review", "changed"]),
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }).eq("lifecycle_status", "ACTIVE").gte("starts_at", today.start).lte("starts_at", today.end),
      supabaseAdmin.from("events").select("id", { count: "exact", head: true }).in("lifecycle_status", ["CANCELLED", "POSTPONED"]),
      supabaseAdmin.from("ingestion_jobs").select("source_name,job_type,status,started_at,finished_at,records_created,records_updated,records_failed,error_summary").order("started_at", { ascending: false }).limit(200),
      supabaseAdmin.from("ingestion_sources").select("slug,name,enabled,last_run_at,last_status,last_error,source_type,authority_level"),
    ]);

    const recentJobs = (jobs ?? []).filter((j) => j.started_at >= day);
    const bySource = new Map<string, { last_success: string | null; failures: number; created: number; updated: number; failed: number }>();
    for (const j of jobs ?? []) {
      const key = j.source_name ?? "pipeline";
      const entry = bySource.get(key) ?? { last_success: null, failures: 0, created: 0, updated: 0, failed: 0 };
      if (j.status === "success" && !entry.last_success) entry.last_success = j.finished_at ?? j.started_at;
      if (j.status === "failed") entry.failures += 1;
      if (j.started_at >= day) {
        entry.created += j.records_created;
        entry.updated += j.records_updated;
        entry.failed += j.records_failed;
      }
      bySource.set(key, entry);
    }

    return {
      catalogue,
      duplicates: duplicates ?? 0,
      reviewQueue: reviewQueue ?? 0,
      expiringToday: expiringToday ?? 0,
      cancelled: cancelled ?? 0,
      today: {
        jobs: recentJobs.length,
        success: recentJobs.filter((j) => j.status === "success").length,
        failed: recentJobs.filter((j) => j.status === "failed").length,
        created: recentJobs.reduce((n, j) => n + j.records_created, 0),
        updated: recentJobs.reduce((n, j) => n + j.records_updated, 0),
        failedRecords: recentJobs.reduce((n, j) => n + j.records_failed, 0),
      },
      sources: (sources ?? []).map((s) => ({ ...s, stats: bySource.get(s.slug) ?? null })),
      recentJobs: (jobs ?? []).slice(0, 15),
    };

  });

/** Discovery candidates with their resolved source candidates (admin-only, read). */
export const listDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(["all", "DISCOVERED", "SOURCE_FOUND", "VALIDATED", "INGESTED", "REJECTED"]).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("discovery_candidates")
      .select("id,name,status,discovery_method,discovery_query,domain,source_url,official_website_url,events_page_url,confidence,evidence,notes,last_error,discovered_at,last_checked_at,next_check_at")
      .order("confidence", { ascending: false })
      .limit(100);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: candidates } = await q;
    const ids = (candidates ?? []).map((c) => c.id);
    const { data: pages } = ids.length
      ? await supabaseAdmin
          .from("discovery_source_candidates")
          .select("id,candidate_id,url,kind,confidence,status,has_structured_data,structured_kinds,validation_notes,http_status,last_checked_at")
          .in("candidate_id", ids)
      : { data: [] };
    const { data: socials } = ids.length
      ? await supabaseAdmin.from("social_profiles").select("id,candidate_id,platform,handle,profile_url,verification_state,authorised_api,last_checked_at").in("candidate_id", ids)
      : { data: [] };
    const { googleCredential } = await import("@/lib/ingestion/discovery.server");
    const googleReady = !!googleCredential().key;
    return {
      candidates: candidates ?? [],
      pages: pages ?? [],
      socials: socials ?? [],
      googleConfigured: googleReady,
    };
  });

/** Safe manual discovery actions: re-check a candidate, promote it to the official source, or reject it. */
export const discoveryAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        action: z.enum(["recheck", "promote", "reject", "reopen", "add_candidate", "run_google"]),
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(160).optional(),
        url: z.string().max(500).optional(),
        confirm: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const discovery = await import("@/lib/ingestion/discovery.server");

    if (data.action === "add_candidate") {
      const { isSafeExternalUrl } = await import("@/lib/ingestion/url-guard");
      if (!data.name) throw new Error("A venue or organiser name is required");
      if (data.url && !isSafeExternalUrl(data.url)) throw new Error("The website must be a public http(s) URL");
      const id = await discovery.upsertCandidate(supabaseAdmin, {
        name: data.name,
        discoveryMethod: "manual",
        officialWebsiteUrl: data.url ?? null,
        sourceUrl: data.url ?? null,
      });
      if (!id) throw new Error("Candidate could not be stored");
      return { ok: true, id };
    }

    if (data.action === "run_google") {
      // RUN NOW is explicit and confirmed in the UI: it spends Google quota.
      if (!data.confirm) throw new Error("Confirmation is required before spending Google Places quota.");
      const { data: source } = await supabaseAdmin.from("ingestion_sources").select("config,enabled").eq("slug", "google-discovery").maybeSingle();
      if (!source?.enabled) throw new Error("Google discovery is switched off. Enable it in Sources once the Google API key and queries are configured.");
      const google = await discovery.runGoogleDiscovery(supabaseAdmin, (source.config ?? {}) as Record<string, unknown>);
      // Hand the fresh candidates straight to the official-source resolver (bounded batch).
      const resolved = await discovery.runDiscoveryResolver(supabaseAdmin, 20);
      return { ok: true, result: { ...google, resolver: resolved } };
    }

    if (!data.id) throw new Error("A candidate is required");
    if (data.action === "recheck") return { ok: true, result: await discovery.resolveCandidate(supabaseAdmin, data.id) };
    if (data.action === "promote") return { ok: true, result: await discovery.promoteCandidateToSource(supabaseAdmin, data.id) };
    const status = data.action === "reject" ? "REJECTED" : "DISCOVERED";
    const { error } = await supabaseAdmin.from("discovery_candidates").update({ status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Field-by-field source evidence for one catalogue row, plus any open conflicts. */
export const getSourceEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ entityType: z.enum(["event", "venue", "experience"]), entityId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: fields }, { data: conflicts }] = await Promise.all([
      supabaseAdmin
        .from("field_provenance")
        .select("field,value_text,source_name,source_type,source_url,authority_level,confidence,observed_at")
        .eq("entity_type", data.entityType)
        .eq("entity_id", data.entityId)
        .order("field", { ascending: true }),
      supabaseAdmin
        .from("field_conflicts")
        .select("id,field,conflicting_values,status,detected_at")
        .eq("entity_type", data.entityType)
        .eq("entity_id", data.entityId)
        .eq("status", "open"),
    ]);
    return { fields: fields ?? [], conflicts: conflicts ?? [] };
  });

/** Re-run discovery resolution / cross-source verification on demand. */
export const runDiscoveryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ task: z.enum(["resolve", "cross-verify"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.task === "resolve") {
      const { runDiscoveryResolver } = await import("@/lib/ingestion/discovery.server");
      return { ok: true, result: await runDiscoveryResolver(supabaseAdmin, 10) };
    }
    const pipeline = await import("@/lib/ingestion/pipeline.server");
    const settings = await pipeline.loadSettings(supabaseAdmin);
    return { ok: true, result: await pipeline.crossVerify(supabaseAdmin, settings) };
  });

/**
 * Google Discovery status for Admin → Sources.
 * Read-only: credential presence (never its value), query registry counts, request budget usage,
 * candidate/source funnel counts and recent errors.
 */
export const googleDiscoveryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { googleCredential, googleRequestUsage } = await import("@/lib/ingestion/discovery.server");
    const { requestsRemaining } = await import("@/lib/ingestion/google-discovery");

    const cred = googleCredential();
    const [{ data: source }, usage] = await Promise.all([
      supabaseAdmin.from("ingestion_sources").select("id,enabled,config,last_run_at,last_status,last_error").eq("slug", "google-discovery").maybeSingle(),
      googleRequestUsage(supabaseAdmin),
    ]);
    const config = (source?.config ?? {}) as Record<string, unknown>;
    const dailyLimit = Math.max(1, Number(config["daily_request_budget"] ?? 500) || 500);
    const monthlyLimit = Math.max(1, Number(config["monthly_request_budget"] ?? 5000) || 5000);

    const countOf = async (build: () => PromiseLike<{ count: number | null }>) => (await build()).count ?? 0;
    const [totalQueries, enabledQueries, queryErrors, candidates, withSource, validated, ingested, rejected, failedCandidates, conflicts] = await Promise.all([
      countOf(() => supabaseAdmin.from("google_discovery_queries").select("id", { count: "exact", head: true })),
      countOf(() => supabaseAdmin.from("google_discovery_queries").select("id", { count: "exact", head: true }).eq("enabled", true)),
      countOf(() => supabaseAdmin.from("google_discovery_queries").select("id", { count: "exact", head: true }).not("last_error", "is", null)),
      countOf(() => supabaseAdmin.from("discovery_candidates").select("id", { count: "exact", head: true }).eq("discovery_method", "google_places")),
      countOf(() => supabaseAdmin.from("discovery_candidates").select("id", { count: "exact", head: true }).eq("discovery_method", "google_places").eq("status", "SOURCE_FOUND")),
      countOf(() => supabaseAdmin.from("discovery_candidates").select("id", { count: "exact", head: true }).eq("discovery_method", "google_places").eq("status", "VALIDATED")),
      countOf(() => supabaseAdmin.from("discovery_candidates").select("id", { count: "exact", head: true }).eq("discovery_method", "google_places").eq("status", "INGESTED")),
      countOf(() => supabaseAdmin.from("discovery_candidates").select("id", { count: "exact", head: true }).eq("discovery_method", "google_places").eq("status", "REJECTED")),
      countOf(() => supabaseAdmin.from("discovery_candidates").select("id", { count: "exact", head: true }).eq("discovery_method", "google_places").not("last_error", "is", null)),
      countOf(() => supabaseAdmin.from("field_conflicts").select("id", { count: "exact", head: true }).eq("status", "open")),
    ]);

    const { data: recentErrors } = await supabaseAdmin
      .from("google_api_requests")
      .select("endpoint,http_status,error,created_at")
      .not("error", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: topQueries } = await supabaseAdmin
      .from("google_discovery_queries")
      .select("id,area,category,query_text,enabled,priority,last_run_at,last_result_count,last_error")
      .eq("enabled", true)
      .order("last_run_at", { ascending: false, nullsFirst: false })
      .limit(25);

    return {
      status: !cred.key ? ("NOT_CONFIGURED" as const) : source?.enabled ? ("ACTIVE" as const) : ("DISABLED" as const),
      credentialConfigured: !!cred.key,
      credentialEnvName: cred.envName,
      missingCredentials: cred.missing,
      enabled: !!source?.enabled,
      lastRunAt: source?.last_run_at ?? null,
      lastStatus: source?.last_status ?? null,
      lastError: source?.last_error ?? null,
      queries: { total: totalQueries, enabled: enabledQueries, withErrors: queryErrors, recent: topQueries ?? [] },
      requests: { today: usage.requestsToday, month: usage.requestsThisMonth, dailyLimit, monthlyLimit, remaining: requestsRemaining({ ...usage, dailyLimit, monthlyLimit }) },
      candidates: { total: candidates, sourceFound: withSource, validated, ingested, rejected, failed: failedCandidates },
      openConflicts: conflicts,
      recentErrors: recentErrors ?? [],
    };
  });

/**
 * TEST CONNECTION — one minimal, field-masked Places request to confirm the key works.
 * Stores nothing in the catalogue; the request is logged for budget accounting.
 */
export const googleTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { googleCredential } = await import("@/lib/ingestion/discovery.server");
    const { safeFetch } = await import("@/lib/ingestion/safe-fetch.server");
    const { sanitiseText } = await import("@/lib/ingestion/url-guard");

    const cred = googleCredential();
    if (!cred.key) {
      return { ok: false as const, status: "NOT_CONFIGURED" as const, message: `Google Places API credential is not configured. Add ${cred.missing.join(" or ")} in Project Settings → Secrets.` };
    }
    const res = await safeFetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      skipRobots: true,
      timeoutMs: 10000,
      headers: { "content-type": "application/json", "X-Goog-Api-Key": cred.key, "X-Goog-FieldMask": "places.id" },
      body: JSON.stringify({ textQuery: "live music venue in Bandra, Mumbai", maxResultCount: 1, regionCode: "IN" }),
    });
    const ok = res.status >= 200 && res.status < 300;
    await supabaseAdmin.from("google_api_requests").insert({
      endpoint: "places:searchText (test)",
      http_status: res.status,
      place_count: 0,
      error: ok ? null : sanitiseText(res.body, 400),
    });
    return {
      ok,
      status: ok ? ("ACTIVE" as const) : ("ERROR" as const),
      message: ok
        ? `Google Places API (New) responded normally using ${cred.envName}.`
        : `Google rejected the request (HTTP ${res.status}): ${sanitiseText(res.body, 300) ?? "no details"}`,
    };
  });

/** Enable or disable registry queries, by id or by whole area / category. */
export const setGoogleQueries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        ids: z.array(z.string().uuid()).max(500).optional(),
        area: z.string().max(80).optional(),
        category: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.ids?.length && !data.area && !data.category) throw new Error("Choose queries, an area or a category to change.");
    let q = supabaseAdmin.from("google_discovery_queries").update({ enabled: data.enabled });
    if (data.ids?.length) q = q.in("id", data.ids);
    if (data.area) q = q.eq("area", data.area);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q.select("id");
    if (error) throw new Error(error.message);
    return { ok: true, updated: (rows ?? []).length };
  });
