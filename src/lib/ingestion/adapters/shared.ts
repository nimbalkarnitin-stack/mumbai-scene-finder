import { sanitiseText, sanitiseUrl } from "../url-guard";
import { IST_TZ } from "../timezone";
import type { NormalisedRecord } from "../types";
import { DAY_KEYS, type OpeningHours, type VenueProfile } from "../venue-profile";

/** Keep only short, human-readable strings from an array of source values. */
export function textArray(value: unknown, maxItems = 12, maxLen = 60): string[] {
  if (!Array.isArray(value) && typeof value !== "string") return [];
  const raw = Array.isArray(value) ? value : [value];
  const out = new Set<string>();
  for (const v of raw) {
    const text = typeof v === "string" ? v : typeof v === "object" && v ? firstString((v as Record<string, unknown>)["name"]) : null;
    const clean = text ? sanitiseText(text, maxLen) : null;
    if (clean) out.add(clean);
  }
  return [...out].slice(0, maxItems);
}

const SOCIAL_HOSTS: Record<string, string> = {
  "instagram.com": "instagram", "facebook.com": "facebook", "fb.com": "facebook", "twitter.com": "x", "x.com": "x",
  "youtube.com": "youtube", "linkedin.com": "linkedin", "wa.me": "whatsapp", "zomato.com": "zomato",
  "swiggy.com": "swiggy", "tripadvisor.in": "tripadvisor", "tripadvisor.com": "tripadvisor",
};

/** Map `sameAs` links to a small set of known platforms; drop anything unsafe or unknown. */
export function socialLinks(values: unknown): Record<string, string> {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const out: Record<string, string> = {};
  for (const v of list) {
    const url = sanitiseUrl(typeof v === "string" ? v : null);
    if (!url) continue;
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      const key = Object.entries(SOCIAL_HOSTS).find(([h]) => host === h || host.endsWith(`.${h}`))?.[1];
      if (key && !out[key]) out[key] = url;
    } catch {
      // ignore unparseable links
    }
  }
  return out;
}

/** Sanitise a venue profile: URLs validated, text clipped, unknowns left null. */
export function sanitiseVenueProfile(p: Partial<VenueProfile> | null | undefined): VenueProfile | null {
  if (!p) return null;
  const hours = p.openingHours && Object.keys(p.openingHours).length ? pickHours(p.openingHours) : null;
  const profile: VenueProfile = {
    phone: p.phone ? sanitiseText(p.phone, 40) : null,
    email: p.email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(p.email.trim()) ? p.email.trim().slice(0, 120) : null,
    contactUrl: sanitiseUrl(p.contactUrl ?? null),
    reservationUrl: sanitiseUrl(p.reservationUrl ?? null),
    bookingProvider: p.bookingProvider ? sanitiseText(p.bookingProvider, 60) : null,
    menuUrl: sanitiseUrl(p.menuUrl ?? null),
    eventsUrl: sanitiseUrl(p.eventsUrl ?? null),
    mapUrl: sanitiseUrl(p.mapUrl ?? null),
    locality: p.locality ? sanitiseText(p.locality, 80) : null,
    socialUrls: p.socialUrls ?? {},
    openingHours: hours,
    specialHours: p.specialHours ?? null,
    reservationsAvailable: typeof p.reservationsAvailable === "boolean" ? p.reservationsAvailable : null,
    cuisines: textArray(p.cuisines, 10, 40),
    dietaryOptions: textArray(p.dietaryOptions, 8, 40),
    serviceType: p.serviceType ? sanitiseText(p.serviceType, 60) : null,
    amenities: textArray(p.amenities, 14, 50),
    dressCode: p.dressCode ? sanitiseText(p.dressCode, 80) : null,
    accessibility: p.accessibility ? sanitiseText(p.accessibility, 200) : null,
    parking: p.parking ? sanitiseText(p.parking, 120) : null,
    ageRestriction: p.ageRestriction ? sanitiseText(p.ageRestriction, 80) : null,
    petPolicy: p.petPolicy ? sanitiseText(p.petPolicy, 80) : null,
    priceBand: p.priceBand ? sanitiseText(p.priceBand, 20) : null,
    coverCharge: p.coverCharge ? sanitiseText(p.coverCharge, 80) : null,
  };
  const filled = Object.values(profile).some((v) => v !== null && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && v !== null && Object.keys(v).length === 0));
  return filled ? profile : null;
}

