import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_CITY_ID } from "../scene-constants";
import { extractJsonLd, jsonLdType } from "./adapters/shared";
import { AdapterDisabledError, missingEnv } from "./adapters/types";
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

/** Record a discovery candidate. Idempotent on (method, name, domain). */
export async function upsertCandidate(
  db: DB,
  input: {
    name: string;
    discoveryMethod: string;
    discoveryQuery?: string | null;
    entityType?: "venue" | "event" | "experience";
    sourceUrl?: string | null;
    officialWebsiteUrl?: string | null;
    externalRef?: string | null;
    evidence?: Record<string, unknown>;
  },
): Promise<string | null> {
  const name = sanitiseText(input.name, 160);
  if (!name) return null;
  const website = sanitiseUrl(input.officialWebsiteUrl ?? null);
  const domain = registrableDomain(website ?? input.sourceUrl ?? null);
  const { data: existing } = await db
    .from("discovery_candidates")
    .select("id")
    .eq("discovery_method", input.discoveryMethod)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  const patch = {
    name,
    entity_type: input.entityType ?? ("venue" as const),
    discovery_method: input.discoveryMethod,
    discovery_query: input.discoveryQuery ?? null,
    external_ref: input.externalRef ?? null,
    source_url: sanitiseUrl(input.sourceUrl ?? null),
    domain,
    official_website_url: website && !isAggregatorDomain(website) ? website : null,
    evidence: (input.evidence ?? {}) as never,
    city_id: DEFAULT_CITY_ID,
  };

  if (existing) {
    await db.from("discovery_candidates").update(patch).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await db.from("discovery_candidates").insert(patch).select("id").single();
  if (error) return null;
  return data.id;
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

/**
 * Google discovery — candidate *identification only*.
 * Stores a candidate name plus the business' own website link so the official-source resolver
 * can take over. Google listing content (ratings, reviews, photos, editorial text) is never
 * copied into the catalogue, in line with Google's terms.
 */
export async function runGoogleDiscovery(db: DB, config: Record<string, unknown>): Promise<DiscoveryCounters> {
  const counters = emptyDiscoveryCounters();
  const missing = missingEnv(["GOOGLE_PLACES_API_KEY"]);
  if (missing.length > 0) {
    throw new AdapterDisabledError(`Google discovery is not configured. Add ${missing.join(", ")} in Project Settings → Secrets.`);
  }
  const queries = Array.isArray(config["queries"]) ? (config["queries"] as unknown[]).filter((q): q is string => typeof q === "string" && q.trim().length > 2) : [];
  if (queries.length === 0) throw new AdapterDisabledError("Google discovery has no search queries configured yet.");

  const key = process.env["GOOGLE_PLACES_API_KEY"]!;
  const maxResults = Math.min(Number(config["max_results"] ?? 20) || 20, 60);
  // Per-run query budget keeps Google quota predictable; configurable per source.
  const perRun = Math.min(Math.max(Number(config["queries_per_run"] ?? 30) || 30, 1), 60);

  for (const query of queries.slice(0, perRun)) {
    const res = await withRetry(() =>
      safeFetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        skipRobots: true,
        timeoutMs: 10000,
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": key,
          // Only identity + website fields are requested — no reviews, photos or editorial content.
          "X-Goog-FieldMask": "places.id,places.displayName,places.websiteUri",
        },
        body: JSON.stringify({ textQuery: query, maxResultCount: Math.min(maxResults, 20), regionCode: "IN" }),
      }),
    );
    if (res.status < 200 || res.status >= 300) {
      // Surface Google's own message (e.g. API_KEY_SERVICE_BLOCKED) instead of silently counting zero.
      throw new AdapterDisabledError(`Google Places rejected the request (HTTP ${res.status}): ${sanitiseText(res.body, 300) ?? "no details"}`);
    }
    const json = JSON.parse(res.body) as { places?: { id?: string; displayName?: { text?: string }; websiteUri?: string }[] };

    const places = Array.isArray(json.places) ? json.places : [];
    counters.scanned += places.length;
    for (const place of places) {
      const name = place.displayName?.text;
      if (!name) continue;
      const id = await upsertCandidate(db, {
        name,
        discoveryMethod: "google_places",
        discoveryQuery: query,
        externalRef: place.id ?? null,
        officialWebsiteUrl: place.websiteUri ?? null,
        evidence: { note: "Google used only to identify a candidate and its own website link; no listing content stored." },
      });
      if (id) counters.candidates += 1;
    }
  }
  await track(db, "discovery_run_completed", { method: "google_places", ...counters });
  return counters;
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
