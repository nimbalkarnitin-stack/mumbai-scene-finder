import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_CITY_ID } from "../scene-constants";
import { extractJsonLd, jsonLdType } from "./adapters/shared";
import { AdapterDisabledError } from "./adapters/types";
import {
  candidateEventUrls,
  classifyLinkKind,
  extractLinks,
  isAggregatorDomain,
  nextDiscoveryCheckAt,
  nextDiscoveryStatus,
  officialDomainConfidence,
  parseSocialProfile,
  registrableDomain,
  type DiscoveryStatus,
} from "./discovery";
import {
  backoffDelayMs,
  GOOGLE_DISCOVERY_EVENTS,
  GOOGLE_KEY_ENV_NAMES,
  GOOGLE_SEARCH_FIELD_MASK,
  isRetryableStatus,
  MUMBAI_BIAS,
  requestsRemaining,
} from "./google-discovery";
import { safeFetch, withRetry } from "./safe-fetch.server";
import { sanitiseText, sanitiseUrl } from "./url-guard";

type DB = SupabaseClient<Database>;

async function track(db: DB, eventType: string, metadata: Record<string, unknown>) {
  await db.from("interactions").insert({ event_type: eventType, city_id: DEFAULT_CITY_ID, metadata: metadata as never });
}

export interface DiscoveryCounters {
  scanned: number;
  candidates: number;
  sources_found: number;
  validated: number;
  rejected: number;
  failed: number;
}

const emptyDiscoveryCounters = (): DiscoveryCounters => ({ scanned: 0, candidates: 0, sources_found: 0, validated: 0, rejected: 0, failed: 0 });

export interface CandidateInput {
  name: string;
  discoveryMethod: string;
  discoveryQuery?: string | null;
  entityType?: "venue" | "event" | "experience";
  sourceUrl?: string | null;
  officialWebsiteUrl?: string | null;
  externalRef?: string | null;
  googlePlaceId?: string | null;
  googleMapsUri?: string | null;
  area?: string | null;
  category?: string | null;
  evidence?: Record<string, unknown>;
}

/**
 * Record a discovery candidate.
 * Idempotent on the Google Place ID when present, otherwise on (method, name).
 * Returns whether the row was newly created so callers can report new vs duplicate.
 */
export async function upsertCandidateDetailed(db: DB, input: CandidateInput): Promise<{ id: string | null; created: boolean }> {
  const name = sanitiseText(input.name, 160);
  if (!name) return { id: null, created: false };
  const website = sanitiseUrl(input.officialWebsiteUrl ?? null);
  const domain = registrableDomain(website ?? input.sourceUrl ?? null);
  const placeId = input.googlePlaceId ? sanitiseText(input.googlePlaceId, 200) : null;

  let existing: { id: string } | null = null;
  if (placeId) {
    const { data } = await db.from("discovery_candidates").select("id").eq("google_place_id", placeId).maybeSingle();
    existing = data ?? null;
  }
  if (!existing) {
    const { data } = await db
      .from("discovery_candidates")
      .select("id")
      .eq("discovery_method", input.discoveryMethod)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    existing = data ?? null;
  }

  const patch = {
    name,
    entity_type: input.entityType ?? ("venue" as const),
    discovery_method: input.discoveryMethod,
    discovery_query: input.discoveryQuery ?? null,
    external_ref: input.externalRef ?? placeId,
    google_place_id: placeId,
    google_maps_uri: sanitiseUrl(input.googleMapsUri ?? null),
    area: input.area ? sanitiseText(input.area, 80) : null,
    category: input.category ? sanitiseText(input.category, 80) : null,
    source_url: sanitiseUrl(input.sourceUrl ?? null),
    domain,
    official_website_url: website && !isAggregatorDomain(website) ? website : null,
    evidence: (input.evidence ?? {}) as never,
    city_id: DEFAULT_CITY_ID,
  };

  if (existing) {
    await db.from("discovery_candidates").update(patch).eq("id", existing.id);
    return { id: existing.id, created: false };
  }
  const { data, error } = await db.from("discovery_candidates").insert(patch).select("id").single();
  if (error) return { id: null, created: false };
  return { id: data.id, created: true };
}

export async function upsertCandidate(db: DB, input: CandidateInput): Promise<string | null> {
  return (await upsertCandidateDetailed(db, input)).id;
}