function pickHours(hours: OpeningHours): OpeningHours | null {
  const out: OpeningHours = {};
  for (const day of DAY_KEYS) {
    const value = hours[day];
    if (typeof value === "string" && value.trim()) out[day] = value.trim().slice(0, 40);
  }
  return Object.keys(out).length ? out : null;
}

/** Build a normalised record with safe defaults; every unknown fact stays null. */
export function buildNormalised(
  partial: Omit<Partial<NormalisedRecord>, "venue"> & { kind: NormalisedRecord["kind"]; name: string; venue?: Partial<VenueProfile> | null },
): NormalisedRecord {
  const name = sanitiseText(partial.name, 200) ?? "";
  return {
    kind: partial.kind,
    name,
    description: partial.description ? sanitiseText(partial.description) : null,
    startsAt: partial.startsAt ?? null,
    endsAt: partial.endsAt ?? null,
    timezone: partial.timezone ?? IST_TZ,
    priceMin: numberOrNull(partial.priceMin),
    priceMax: numberOrNull(partial.priceMax),
    currency: partial.currency ?? "INR",
    venueName: partial.venueName ? sanitiseText(partial.venueName, 160) : null,
    areaHint: partial.areaHint ? sanitiseText(partial.areaHint, 80) : null,
    address: partial.address ? sanitiseText(partial.address, 300) : null,
    lat: numberOrNull(partial.lat),
    lng: numberOrNull(partial.lng),
    imageUrl: sanitiseUrl(partial.imageUrl ?? null),
    bookingUrl: sanitiseUrl(partial.bookingUrl ?? null),
    websiteUrl: sanitiseUrl(partial.websiteUrl ?? null),
    categoryHint: partial.categoryHint ? sanitiseText(partial.categoryHint, 60) : null,
    language: partial.language ? sanitiseText(partial.language, 40) : null,
    ageMin: numberOrNull(partial.ageMin),
    organiser: partial.organiser ? sanitiseText(partial.organiser, 160) : null,
    moodTags: uniqueSlugs(partial.moodTags),
    occasionTags: uniqueSlugs(partial.occasionTags),
    groupTags: uniqueSlugs(partial.groupTags),
    keywords: uniqueSlugs(partial.keywords),
    confirmed: {
      date: partial.confirmed?.date ?? false,
      price: partial.confirmed?.price ?? false,
      venue: partial.confirmed?.venue ?? false,
      location: partial.confirmed?.location ?? false,
    },
    sourceText: partial.sourceText ? sanitiseText(partial.sourceText, 4000) : null,
    venue: sanitiseVenueProfile(partial.venue),
  };
}

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function uniqueSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string") continue;
    const slug = v.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (slug) out.add(slug);
  }
  return [...out].slice(0, 12);
}

/** Only accept an ISO-parseable date the source actually stated. */
export function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extract JSON-LD blocks from an HTML page (structured data that publishers expose on purpose). */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const body = match[1];
    if (!body) continue;
    try {
      const parsed: unknown = JSON.parse(body.trim());
      const push = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(push);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(push);
        else out.push(obj);
      };
      push(parsed);
    } catch {
      // ignore malformed blocks — never guess at their contents
    }
  }
  return out;
}

export function jsonLdType(node: Record<string, unknown>): string {
  const t = node["@type"];
  if (typeof t === "string") return t;
  if (Array.isArray(t) && typeof t[0] === "string") return t[0];
  return "";
}

export function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return null;
}
