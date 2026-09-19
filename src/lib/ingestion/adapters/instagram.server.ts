import { safeFetch, withRetry } from "../safe-fetch.server";
import { buildNormalised, firstString, isoOrNull } from "./shared";
import { AdapterDisabledError, missingEnv, type AdapterContext, type ParsedItem, type RawItem, type SourceAdapter } from "./types";

const ENV = ["INSTAGRAM_GRAPH_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"];
const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Instagram Professional (Meta Graph API) adapter scaffold.
 * Authorised API access only — no scraping of profiles or private content.
 * Output is a DISCOVERY / FRESHNESS signal: records always land in review and are never
 * treated as an authoritative booking record (no dates or prices are inferred from captions).
 */
export const instagramAdapter: SourceAdapter = {
  key: "instagram_professional",
  requiredEnv: ENV,

  async fetch(ctx: AdapterContext): Promise<RawItem[]> {
    const missing = missingEnv(ENV);
    if (missing.length > 0) {
      throw new AdapterDisabledError(
        `Instagram Professional access is not configured. Add ${missing.join(", ")} in Project Settings → Secrets after approving the Meta app.`,
      );
    }
    const token = process.env["INSTAGRAM_GRAPH_ACCESS_TOKEN"]!;
    const accountId = process.env["INSTAGRAM_BUSINESS_ACCOUNT_ID"]!;
    const url = `${GRAPH}/${encodeURIComponent(accountId)}/media?fields=id,caption,permalink,media_url,timestamp,media_type&limit=25&access_token=${encodeURIComponent(token)}`;
    const res = await withRetry(() => safeFetch(url, { skipRobots: true, maxBytes: 1_000_000 }));
    const json = JSON.parse(res.body) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(json.data) ? json.data : [];
    ctx.log(`Instagram returned ${rows.length} posts (discovery signal only).`);
    return rows.map((raw) => ({ raw, sourceUrl: firstString(raw["permalink"]) }));
  },

  parse(item) {
    const caption = firstString(item.raw["caption"]);
    if (!caption) return null;
    return { ...item.raw, name: caption.split(/\n|\./)[0]?.slice(0, 120) ?? caption.slice(0, 120), __sourceUrl: item.sourceUrl } satisfies ParsedItem;
  },

  normalise(parsed) {
    // Deliberately no dates, prices, venue or booking inference from social captions.
    return buildNormalised({
      kind: "event",
      name: String(parsed["name"]),
      description: firstString(parsed["caption"]),
      websiteUrl: firstString(parsed["permalink"], parsed["__sourceUrl"]),
      imageUrl: firstString(parsed["media_url"]),
      categoryHint: null,
      confirmed: { date: false, price: false, venue: false, location: false },
      sourceText: firstString(parsed["caption"]),
    });
  },

  getExternalId(parsed) {
    return String(parsed["id"] ?? parsed["permalink"] ?? parsed["name"]).slice(0, 300);
  },

  getSourceUrl(parsed) {
    return firstString(parsed["permalink"], parsed["__sourceUrl"]);
  },

  getLastModified(parsed) {
    return isoOrNull(parsed["timestamp"]);
  },
};
