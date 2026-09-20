import { safeFetch, withRetry } from "../safe-fetch.server";
import { sanitiseText, sanitiseUrl } from "../url-guard";
import { parseOpeningHours, type VenueProfile } from "../venue-profile";
import { buildNormalised, extractJsonLd, firstString, isoOrNull, jsonLdType, numberOrNull, socialLinks, textArray } from "./shared";
import { AdapterDisabledError, type AdapterContext, type ParsedItem, type RawItem, type SourceAdapter } from "./types";

/**
 * Official first-party venue / event pages.
 * Reads only the structured data (schema.org JSON-LD) publishers expose on their own pages,
 * plus the contact / menu / reservation links those same pages publish in their own markup.
 * Honours robots.txt and never touches authenticated, paywalled or private content.
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
        const contacts = extractPageContacts(res.body, res.url);
        const nodes = extractJsonLd(res.body).filter((n) => isUsableNode(n));
        if (nodes.length === 0) ctx.log(`No schema.org records published on ${page}`);
        for (const node of nodes) {
          items.push({ raw: { ...node, __page: res.url, __lastModified: res.lastModified, __contacts: contacts }, sourceUrl: res.url });
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
    const isEvent = EVENT_JSONLD_TYPES.includes(type);
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
      venue: isEvent ? null : venueProfileFrom(parsed, type),
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

/** schema.org types that describe a dated happening. */
export const EVENT_JSONLD_TYPES = [
  "Event", "MusicEvent", "TheaterEvent", "ComedyEvent", "FoodEvent", "Festival",
  "DanceEvent", "ScreeningEvent", "ExhibitionEvent", "SocialEvent", "SportsEvent", "EducationEvent",
];

/** schema.org business/place types that describe a venue we can list. */
export const VENUE_JSONLD_TYPES = [
  "Restaurant", "BarOrPub", "CafeOrCoffeeShop", "NightClub", "LocalBusiness", "TouristAttraction",
  "FoodEstablishment", "Bakery", "Brewery", "Winery", "IceCreamShop", "FastFoodRestaurant",
  "Hotel", "Resort", "LodgingBusiness", "EventVenue", "PerformingArtsTheater", "MovieTheater",
  "Museum", "ArtGallery", "Aquarium", "Zoo", "AmusementPark", "Park", "Casino",
  "EntertainmentBusiness", "SportsActivityLocation", "HealthClub", "BowlingAlley", "StadiumOrArena",
  "ExhibitionHall", "Library", "Church", "PlaceOfWorship", "ShoppingCenter", "Store",
];

/** Generic nodes are only usable when the page also publishes a real address for them. */
const GENERIC_JSONLD_TYPES = ["Organization", "Place", "Corporation"];

/**
 * Decide whether a published JSON-LD node is something the catalogue can describe.
 * Nothing is inferred here: a generic Organization/Place node is only accepted when the page
 * itself publishes an address for it.
 */
export function isUsableNode(node: Record<string, unknown>): boolean {
  const type = jsonLdType(node);
  if (!type) return false;
  if (EVENT_JSONLD_TYPES.includes(type) || VENUE_JSONLD_TYPES.includes(type)) return true;
  if (!GENERIC_JSONLD_TYPES.includes(type)) return false;
  const address = node["address"];
  if (typeof address === "string") return address.trim().length > 8;
  if (address && typeof address === "object") {
    const a = address as Record<string, unknown>;
    return Boolean(firstString(a["streetAddress"]) || firstString(a["addressLocality"]));
  }
  return false;
}

export interface PageContacts {
  phone: string | null;
  email: string | null;
  contactUrl: string | null;
  reservationUrl: string | null;
  menuUrl: string | null;
  eventsUrl: string | null;
  socialUrls: Record<string, string>;
}

const LINK_RE = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi;

/**
 * Read contact / menu / reservation / what's-on links the page itself publishes.
 * Pure link reading on an already-permitted page — no crawling, no guessing a URL that
 * isn't in the markup.
 */