async function upsertSourceCandidate(
  db: DB,
  candidateId: string,
  input: { url: string; kind: string; confidence: number; notes?: string | null; structuredKinds?: string[]; httpStatus?: number | null },
) {
  const url = sanitiseUrl(input.url);
  if (!url) return;
  const row = {
    candidate_id: candidateId,
    url,
    domain: registrableDomain(url),
    kind: input.kind,
    confidence: input.confidence,
    has_structured_data: (input.structuredKinds ?? []).length > 0,
    structured_kinds: input.structuredKinds ?? [],
    validation_notes: input.notes ?? null,
    http_status: input.httpStatus ?? null,
    last_checked_at: new Date().toISOString(),
  };
  const { data: existing } = await db.from("discovery_source_candidates").select("id").eq("candidate_id", candidateId).eq("url", url).maybeSingle();
  if (existing) await db.from("discovery_source_candidates").update(row).eq("id", existing.id);
  else await db.from("discovery_source_candidates").insert(row);
}

async function upsertSocialProfile(db: DB, candidateId: string, url: string) {
  const parsed = parseSocialProfile(url);
  if (!parsed) return;
  const { data: existing } = await db.from("social_profiles").select("id").eq("platform", parsed.platform).eq("profile_url", parsed.profileUrl).maybeSingle();
  const row = {
    candidate_id: candidateId,
    platform: parsed.platform,
    handle: parsed.handle,
    profile_url: parsed.profileUrl,
    // Linked from the official site, but we have no authorised API access until configured:
    // it stays UNVERIFIED and is never treated as an official source on its own.
    verification_state: "UNVERIFIED" as const,
    authorised_api: false,
    evidence: { found_on: "official_site_link" } as never,
    last_checked_at: new Date().toISOString(),
  };
  if (existing) await db.from("social_profiles").update(row).eq("id", existing.id);
  else await db.from("social_profiles").insert(row);
}

