import { safeFetch, withRetry } from "../safe-fetch.server";
import { sanitiseText } from "../url-guard";
import { buildNormalised, extractJsonLd, firstString, isoOrNull, jsonLdType, numberOrNull } from "./shared";
import { AdapterDisabledError, type AdapterContext, type ParsedItem, type RawItem, type SourceAdapter } from "./types";

/**
 * Official first-party venue / event pages.
 * Reads only the structured data (schema.org JSON-LD) publishers expose on their own pages,
 * honours robots.txt, and never touches authenticated, paywalled or private content.
 */
export const officialSiteAdapter: SourceAdapter = {
  key: "official_site",
  requiredEnv: [],

  async fetch(ctx: AdapterContext): Promise<RawItem[]> {
    const cfg = ctx.source.config as { pages?: unknown; allow_hosts?: unknown; max_bytes?: unknown; timeout_ms?: unknown; pages_per_run?: unknown; page_cursor?: unknown };
    const all = Array.isArray(cfg.pages) ? cfg.pages.filter((p): p is string => typeof p === "string") : [];
    if (all.length === 0) {
      throw new AdapterDisabledError("No official page URLs configured (config.pages is empty).");
    }
    // Large page lists are read in bounded, rotating batches so every promoted venue
    // gets re-checked over successive runs instead of only the first few.
    const perRun = Math.min(Math.max(numberOrNull(cfg.pages_per_run) ?? 20, 1), 40);
    const cursorRaw = numberOrNull(cfg.page_cursor) ?? 0;
    const cursor = ((Math.trunc(cursorRaw) % all.length) + all.length) % all.length;
    const pages = all.length <= perRun ? all : [...all.slice(cursor), ...all.slice(0, cursor)].slice(0, perRun);
    const allowHosts = Array.isArray(cfg.allow_hosts) ? cfg.allow_hosts.filter((h): h is string => typeof h === "string") : [];
    const items: RawItem[] = [];
    let failures = 0;
    for (const page of pages) {
      try {
        const res = await withRetry(() =>
          safeFetch(page, {
            allowHosts,
            maxBytes: numberOrNull(cfg.max_bytes) ?? 1_500_000,
            timeoutMs: numberOrNull(cfg.timeout_ms) ?? 8000,
          }),
        );
        const nodes = extractJsonLd(res.body).filter((n) => ["Event", "MusicEvent", "TheaterEvent", "ComedyEvent", "FoodEvent", "Festival", "Restaurant", "BarOrPub", "CafeOrCoffeeShop", "NightClub", "LocalBusiness", "TouristAttraction"].includes(jsonLdType(n)));
        if (nodes.length === 0) ctx.log(`No schema.org records published on ${page}`);
        for (const node of nodes) {
          items.push({ raw: { ...node, __page: res.url, __lastModified: res.lastModified }, sourceUrl: res.url });
        }
      } catch (error) {
        // One unreachable venue page must not abandon the rest of the batch.
        failures += 1;
        ctx.log(`Fetch failed for ${page}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures === pages.length) throw new Error(`All ${pages.length} official page(s) failed to fetch.`);
    return items;
  },

  parse(item) {
    const raw = item.raw;
    const name = firstString(raw["name"], raw["headline"]);
    if (!name) return null;
    return { ...raw, name, __sourceUrl: item.sourceUrl } satisfies ParsedItem;
  },

  normalise(parsed) {
    const type = jsonLdType(parsed);
    const isEvent = ["Event", "MusicEvent", "TheaterEvent", "ComedyEvent", "FoodEvent", "Festival"].includes(type);
    // An Event carries its place under `location`; a business node describes itself.
    const location = (isEvent ? parsed["location"] : parsed) as Record<string, unknown> | undefined ?? {};
    const address = (location["address"] ?? {}) as Record<string, unknown>;
    const geo = (location["geo"] ?? {}) as Record<string, unknown>;
    const offers = Array.isArray(parsed["offers"]) ? (parsed["offers"] as Record<string, unknown>[]) : parsed["offers"] ? [parsed["offers"] as Record<string, unknown>] : [];
    const prices = offers.map((o) => numberOrNull(o["price"])).filter((p): p is number => p !== null);
    const startsAt = isoOrNull(parsed["startDate"]);
    const venueName = firstString(location["name"]);
    const addressText = firstString(address["streetAddress"], typeof location["address"] === "string" ? (location["address"] as string) : undefined);

    return buildNormalised({
      kind: isEvent ? "event" : "venue",
      name: String(parsed["name"]),
      description: firstString(parsed["description"]),
      startsAt,
      endsAt: isoOrNull(parsed["endDate"]),
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      currency: firstString(offers[0]?.["priceCurrency"]) ?? "INR",
      venueName,
      areaHint: firstString(address["addressLocality"], address["addressRegion"]),
      address: addressText,
      lat: numberOrNull(geo["latitude"]),
      lng: numberOrNull(geo["longitude"]),
      imageUrl: firstString(parsed["image"], (parsed["image"] as Record<string, unknown>)?.["url"]),
      bookingUrl: firstString(offers[0]?.["url"]),
      websiteUrl: firstString(parsed["url"], parsed["__sourceUrl"]),
      categoryHint: type,
      language: firstString(parsed["inLanguage"]),
      ageMin: numberOrNull(parsed["typicalAgeRange"]),
      organiser: firstString((parsed["organizer"] as Record<string, unknown>)?.["name"], (parsed["performer"] as Record<string, unknown>)?.["name"]),
      confirmed: {
        date: !!startsAt,
        price: prices.length > 0,
        venue: !!venueName,
        location: !!(geo["latitude"] && geo["longitude"]) || !!addressText,
      },
      sourceText: sanitiseText(firstString(parsed["description"]) ?? "", 4000),
    });
  },

  getExternalId(parsed) {
    const url = firstString(parsed["url"], parsed["__sourceUrl"]) ?? "";
    const start = isoOrNull(parsed["startDate"]) ?? "";
    return `${url}#${String(parsed["name"])}#${start}`.slice(0, 300);
  },

  getSourceUrl(parsed) {
    return firstString(parsed["url"], parsed["__sourceUrl"]);
  },

  getLastModified(parsed) {
    return isoOrNull(parsed["dateModified"]) ?? isoOrNull(parsed["__lastModified"]);
  },
};
