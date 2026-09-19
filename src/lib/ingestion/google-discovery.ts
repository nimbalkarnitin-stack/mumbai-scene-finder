/**
 * Pure helpers for the Google Places (New) DISCOVERY layer.
 *
 * Google is used only to *identify* candidate Mumbai businesses and their own website links.
 * Listing content (reviews, photos, editorial text) is never copied into the MyMood catalogue;
 * authoritative catalogue and event facts always come from the official/authorised source.
 */

/** Secret names accepted for the Places API (New) credential, in priority order. */
export const GOOGLE_KEY_ENV_NAMES = ["GOOGLE_MAPS_API_KEY", "GOOGLE_PLACES_API_KEY"] as const;

/**
 * Explicit FieldMask for Text/Nearby Search — identity + contact + official website only.
 * Deliberately excludes reviews, photos and editorial summaries.
 */
export const GOOGLE_SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
].join(",");

/** Explicit FieldMask for Place Details — requested only when a candidate needs contact/hours detail. */
export const GOOGLE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "websiteUri",
  "googleMapsUri",
  "businessStatus",
  "regularOpeningHours",
  "nationalPhoneNumber",
  "rating",
  "userRatingCount",
].join(",");

export const MUMBAI_AREAS = [
  "Colaba", "Fort", "Kala Ghoda", "Nariman Point", "Marine Drive", "Churchgate", "Cuffe Parade",
  "Mahalaxmi", "Worli", "Lower Parel", "Bandra", "Bandra West", "Bandra East", "Khar", "Santacruz",
  "Juhu", "Vile Parle", "Andheri West", "Andheri East", "Powai", "Goregaon", "Malad", "Kandivali",
  "Borivali", "BKC", "Kurla", "Ghatkopar", "Navi Mumbai", "Vashi", "Thane",
] as const;

/** Mumbai centre, used as the Places location bias so results stay in the city. */
export const MUMBAI_BIAS = { latitude: 19.076, longitude: 72.8777, radiusMetres: 45_000 };

/** Deterministic query text for an area × category pair. */
export function buildQueryText(area: string, category: string): string {
  const a = area.trim();
  const c = category.trim().toLowerCase();
  if (!a || !c) return "";
  return `${c} in ${a}, Mumbai`;
}

export interface BudgetState {
  requestsToday: number;
  requestsThisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
}

/** How many more Google requests may be issued right now (never negative). */
export function requestsRemaining(b: BudgetState): number {
  return Math.max(0, Math.min(b.dailyLimit - b.requestsToday, b.monthlyLimit - b.requestsThisMonth));
}

/** Exponential backoff with a hard ceiling — used for 429/5xx responses only. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(8000, 500 * 2 ** Math.max(0, attempt - 1));
}

/** A 403 from Google is a key/policy problem: retrying cannot fix it. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

export function normaliseEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(the|a|an|pvt|private|ltd|limited|restaurant|cafe|bar|mumbai|india)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalisePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-10);
}

export interface EntitySignals {
  placeId?: string | null;
  name?: string | null;
  domain?: string | null;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export type MatchDecision = "link" | "review" | "separate";

/** Rough metre distance between two coordinates (equirectangular — good enough inside one city). */
export function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const latRad = ((aLat + bLat) / 2) * (Math.PI / 180);
  const x = (bLng - aLng) * Math.cos(latRad) * 111_320;
  const y = (bLat - aLat) * 110_540;
  return Math.sqrt(x * x + y * y);
}

/**
 * Entity resolution across Place ID, name, domain, phone, address and geo.
 * High confidence links, medium goes to review, low stays a separate candidate.
 * Nothing here merges or deletes rows — the caller decides, and only on "link".
 */
export function matchEntities(a: EntitySignals, b: EntitySignals): { score: number; decision: MatchDecision; signals: string[] } {
  const signals: string[] = [];
  if (a.placeId && b.placeId && a.placeId === b.placeId) {
    return { score: 1, decision: "link", signals: ["google_place_id"] };
  }

  let score = 0;
  const nameA = a.name ? normaliseEntityName(a.name) : "";
  const nameB = b.name ? normaliseEntityName(b.name) : "";
  const nameMatch = nameA.length > 2 && nameA === nameB;
  if (nameMatch) { score += 0.4; signals.push("name"); }

  if (a.domain && b.domain && a.domain === b.domain) { score += 0.35; signals.push("domain"); }

  const phoneA = normalisePhone(a.phone);
  const phoneB = normalisePhone(b.phone);
  if (phoneA && phoneB && phoneA === phoneB) { score += 0.3; signals.push("phone"); }

  if (a.address && b.address && normaliseEntityName(a.address) === normaliseEntityName(b.address)) {
    score += 0.15;
    signals.push("address");
  }

  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const d = distanceMetres(a.lat, a.lng, b.lat, b.lng);
    if (d <= 120) { score += 0.2; signals.push("geo"); }
    else if (d > 2000 && nameMatch) { score -= 0.25; signals.push("geo_far"); }
  }

  score = Math.max(0, Math.min(1, score));
  const decision: MatchDecision = score >= 0.8 ? "link" : score >= 0.5 ? "review" : "separate";
  return { score, decision, signals };
}

/** Field-level provenance fields tracked for discovered entities. */
export const TRACKED_PROVENANCE_FIELDS = [
  "name", "address", "location", "website", "phone", "hours",
  "event_title", "event_date", "event_time", "event_venue", "event_price", "event_booking_url",
  "event_description", "event_organiser",
] as const;

/** Analytics event names for the discovery funnel. */
export const GOOGLE_DISCOVERY_EVENTS = {
  started: "google_discovery_started",
  queryExecuted: "google_query_executed",
  candidateFound: "google_candidate_found",
  candidateDuplicate: "google_candidate_duplicate",
  sourceFound: "official_source_found",
  sourceValidated: "official_source_validated",
  sourceFailed: "official_source_failed",
  venueCreated: "venue_created",
  venueLinked: "venue_linked",
  eventDiscovered: "event_discovered",
  eventVerified: "event_verified",
  error: "discovery_error",
} as const;
