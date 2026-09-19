import { safeFetch, withRetry } from "../safe-fetch.server";
import { buildNormalised, firstString, isoOrNull, numberOrNull } from "./shared";
import { AdapterDisabledError, type AdapterContext, type ParsedItem, type RawItem, type SourceAdapter } from "./types";

function pluck(obj: unknown, path: string | null): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift();
  if (!header) return [];
  const split = (line: string) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
  const cols = split(header);
  return lines.map((line) => {
    const values = split(line);
    const row: Record<string, string> = {};
    cols.forEach((c, i) => {
      if (c) row[c] = values[i] ?? "";
    });
    return row;
  });
}

function parseRss(xml: string): Record<string, string>[] {
  const items = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) ?? [];
  const tag = (block: string, name: string) => {
    const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
    return m?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
  };
  return items.map((block) => ({
    title: tag(block, "title"),
    description: tag(block, "description") || tag(block, "summary"),
    link: tag(block, "link") || (/<link[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ?? ""),
    guid: tag(block, "guid") || tag(block, "id"),
    pubDate: tag(block, "pubDate") || tag(block, "updated"),
    startDate: tag(block, "start") || tag(block, "startDate"),
  }));
}

/** Generic authorised partner feed: JSON, RSS/Atom or CSV at a configured URL. */
export const partnerFeedAdapter: SourceAdapter = {
  key: "partner_feed",
  requiredEnv: [],

  async fetch(ctx: AdapterContext): Promise<RawItem[]> {
    const cfg = ctx.source.config as { feed_url?: unknown; format?: unknown; items_path?: unknown; auth_env_key?: unknown; allow_hosts?: unknown };
    const feedUrl = typeof cfg.feed_url === "string" ? cfg.feed_url : ctx.source.base_url;
    if (!feedUrl) throw new AdapterDisabledError("No partner feed URL configured (config.feed_url).");
    const authEnvKey = typeof cfg.auth_env_key === "string" ? cfg.auth_env_key : null;
    if (authEnvKey && !process.env[authEnvKey]) throw new AdapterDisabledError(`Missing credential ${authEnvKey} for this feed.`);
    const headers: Record<string, string> = authEnvKey ? { authorization: `Bearer ${process.env[authEnvKey]}` } : {};
    const allowHosts = Array.isArray(cfg.allow_hosts) ? cfg.allow_hosts.filter((h): h is string => typeof h === "string") : [];

    const res = await withRetry(() => safeFetch(feedUrl, { headers, allowHosts, skipRobots: true, maxBytes: 3_000_000 }));
    const format = (typeof cfg.format === "string" ? cfg.format : "").toLowerCase() || (res.contentType.includes("xml") ? "rss" : res.contentType.includes("csv") ? "csv" : "json");

    let rows: unknown[] = [];
    if (format === "csv") rows = parseCsv(res.body);
    else if (format === "rss" || format === "atom") rows = parseRss(res.body);
    else {
      const json: unknown = JSON.parse(res.body);
      const picked = pluck(json, typeof cfg.items_path === "string" ? cfg.items_path : null);
      rows = Array.isArray(picked) ? picked : Array.isArray(json) ? json : [];
    }
    ctx.log(`Partner feed returned ${rows.length} rows (${format}).`);
    return rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .slice(0, 500)
      .map((raw) => ({ raw, sourceUrl: res.url }));
  },

  parse(item) {
    const raw = item.raw;
    const name = firstString(raw["name"], raw["title"], raw["event_name"]);
    if (!name) return null;
    return { ...raw, name, __sourceUrl: item.sourceUrl } satisfies ParsedItem;
  },

  normalise(parsed) {
    const startsAt = isoOrNull(parsed["start_at"] ?? parsed["startDate"] ?? parsed["starts_at"] ?? parsed["startTime"]);
    const priceMin = numberOrNull(parsed["price_min"] ?? parsed["price"] ?? parsed["min_price"]);
    const venueName = firstString(parsed["venue"], parsed["venue_name"], (parsed["venue"] as Record<string, unknown>)?.["name"]);
    const address = firstString(parsed["address"], parsed["location"]);
    return buildNormalised({
      kind: startsAt ? "event" : "venue",
      name: String(parsed["name"]),
      description: firstString(parsed["description"], parsed["summary"]),
      startsAt,
      endsAt: isoOrNull(parsed["end_at"] ?? parsed["endDate"] ?? parsed["ends_at"]),
      priceMin,
      priceMax: numberOrNull(parsed["price_max"] ?? parsed["max_price"]),
      currency: firstString(parsed["currency"]) ?? "INR",
      venueName,
      areaHint: firstString(parsed["area"], parsed["neighbourhood"], parsed["locality"]),
      address,
      lat: numberOrNull(parsed["lat"] ?? parsed["latitude"]),
      lng: numberOrNull(parsed["lng"] ?? parsed["longitude"]),
      imageUrl: firstString(parsed["image"], parsed["image_url"], parsed["thumbnail"]),
      bookingUrl: firstString(parsed["booking_url"], parsed["ticket_url"], parsed["link"], parsed["url"]),
      websiteUrl: firstString(parsed["website"], parsed["website_url"]),
      categoryHint: firstString(parsed["category"], parsed["genre"], parsed["type"]),
      language: firstString(parsed["language"]),
      ageMin: numberOrNull(parsed["age_min"] ?? parsed["min_age"]),
      organiser: firstString(parsed["organiser"], parsed["organizer"], parsed["promoter"]),
      confirmed: {
        date: !!startsAt,
        price: priceMin !== null,
        venue: !!venueName,
        location: !!address || numberOrNull(parsed["lat"] ?? parsed["latitude"]) !== null,
      },
      sourceText: firstString(parsed["description"], parsed["summary"]),
    });
  },

  getExternalId(parsed) {
    return String(
      firstString(parsed["id"], parsed["guid"], parsed["external_id"], parsed["booking_url"], parsed["link"]) ??
        `${String(parsed["name"])}#${String(parsed["start_at"] ?? parsed["startDate"] ?? "")}`,
    ).slice(0, 300);
  },

  getSourceUrl(parsed) {
    return firstString(parsed["url"], parsed["link"], parsed["__sourceUrl"]);
  },

  getLastModified(parsed) {
    return isoOrNull(parsed["updated_at"] ?? parsed["pubDate"] ?? parsed["modified"]);
  },
};