export function extractPageContacts(html: string, pageUrl: string): PageContacts {
  const out: PageContacts = { phone: null, email: null, contactUrl: null, reservationUrl: null, menuUrl: null, eventsUrl: null, socialUrls: {} };
  const sameAs: string[] = [];
  let m: RegExpExecArray | null;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(html)) !== null) {
    const href = m[1]!.trim();
    const label = m[2]!.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (/^tel:/i.test(href)) {
      const digits = href.slice(4).replace(/[^\d+]/g, "");
      if (!out.phone && digits.replace(/\D/g, "").length >= 8) out.phone = digits.slice(0, 20);
      continue;
    }
    if (/^mailto:/i.test(href)) {
      const addr = href.slice(7).split("?")[0]!.trim();
      if (!out.email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(addr)) out.email = addr.slice(0, 120);
      continue;
    }
    const abs = absolute(href, pageUrl);
    if (!abs) continue;
    const target = `${abs.toLowerCase()} ${label}`;
    if (!out.reservationUrl && /(reserv|book[- ]?a[- ]?table|booking|table|opentable|dineout|eazydiner|zomato\.com\/.+\/book)/.test(target)) out.reservationUrl = abs;
    else if (!out.menuUrl && /(menu|food-menu|drinks-menu|our-menu)/.test(target)) out.menuUrl = abs;
    else if (!out.eventsUrl && /(what'?s[- ]?on|events|gigs|line-?up|calendar)/.test(target)) out.eventsUrl = abs;
    else if (!out.contactUrl && /(contact|reach-us|find-us)/.test(target)) out.contactUrl = abs;
    if (/(instagram|facebook|twitter|x\.com|youtube|linkedin|wa\.me|zomato|swiggy|tripadvisor)/.test(abs.toLowerCase())) sameAs.push(abs);
  }
  out.socialUrls = socialLinks(sameAs);
  return out;
}

function absolute(href: string, base: string): string | null {
  if (/^(javascript:|#|data:)/i.test(href)) return null;
  try {
    return sanitiseUrl(new URL(href, base).toString());
  } catch {
    return null;
  }
}

const SERVICE_TYPE_BY_JSONLD: Record<string, string> = {
  Restaurant: "Restaurant",
  BarOrPub: "Bar",
  CafeOrCoffeeShop: "Cafe",
  NightClub: "Nightclub",
  TouristAttraction: "Attraction",
};

/** Build a venue profile strictly from facts published in the page's own structured data / links. */
export function venueProfileFrom(parsed: ParsedItem, type: string): Partial<VenueProfile> | null {
  const contacts = (parsed["__contacts"] ?? {}) as Partial<PageContacts>;
  const address = (parsed["address"] ?? {}) as Record<string, unknown>;
  const hours = parseOpeningHours(parsed["openingHoursSpecification"] ?? parsed["openingHours"]);
  const reservationAction = findAction(parsed["potentialAction"], /Reserve|Order/i);
  const menuAction = firstString(parsed["hasMenu"], (parsed["hasMenu"] as Record<string, unknown>)?.["url"], parsed["menu"]);
  const amenities = textArray(parsed["amenityFeature"], 14, 50);
  const socials = { ...socialLinks(parsed["sameAs"]), ...(contacts.socialUrls ?? {}) };

  const profile: Partial<VenueProfile> = {
    phone: firstString(parsed["telephone"]) ?? contacts.phone ?? null,
    email: firstString(parsed["email"])?.replace(/^mailto:/i, "") ?? contacts.email ?? null,
    contactUrl: contacts.contactUrl ?? null,
    reservationUrl: reservationAction ?? contacts.reservationUrl ?? null,
    bookingProvider: bookingProviderOf(reservationAction ?? contacts.reservationUrl ?? null),
    menuUrl: menuAction ?? contacts.menuUrl ?? null,
    eventsUrl: contacts.eventsUrl ?? null,
    mapUrl: firstString(parsed["hasMap"], (parsed["hasMap"] as Record<string, unknown>)?.["url"]),
    locality: firstString(address["addressLocality"], address["addressRegion"]),
    socialUrls: socials,
    openingHours: hours ?? null,
    reservationsAvailable: typeof parsed["acceptsReservations"] === "boolean"
      ? (parsed["acceptsReservations"] as boolean)
      : typeof parsed["acceptsReservations"] === "string"
        ? /^(true|yes)$/i.test(parsed["acceptsReservations"] as string)
        : reservationAction || contacts.reservationUrl ? true : null,
    cuisines: textArray(parsed["servesCuisine"], 10, 40),
    dietaryOptions: textArray(parsed["hasMenu"] ? [] : [], 8, 40),
    serviceType: SERVICE_TYPE_BY_JSONLD[type] ?? null,
    amenities,
    accessibility: firstString(parsed["accessibilityFeature"], parsed["publicAccess"]),
    priceBand: firstString(parsed["priceRange"]),
  };
  return profile;
}

function findAction(value: unknown, match: RegExp): string | null {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  for (const node of list) {
    if (!node || typeof node !== "object") continue;
    const o = node as Record<string, unknown>;
    if (!match.test(String(o["@type"] ?? ""))) continue;
    const target = o["target"];
    const url = firstString(typeof target === "string" ? target : (target as Record<string, unknown>)?.["urlTemplate"], (target as Record<string, unknown>)?.["url"], o["url"]);
    if (url) return url;
  }
  return null;
}

function bookingProviderOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const known: Record<string, string> = {
      "opentable.com": "OpenTable", "dineout.co.in": "Dineout", "eazydiner.com": "EazyDiner",
      "zomato.com": "Zomato", "bookmyshow.com": "BookMyShow", "in.bookmyshow.com": "BookMyShow",
      "resy.com": "Resy", "sevenrooms.com": "SevenRooms",
    };
    return Object.entries(known).find(([h]) => host === h || host.endsWith(`.${h}`))?.[1] ?? host;
  } catch {
    return null;
  }
}