function structuredKindsIn(html: string): string[] {
  const kinds = new Set<string>();
  for (const node of extractJsonLd(html)) {
    const t = jsonLdType(node);
    if (t) kinds.add(t);
  }
  if (/<link[^>]+type=["']application\/(rss|atom)\+xml/i.test(html)) kinds.add("RSSFeed");
  return [...kinds].slice(0, 12);
}

/**
 * Official-source resolver for one discovered candidate.
 * Crawls only the candidate's own public site (robots-honouring safeFetch) and records what it finds.
 * Never copies event facts here — it only locates and validates source pages.
 */
export async function resolveCandidate(db: DB, candidateId: string): Promise<{ status: DiscoveryStatus; error: string | null }> {
  const { data: candidate } = await db.from("discovery_candidates").select("*").eq("id", candidateId).maybeSingle();
  if (!candidate) return { status: "REJECTED", error: "candidate not found" };

  const start = sanitiseUrl(candidate.official_website_url ?? candidate.source_url);
  const nowIso = new Date().toISOString();
  if (!start || isAggregatorDomain(start)) {
    await db
      .from("discovery_candidates")
      .update({
        status: "DISCOVERED",
        last_checked_at: nowIso,
        next_check_at: nextDiscoveryCheckAt("DISCOVERED"),
        last_error: start ? "Only an aggregator/social URL is known — an official first-party URL is required." : "No candidate URL to resolve.",
      })
      .eq("id", candidateId);
    return { status: "DISCOVERED", error: "no first-party url" };
  }

  const official = officialDomainConfidence(candidate.name, start);
  const officialDomain = registrableDomain(start);
  let eventsUrl: string | null = null;
  let structuredKinds: string[] = [];
  let lastError: string | null = null;

  try {
    const home = await withRetry(() => safeFetch(start, { timeoutMs: 8000, maxBytes: 1_500_000 }), { attempts: 2 });
    await upsertSourceCandidate(db, candidateId, {
      url: home.url,
      kind: "official_site",
      confidence: official.confidence,
      notes: official.reasons.join("; "),
      structuredKinds: structuredKindsIn(home.body),
      httpStatus: home.status,
    });

    const links = extractLinks(home.body, home.url);
    const eventLinks: { url: string; text: string }[] = [];
    for (const link of links) {
      const kind = classifyLinkKind(link.url, link.text, officialDomain);
      if (kind === "social_profile") {
        await upsertSocialProfile(db, candidateId, link.url);
        continue;
      }
      if (kind === "events_page" || kind === "feed" || kind === "calendar") {
        eventLinks.push(link);
        await upsertSourceCandidate(db, candidateId, { url: link.url, kind, confidence: 0.6, notes: link.text || null });
      }
    }

    // Fall back to conventional what's-on paths on the venue's own origin.
    const toProbe = [...eventLinks.map((l) => l.url), ...candidateEventUrls(home.url)].slice(0, 6);
    for (const url of toProbe) {
      try {
        const page = await safeFetch(url, { timeoutMs: 8000, maxBytes: 1_500_000 });
        if (page.status >= 400) continue;
        const kinds = structuredKindsIn(page.body);
        const hasEvent = kinds.some((k) => /event/i.test(k));
        await upsertSourceCandidate(db, candidateId, {
          url: page.url,
          kind: "events_page",
          confidence: hasEvent ? 0.9 : 0.5,
          notes: hasEvent ? "schema.org Event structured data present" : "reachable, no Event structured data found",
          structuredKinds: kinds,
          httpStatus: page.status,
        });
        if (!eventsUrl || hasEvent) {
          eventsUrl = page.url;
          if (hasEvent) structuredKinds = kinds;
        }
        if (hasEvent) break;
      } catch {
        // an unreachable or disallowed path is simply not a source candidate
      }
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  const status = nextDiscoveryStatus(candidate.status as DiscoveryStatus, {
    officialUrl: official.confidence >= 0.5 ? start : null,
    eventsUrl,
    structuredData: structuredKinds.length > 0,
  });

  await db
    .from("discovery_candidates")
    .update({
      status,
      confidence: official.confidence,
      official_website_url: official.confidence >= 0.5 ? start : null,
      events_page_url: eventsUrl,
      domain: officialDomain,
      evidence: { official_reasons: official.reasons, structured_kinds: structuredKinds } as never,
      last_checked_at: nowIso,
      next_check_at: nextDiscoveryCheckAt(status),
      last_error: lastError,
    })
    .eq("id", candidateId);

  await track(db, status === "VALIDATED" ? "discovery_validated" : eventsUrl ? "discovery_source_found" : "discovery_checked", {
    candidate: candidateId,
    domain: officialDomain,
    confidence: official.confidence,
  });
  return { status, error: lastError };
}

/** Resolve every candidate that is due for a check. */
export async function runDiscoveryResolver(db: DB, limit = 10): Promise<DiscoveryCounters> {
  const counters = emptyDiscoveryCounters();
  const nowIso = new Date().toISOString();
  const { data: rows } = await db
    .from("discovery_candidates")
    .select("id")
    .in("status", ["DISCOVERED", "SOURCE_FOUND", "VALIDATED"])
    .or(`next_check_at.is.null,next_check_at.lte.${nowIso}`)
    .limit(limit);

  for (const row of rows ?? []) {
    counters.scanned += 1;
    try {
      const res = await resolveCandidate(db, row.id);
      if (res.status === "VALIDATED") counters.validated += 1;
      else if (res.status === "SOURCE_FOUND") counters.sources_found += 1;
      if (res.error) counters.failed += 1;
    } catch {
      counters.failed += 1;
    }
  }
  return counters;
}

/** Which Places credential is available, without ever revealing its value. */
export function googleCredential(): { key: string | null; envName: string | null; missing: string[] } {
  for (const name of GOOGLE_KEY_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.trim().length > 10) return { key: value.trim(), envName: name, missing: [] };
  }
  return { key: null, envName: null, missing: [...GOOGLE_KEY_ENV_NAMES] };
}

/** Requests issued today / this calendar month, from the request log. */
export async function googleRequestUsage(db: DB): Promise<{ requestsToday: number; requestsThisMonth: number }> {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [{ count: today }, { count: month }] = await Promise.all([
    db.from("google_api_requests").select("id", { count: "exact", head: true }).gte("created_at", dayStart),
    db.from("google_api_requests").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
  ]);
  return { requestsToday: today ?? 0, requestsThisMonth: month ?? 0 };
}

export interface GoogleRunReport extends DiscoveryCounters {
  run_id: string;
  started_at: string;
  finished_at: string;
  queries_attempted: number;
  queries_succeeded: number;
  queries_failed: number;
  api_requests: number;
  new_candidates: number;
  duplicate_candidates: number;
  budget_remaining: number;
  errors: string[];
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
}

/** One Places Text Search request, logged and retried with exponential backoff on 429/5xx. */
async function googleTextSearch(
  db: DB,
  key: string,
  query: { id: string | null; text: string },
  maxResults: number,
): Promise<{ places: GooglePlace[]; requests: number }> {
  let requests = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await safeFetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      skipRobots: true,
      timeoutMs: 12000,
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        // Explicit FieldMask: identity, address, geo, types and the business' own website only.
        "X-Goog-FieldMask": GOOGLE_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query.text,
        maxResultCount: Math.min(maxResults, 20),
        regionCode: "IN",
        locationBias: {
          circle: { center: { latitude: MUMBAI_BIAS.latitude, longitude: MUMBAI_BIAS.longitude }, radius: MUMBAI_BIAS.radiusMetres },
        },
      }),
    });
    requests += 1;
    const ok = res.status >= 200 && res.status < 300;
    const parsed = ok ? (JSON.parse(res.body) as { places?: GooglePlace[] }) : null;
    const places = Array.isArray(parsed?.places) ? parsed!.places! : [];
    await db.from("google_api_requests").insert({
      endpoint: "places:searchText",
      http_status: res.status,
      query_id: query.id,
      place_count: places.length,
      error: ok ? null : sanitiseText(res.body, 400),
    });
    if (ok) return { places, requests };

    lastError = `HTTP ${res.status}: ${sanitiseText(res.body, 300) ?? "no details"}`;
    if (!isRetryableStatus(res.status)) {
      // 403 / 400 are key, policy or request problems — retrying cannot fix them and would waste quota.
      throw new AdapterDisabledError(`Google Places rejected the request (${lastError})`);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
  }
  throw new Error(`Google Places is rate limiting or unavailable (${lastError})`);
}

