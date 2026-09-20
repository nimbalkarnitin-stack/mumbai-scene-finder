/**
 * Geographic sanity checks for the Mumbai catalogue.
 *
 * A venue only belongs to the Mumbai city row when the *source* says so: either its
 * published address/locality names a Mumbai Metropolitan Region place, or its published
 * coordinates fall inside the MMR envelope. Google discovery alone is never enough, and
 * nothing here invents a location — an unclear record stays UNVERIFIED for review.
 */

export type GeoStatus = "VALID" | "OUT_OF_REGION" | "UNVERIFIED";

/** Mumbai Metropolitan Region envelope (Greater Mumbai + Thane + Navi Mumbai belt). */
export const MMR_BOUNDS = { minLat: 18.85, maxLat: 19.45, minLng: 72.75, maxLng: 73.15 } as const;

/** Broader Maharashtra guard used only to explain how far outside a record sits. */
export const MAHARASHTRA_BOUNDS = { minLat: 15.6, maxLat: 22.1, minLng: 72.6, maxLng: 80.9 } as const;

export function inBounds(lat: number, lng: number, b: { minLat: number; maxLat: number; minLng: number; maxLng: number }): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

export function inMumbaiBounds(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return inBounds(lat, lng, MMR_BOUNDS);
}

/** Place names that positively identify the Mumbai Metropolitan Region in an address. */
export const MMR_PLACE_WORDS = [
  "mumbai", "bombay", "navi mumbai", "thane", "mira road", "bhayandar", "bhayander", "vasai", "virar", "kalyan", "dombivli",
  "panvel", "ulhasnagar", "badlapur", "ambernath", "airoli", "vashi", "belapur", "kharghar", "nerul", "sanpada", "turbhe",
  "colaba", "fort", "churchgate", "marine drive", "nariman point", "cuffe parade", "kala ghoda", "ballard estate",
  "girgaon", "grant road", "byculla", "mazgaon", "parel", "lower parel", "worli", "prabhadevi", "dadar", "mahim", "matunga",
  "sion", "wadala", "chembur", "kurla", "ghatkopar", "vikhroli", "vikhroli west", "bhandup", "mulund", "powai", "vidyavihar",
  "bandra", "khar", "santacruz", "vile parle", "juhu", "andheri", "versova", "jogeshwari", "goregaon", "malad", "kandivali",
  "borivali", "dahisar", "bandra kurla", "bkc", "mahalaxmi", "tardeo", "breach candy", "malabar hill", "walkeshwar",
  "kamala mills", "phoenix mills", "seven bungalows", "oshiwara", "lokhandwala", "chakala", "marol", "saki naka", "sakinaka",
  "maharashtra",
] as const;

/** Place names that positively disqualify a record from the Mumbai catalogue. */
export const NON_MMR_PLACE_WORDS = [
  "dubai", "abu dhabi", "sharjah", "sheikh zayed", "united arab emirates", "uae", "doha", "qatar", "riyadh", "jeddah",
  "singapore", "bangkok", "london", "new york", "brooklyn", "manhattan", "los angeles", "san francisco", "chicago",
  "toronto", "sydney", "melbourne", "hong kong", "kuala lumpur", "colombo", "kathmandu",
  "delhi", "new delhi", "gurugram", "gurgaon", "noida", "bengaluru", "bangalore", "hyderabad", "chennai", "kolkata",
  "ahmedabad", "surat", "jaipur", "lucknow", "chandigarh", "kochi", "goa", "panaji", "indore", "bhopal",
] as const;

function haystack(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function matchWords(text: string, words: readonly string[]): string[] {
  return words.filter((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(text));
}

export interface GeoInput {
  name?: string | null;
  address?: string | null;
  locality?: string | null;
  lat?: number | null;
  lng?: number | null;
  websiteUrl?: string | null;
  sourceUrl?: string | null;
}

export interface GeoVerdict {
  status: GeoStatus;
  reasons: string[];
  signals: {
    addressMatch: string | null;
    conflictMatch: string | null;
    coordinatesInMmr: boolean | null;
    coordinatesOutsideMaharashtra: boolean | null;
    domainMatchesName: boolean | null;
  };
}

/**
 * Text-first validation with coordinates as a second, independent signal.
 * Coordinates alone never make a record valid and never alone reject it when the
 * published address clearly names Mumbai (bad geocodes are common).
 */
export function validateMumbaiVenue(input: GeoInput): GeoVerdict {
  const text = haystack(input.address, input.locality, input.name);
  const addressHits = matchWords(text, MMR_PLACE_WORDS);
  const conflictHits = matchWords(text, NON_MMR_PLACE_WORDS);
  const hasCoords = typeof input.lat === "number" && typeof input.lng === "number";
  const inMmr = hasCoords ? inMumbaiBounds(input.lat, input.lng) : null;
  const outsideState = hasCoords ? !inBounds(input.lat as number, input.lng as number, MAHARASHTRA_BOUNDS) : null;
  const domainMatch = input.websiteUrl ? domainMatchesVenueName(input.name ?? "", input.websiteUrl) : null;

  const reasons: string[] = [];
  const signals = {
    addressMatch: addressHits[0] ?? null,
    conflictMatch: conflictHits[0] ?? null,
    coordinatesInMmr: inMmr,
    coordinatesOutsideMaharashtra: outsideState,
    domainMatchesName: domainMatch,
  };

  // A named non-Mumbai city in the address is decisive.
  if (conflictHits.length > 0 && addressHits.length === 0) {
    reasons.push(`Address names ${conflictHits[0]}, not Mumbai`);
    return { status: "OUT_OF_REGION", reasons, signals };
  }
  // Coordinates far outside Maharashtra are decisive too.
  if (outsideState === true) {
    reasons.push(`Coordinates ${input.lat}, ${input.lng} are outside Maharashtra`);
    return { status: "OUT_OF_REGION", reasons, signals };
  }
  if (conflictHits.length > 0 && addressHits.length > 0) {
    reasons.push(`Address mentions both ${addressHits[0]} and ${conflictHits[0]} — needs a human check`);
    return { status: "UNVERIFIED", reasons, signals };
  }
  if (addressHits.length > 0) {
    reasons.push(`Address names ${addressHits[0]}`);
    if (inMmr === false) {
      reasons.push(`but coordinates ${input.lat}, ${input.lng} fall outside the Mumbai region — coordinates need a re-check`);
      return { status: "UNVERIFIED", reasons, signals };
    }
    if (inMmr === true) reasons.push("coordinates fall inside the Mumbai region");
    return { status: "VALID", reasons, signals };
  }
  if (inMmr === true) {
    reasons.push("Coordinates fall inside the Mumbai region, but the address does not name a Mumbai locality");
    return { status: "VALID", reasons, signals };
  }
  reasons.push("No published address or coordinates confirm a Mumbai location");
  return { status: "UNVERIFIED", reasons, signals };
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Weak-but-useful check that an official domain plausibly belongs to the named venue. */
export function domainMatchesVenueName(name: string, url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const domainWord = host.split(".")[0]?.replace(/[^a-z0-9]/g, "") ?? "";
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["the", "bar", "and", "cafe", "club", "bombay", "mumbai", "restaurant", "kitchen"].includes(t));
  if (tokens.length === 0) return false;
  return tokens.some((t) => domainWord.includes(t) || t.includes(domainWord));
}
