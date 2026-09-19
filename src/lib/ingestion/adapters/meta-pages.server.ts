import { safeFetch, withRetry } from "../safe-fetch.server";
import { buildNormalised, firstString, isoOrNull, numberOrNull } from "./shared";
import { AdapterDisabledError, missingEnv, type AdapterContext, type ParsedItem, type RawItem, type SourceAdapter } from "./types";

const ENV = ["META_GRAPH_ACCESS_TOKEN"];

/**
 * Facebook Pages events via the authorised Meta Graph API.
 * Authorised API access only — no scraping and no login-walled content.
 * Output is a freshness / change signal: records always route to review and no fact the
 * payload doesn't state is ever filled in.
 */
export const metaPagesAdapter: SourceAdapter = {
  key: "meta_pages",
  requiredEnv: ENV,

  async fetch(ctx: AdapterContext): Promise<RawItem[]> {
    const missing = missingEnv(ENV);
    if (missing.length > 0) {
      throw new AdapterDisabledError(`Meta Graph access is not configured. Add ${missing.join(", ")} in Project Settings → Secrets after your Meta app is approved.`);
    }
    const config = ctx.source.config as { page_ids?: unknown; api_version?: unknown };
    const pageIds = Array.isArray(config.page_ids) ? config.page_ids.filter((p): p is string => typeof p === "string" && p.trim().length > 0) : [];
    if (pageIds.length === 0) throw new AdapterDisabledError("No Facebook page IDs configured for this source yet.");

    const token = process.env["META_GRAPH_ACCESS_TOKEN"]!;
    const version = typeof config.api_version === "string" && config.api_version ? config.api_version : "v21.0";
    const out: RawItem[] = [];
    for (const pageId of pageIds.slice(0, 20)) {
      const url = `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/events?fields=id,name,description,start_time,end_time,place,ticket_uri,updated_time,cover&limit=25&access_token=${encodeURIComponent(token)}`;
      const res = await withRetry(() => safeFetch(url, { skipRobots: true, maxBytes: 1_000_000 }));
      const json = JSON.parse(res.body) as { data?: Record<string, unknown>[] };
      const rows = Array.isArray(json.data) ? json.data : [];
      ctx.log(`Meta page ${pageId} returned ${rows.length} events.`);
      for (const raw of rows) out.push({ raw: { ...raw, __pageId: pageId }, sourceUrl: `https://www.facebook.com/events/${String(raw["id"] ?? "")}` });
    }
    return out;
  },

  parse(item) {
    const name = firstString(item.raw["name"]);
    if (!name) return null;
    return { ...item.raw, __sourceUrl: item.sourceUrl } satisfies ParsedItem;
  },

  normalise(parsed) {
    const place = (parsed["place"] ?? null) as { name?: unknown; location?: { street?: unknown; latitude?: unknown; longitude?: unknown; city?: unknown } } | null;
    const startsAt = isoOrNull(parsed["start_time"]);
    const venueName = firstString(place?.name);
    const lat = numberOrNull(place?.location?.latitude);
    const lng = numberOrNull(place?.location?.longitude);
    const cover = (parsed["cover"] ?? null) as { source?: unknown } | null;
    return buildNormalised({
      kind: "event",
      name: String(firstString(parsed["name"])),
      description: firstString(parsed["description"]),
      startsAt,
      endsAt: isoOrNull(parsed["end_time"]),
      venueName,
      address: firstString(place?.location?.street),
      areaHint: firstString(place?.location?.city),
      lat,
      lng,
      bookingUrl: firstString(parsed["ticket_uri"]),
      websiteUrl: firstString(parsed["__sourceUrl"]),
      imageUrl: firstString(cover?.source),
      // Prices are never stated on this endpoint, so they stay unknown.
      confirmed: { date: !!startsAt, price: false, venue: !!venueName, location: lat !== null && lng !== null },
      sourceText: firstString(parsed["description"]),
    });
  },

  getExternalId(parsed) {
    return String(parsed["id"] ?? parsed["__sourceUrl"] ?? parsed["name"]).slice(0, 300);
  },

  getSourceUrl(parsed) {
    return firstString(parsed["__sourceUrl"]);
  },

  getLastModified(parsed) {
    return isoOrNull(parsed["updated_time"]);
  },
};