/**
 * Google discovery — candidate *identification only*.
 * Runs the enabled area × category queries from the registry, stores each Place ID with the
 * business' own website link, and hands over to the official-source resolver.
 * Google listing content (ratings, reviews, photos, editorial text) is never copied into the catalogue.
 */
export async function runGoogleDiscovery(db: DB, config: Record<string, unknown>): Promise<GoogleRunReport> {
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const counters = emptyDiscoveryCounters();
  const errors: string[] = [];
  let queriesSucceeded = 0;
  let queriesFailed = 0;
  let apiRequests = 0;
  let newCandidates = 0;
  let duplicates = 0;

  const cred = googleCredential();
  if (!cred.key) {
    throw new AdapterDisabledError(
      `Google discovery is NOT_CONFIGURED — the Places API credential is missing. Add ${cred.missing.join(" or ")} in Project Settings → Secrets. No Google requests were made.`,
    );
  }

  const maxResults = Math.min(Math.max(Number(config["max_results"] ?? 20) || 20, 1), 20);
  const perRun = Math.min(Math.max(Number(config["queries_per_run"] ?? 30) || 30, 1), 60);
  const dailyLimit = Math.max(1, Number(config["daily_request_budget"] ?? 500) || 500);
  const monthlyLimit = Math.max(1, Number(config["monthly_request_budget"] ?? 5000) || 5000);

  const usage = await googleRequestUsage(db);
  let remaining = requestsRemaining({ ...usage, dailyLimit, monthlyLimit });
  if (remaining <= 0) {
    throw new AdapterDisabledError(
      `Google request budget reached (${usage.requestsToday}/${dailyLimit} today, ${usage.requestsThisMonth}/${monthlyLimit} this month). No requests were made.`,
    );
  }

  // Least-recently-run enabled queries first, so coverage rotates across areas and categories.
  const { data: rows } = await db
    .from("google_discovery_queries")
    .select("id,area,category,query_text")
    .eq("enabled", true)
    .order("priority", { ascending: true })
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(perRun);

  const queries = rows ?? [];
  if (queries.length === 0) {
    throw new AdapterDisabledError("Google discovery has no enabled queries. Switch some on in Admin → Sources → Google Discovery.");
  }

  await track(db, GOOGLE_DISCOVERY_EVENTS.started, { run_id: runId, queries: queries.length, daily_limit: dailyLimit });

  for (const row of queries) {
    if (remaining <= 0) {
      errors.push("Stopped early: Google request budget reached.");
      break;
    }
    try {
      const { places, requests } = await googleTextSearch(db, cred.key, { id: row.id, text: row.query_text }, maxResults);
      apiRequests += requests;
      remaining -= requests;
      queriesSucceeded += 1;
      counters.scanned += places.length;

      for (const place of places) {
        const name = place.displayName?.text;
        if (!name) continue;
        const { id, created } = await upsertCandidateDetailed(db, {
          name,
          discoveryMethod: "google_places",
          discoveryQuery: row.query_text,
          googlePlaceId: place.id ?? null,
          googleMapsUri: place.googleMapsUri ?? null,
          area: row.area,
          category: row.category,
          officialWebsiteUrl: place.websiteUri ?? null,
          evidence: {
            run_id: runId,
            business_status: place.businessStatus ?? null,
            types: (place.types ?? []).slice(0, 8),
            note: "Google Places used only to identify a candidate and its own website link; no listing content stored.",
          },
        });
        if (!id) continue;
        counters.candidates += 1;
        if (created) {
          newCandidates += 1;
          await track(db, GOOGLE_DISCOVERY_EVENTS.candidateFound, { run_id: runId, candidate: id, area: row.area, category: row.category });
        } else {
          duplicates += 1;
          await track(db, GOOGLE_DISCOVERY_EVENTS.candidateDuplicate, { run_id: runId, candidate: id });
        }
      }

      await db
        .from("google_discovery_queries")
        .update({ last_run_at: new Date().toISOString(), last_result_count: places.length, last_error: null })
        .eq("id", row.id);
      await track(db, GOOGLE_DISCOVERY_EVENTS.queryExecuted, { run_id: runId, query: row.query_text, results: places.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      queriesFailed += 1;
      counters.failed += 1;
      errors.push(`${row.query_text}: ${message}`);
      apiRequests += 1;
      remaining -= 1;
      await db.from("google_discovery_queries").update({ last_run_at: new Date().toISOString(), last_error: message.slice(0, 500) }).eq("id", row.id);
      await track(db, GOOGLE_DISCOVERY_EVENTS.error, { run_id: runId, query: row.query_text, message: message.slice(0, 300) });
      if (error instanceof AdapterDisabledError) break; // key/policy problem — stop the whole run
    }
  }

  const report: GoogleRunReport = {
    ...counters,
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    queries_attempted: queriesSucceeded + queriesFailed,
    queries_succeeded: queriesSucceeded,
    queries_failed: queriesFailed,
    api_requests: apiRequests,
    new_candidates: newCandidates,
    duplicate_candidates: duplicates,
    budget_remaining: Math.max(0, remaining),
    errors: errors.slice(0, 20),
  };
  await track(db, "discovery_run_completed", { method: "google_places", ...report });
  return report;
}

/**
 * Promote a validated candidate into the authorised official-pages source:
 * its what's-on URL is appended to the official source's page list and host allowlist.
 */
export async function promoteCandidateToSource(db: DB, candidateId: string): Promise<{ ok: true; url: string }> {
  const { data: candidate } = await db.from("discovery_candidates").select("*").eq("id", candidateId).maybeSingle();
  if (!candidate) throw new Error("Candidate not found");
  const url = sanitiseUrl(candidate.events_page_url ?? candidate.official_website_url);
  if (!url) throw new Error("This candidate has no validated official page yet — run a re-check first.");
  if (isAggregatorDomain(url)) throw new Error("Aggregator and social URLs cannot be promoted to an official source.");

  const { data: source } = await db.from("ingestion_sources").select("id,config").eq("slug", "official-venue-pages").maybeSingle();
  if (!source) throw new Error("Official pages source is missing");
  const config = (source.config ?? {}) as Record<string, unknown>;
  const pages = Array.isArray(config["pages"]) ? (config["pages"] as unknown[]).filter((p): p is string => typeof p === "string") : [];
  const allow = Array.isArray(config["allow_hosts"]) ? (config["allow_hosts"] as unknown[]).filter((p): p is string => typeof p === "string") : [];
  const host = new URL(url).hostname;
  const nextConfig = {
    ...config,
    pages: [...new Set([...pages, url])].slice(0, 500),
    allow_hosts: [...new Set([...allow, host])].slice(0, 500),
  };
  await db.from("ingestion_sources").update({ config: nextConfig as never }).eq("id", source.id);
  await db.from("discovery_candidates").update({ linked_source_id: source.id, status: "VALIDATED", notes: `Promoted to official pages source: ${url}` }).eq("id", candidateId);
  await track(db, "discovery_promoted", { candidate: candidateId, host });
  return { ok: true, url };
}

/**
 * Close the loop between discovery/verification and the catalogue: every candidate that has
 * a validated first-party what's-on page is promoted into the authorised official-pages
 * source, so the normal ingestion run can read its published schema.org events.
 * Aggregator/social URLs are never promoted, and nothing here creates listings by itself.
 */
export async function promoteValidatedCandidates(
  db: DB,
  limit = 25,
): Promise<{ scanned: number; promoted: number; skipped: number; errors: string[] }> {
  const { data: rows } = await db
    .from("discovery_candidates")
    .select("id,events_page_url,official_website_url,linked_source_id,status")
    .in("status", ["VALIDATED", "SOURCE_FOUND"])
    .is("linked_source_id", null)
    .not("events_page_url", "is", null)
    .limit(limit);

  let promoted = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const row of rows ?? []) {
    try {
      await promoteCandidateToSource(db, row.id);
      promoted += 1;
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (errors.length < 10) errors.push(`${row.id}: ${message}`);
    }
  }
  if (promoted > 0) await track(db, "discovery_promoted_batch", { promoted, skipped });
  return { scanned: (rows ?? []).length, promoted, skipped, errors };
}
