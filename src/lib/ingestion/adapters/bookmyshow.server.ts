import { safeFetch, withRetry } from "../safe-fetch.server";
import { buildNormalised, firstString, isoOrNull, numberOrNull } from "./shared";
import { AdapterDisabledError, missingEnv, type AdapterContext, type ParsedItem, type RawItem, type SourceAdapter } from "./types";

const ENV = ["BOOKMYSHOW_API_BASE_URL", "BOOKMYSHOW_API_KEY"];

/**
 * BookMyShow adapter scaffold.
 * Only talks to an authorised API/feed endpoint supplied by BookMyShow (or an authorised
 * reseller) via secrets. There is no scraping path: with no credentials the adapter stays
 * disabled and BookMyShow is used purely as a deep-link destination on listings that
 * already carry an official BookMyShow booking URL.
 */
export const bookMyShowAdapter: SourceAdapter = {
  key: "bookmyshow",
  requiredEnv: ENV,

  async fetch(ctx: AdapterContext): Promise<RawItem[]> {
    const missing = missingEnv(ENV);
    if (missing.length > 0) {
      throw new AdapterDisabledError(
        `BookMyShow access is not configured. Add ${missing.join(", ")} in Project Settings → Secrets once authorised API/feed access is granted.`,
      );
    }
    const base = process.env["BOOKMYSHOW_API_BASE_URL"]!;
    const key = process.env["BOOKMYSHOW_API_KEY"]!;
    const cfg = ctx.source.config as { city?: unknown; path?: unknown; items_path?: unknown };
    const city = typeof cfg.city === "string" ? cfg.city : "mumbai";
    const path = typeof cfg.path === "string" ? cfg.path : `/events?city=${encodeURIComponent(city)}`;
    const res = await withRetry(() =>
      safeFetch(new URL(path, base).toString(), {
        headers: { authorization: `Bearer ${key}`, accept: "application/json" },
        skipRobots: true,
        maxBytes: 3_000_000,
      }),
    );
    const json: unknown = JSON.parse(res.body);
    const itemsPath = typeof cfg.items_path === "string" ? cfg.items_path : "events";
    const listCandidate = (json as Record<string, unknown>)?.[itemsPath];
    const rows = Array.isArray(listCandidate) ? listCandidate : Array.isArray(json) ? json : [];
    ctx.log(`BookMyShow API returned ${rows.length} events.`);
    return rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((raw) => ({ raw, sourceUrl: firstString(raw["url"], raw["bookingUrl"]) }));
  },

  parse(item) {
    const name = firstString(item.raw["title"], item.raw["name"], item.raw["eventName"]);
    if (!name) return null;
    return { ...item.raw, name, __sourceUrl: item.sourceUrl } satisfies ParsedItem;
  },

  normalise(parsed) {
    const startsAt = isoOrNull(parsed["startTime"] ?? parsed["start_at"] ?? parsed["eventDate"]);
    const priceMin = numberOrNull(parsed["minPrice"] ?? parsed["price"]);
    const venueName = firstString(parsed["venueName"], (parsed["venue"] as Record<string, unknown>)?.["name"]);
    return buildNormalised({
      kind: "event",
      name: String(parsed["name"]),
      description: firstString(parsed["synopsis"], parsed["description"]),
      startsAt,
      endsAt: isoOrNull(parsed["endTime"] ?? parsed["end_at"]),
      priceMin,
      priceMax: numberOrNull(parsed["maxPrice"]),
      venueName,
      areaHint: firstString(parsed["subRegion"], parsed["area"]),
      address: firstString(parsed["venueAddress"], (parsed["venue"] as Record<string, unknown>)?.["address"]),
      lat: numberOrNull(parsed["latitude"]),
      lng: numberOrNull(parsed["longitude"]),
      imageUrl: firstString(parsed["imageUrl"], parsed["image"]),
      bookingUrl: firstString(parsed["bookingUrl"], parsed["url"], parsed["__sourceUrl"]),
      categoryHint: firstString(parsed["genre"], parsed["category"]),
      language: firstString(parsed["language"]),
      ageMin: numberOrNull(parsed["minAge"]),
      organiser: firstString(parsed["organiser"], parsed["promoter"]),
      confirmed: { date: !!startsAt, price: priceMin !== null, venue: !!venueName, location: !!firstString(parsed["venueAddress"]) },
      sourceText: firstString(parsed["synopsis"], parsed["description"]),
    });
  },

  getExternalId(parsed) {
    return String(firstString(parsed["eventCode"], parsed["id"], parsed["bookingUrl"]) ?? String(parsed["name"])).slice(0, 300);
  },

  getSourceUrl(parsed) {
    return firstString(parsed["url"], parsed["bookingUrl"], parsed["__sourceUrl"]);
  },

  getLastModified(parsed) {
    return isoOrNull(parsed["updatedAt"] ?? parsed["lastModified"]);
  },
};
