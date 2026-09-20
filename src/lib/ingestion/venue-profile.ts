/**
 * The complete venue profile MyMood wants to show, plus a transparent completeness score.
 *
 * Completeness is deliberately separate from verification/quality: it measures how much of
 * the profile a permitted source has actually filled in, and is never used as a popularity
 * or ranking signal. Nothing here fabricates a value — unknown stays null.
 */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type OpeningHours = Partial<Record<DayKey, string>>;

export interface VenueProfile {
  phone: string | null;
  email: string | null;
  contactUrl: string | null;
  reservationUrl: string | null;
  bookingProvider: string | null;
  menuUrl: string | null;
  eventsUrl: string | null;
  mapUrl: string | null;
  locality: string | null;
  socialUrls: Record<string, string>;
  openingHours: OpeningHours | null;
  specialHours: Record<string, string> | null;
  reservationsAvailable: boolean | null;
  cuisines: string[];
  dietaryOptions: string[];
  serviceType: string | null;
  amenities: string[];
  dressCode: string | null;
  accessibility: string | null;
  parking: string | null;
  ageRestriction: string | null;
  petPolicy: string | null
  priceBand: string | null;
  coverCharge: string | null;
}

export function emptyVenueProfile(): VenueProfile {
  return {
    phone: null, email: null, contactUrl: null, reservationUrl: null, bookingProvider: null, menuUrl: null,
    eventsUrl: null, mapUrl: null, locality: null, socialUrls: {}, openingHours: null, specialHours: null,
    reservationsAvailable: null, cuisines: [], dietaryOptions: [], serviceType: null, amenities: [],
    dressCode: null, accessibility: null, parking: null, ageRestriction: null, petPolicy: null,
    priceBand: null, coverCharge: null,
  };
}

/** Published weights. Total = 100. */
export const COMPLETENESS_WEIGHTS = {
  identity: 10,
  official_source: 10,
  location: 15,
  contact: 10,
  hours: 10,
  booking: 10,
  price: 10,
  description: 5,
  classification: 5,
  discovery_fit: 5,
  images: 5,
  provenance: 5,
} as const;

export type CompletenessGroup = keyof typeof COMPLETENESS_WEIGHTS;

/** Shape read from the venues table (snake_case), so the same scorer works in admin and pipeline. */
export interface VenueRowLike {
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  locality?: string | null;
  website_url?: string | null;
  source_url?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_url?: string | null;
  opening_hours?: unknown;
  reservation_url?: string | null;
  booking_url?: string | null;
  menu_url?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  price_band?: string | null;
  description?: string | null;
  category_id?: string | null;
  service_type?: string | null;
  cuisines?: string[] | null;
  moods?: string[] | null;
  tags?: string[] | null;
  group_types?: string[] | null;
  best_times?: string[] | null;
  image_url?: string | null;
  source_last_checked_at?: string | null;
  verification_status?: string | null;
}

export interface CompletenessResult {
  score: number;
  groups: { group: CompletenessGroup; weight: number; earned: number; missing: string[] }[];
  missing: string[];
}

const has = (v: unknown) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Transparent, auditable completeness score with the exact missing field names. */
export function scoreVenueCompleteness(v: VenueRowLike): CompletenessResult {
  const groups: CompletenessResult["groups"] = [];
  const add = (group: CompletenessGroup, checks: { field: string; ok: boolean }[]) => {
    const weight = COMPLETENESS_WEIGHTS[group];
    const hit = checks.filter((c) => c.ok).length;
    groups.push({
      group,
      weight,
      earned: checks.length === 0 ? 0 : Number(((hit / checks.length) * weight).toFixed(2)),
      missing: checks.filter((c) => !c.ok).map((c) => c.field),
    });
  };

  add("identity", [{ field: "name", ok: has(v.name) }]);
  add("official_source", [
    { field: "website_url", ok: has(v.website_url) },
    { field: "source_url", ok: has(v.source_url) },
  ]);
  add("location", [
    { field: "address", ok: has(v.address) },
    { field: "lat/lng", ok: has(v.lat) && has(v.lng) },
    { field: "locality", ok: has(v.locality) },
  ]);
  add("contact", [
    { field: "phone", ok: has(v.phone) },
    { field: "email/contact_url", ok: has(v.email) || has(v.contact_url) },
  ]);
  add("hours", [{ field: "opening_hours", ok: has(v.opening_hours) }]);
  add("booking", [
    { field: "reservation_url/booking_url", ok: has(v.reservation_url) || has(v.booking_url) },
    { field: "menu_url", ok: has(v.menu_url) },
  ]);
  add("price", [{ field: "price_min/price_band", ok: has(v.price_min) || has(v.price_max) || has(v.price_band) }]);
  add("description", [{ field: "description", ok: has(v.description) }]);
  add("classification", [
    { field: "category", ok: has(v.category_id) },
    { field: "service_type/cuisines", ok: has(v.service_type) || has(v.cuisines) },
  ]);
  add("discovery_fit", [
    { field: "moods", ok: has(v.moods) },
    { field: "group_types", ok: has(v.group_types) },
    { field: "tags/best_times", ok: has(v.tags) || has(v.best_times) },
  ]);
  add("images", [{ field: "image_url", ok: has(v.image_url) }]);
  add("provenance", [
    { field: "source_last_checked_at", ok: has(v.source_last_checked_at) },
    { field: "verification_status", ok: has(v.verification_status) && v.verification_status !== "UNVERIFIED" },
  ]);

  const score = Number(groups.reduce((n, g) => n + g.earned, 0).toFixed(1));
  return { score, groups, missing: groups.flatMap((g) => g.missing) };
}

// ---------- opening hours ----------

const DAY_ALIASES: Record<string, DayKey> = {
  monday: "mon", mon: "mon", tuesday: "tue", tue: "tue", tues: "tue", wednesday: "wed", wed: "wed",
  thursday: "thu", thu: "thu", thur: "thu", thurs: "thu", friday: "fri", fri: "fri",
  saturday: "sat", sat: "sat", sunday: "sun", sun: "sun",
};

export function dayKeyOf(value: unknown): DayKey | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase().replace(/^https?:\/\/schema\.org\//, "");
  return DAY_ALIASES[raw] ?? null;
}

function hhmm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (!Number.isFinite(h) || h > 24) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * Parse schema.org opening hours into a day → "HH:MM–HH:MM" map.
 * Accepts `openingHoursSpecification` objects and the plain `openingHours` string form
 * ("Mo-Su 12:00-23:30"). Anything unparseable is dropped rather than guessed.
 */
export function parseOpeningHours(spec: unknown): OpeningHours | null {
  const out: OpeningHours = {};

  const applySpec = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const opens = hhmm(o["opens"]);
    const closes = hhmm(o["closes"]);
    if (!opens || !closes) return;
    const days = Array.isArray(o["dayOfWeek"]) ? o["dayOfWeek"] : [o["dayOfWeek"]];
    for (const d of days) {
      const key = dayKeyOf(d);
      if (key) out[key] = `${opens}–${closes}`;
    }
  };

  const applyString = (text: string) => {
    // "Mo-Su 12:00-23:30" / "Monday,Tuesday 18:00-01:00"
    const re = /([A-Za-z]{2,9})\s*(?:[-–]\s*([A-Za-z]{2,9}))?\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g;
    let m: RegExpExecArray | null;
    const short: Record<string, DayKey> = { mo: "mon", tu: "tue", we: "wed", th: "thu", fr: "fri", sa: "sat", su: "sun" };
    const keyFor = (token: string) => dayKeyOf(token) ?? short[token.slice(0, 2).toLowerCase()] ?? null;
    while ((m = re.exec(text)) !== null) {
      const from = keyFor(m[1]!);
      const to = m[2] ? keyFor(m[2]) : null;
      const opens = hhmm(m[3]);
      const closes = hhmm(m[4]);
      if (!from || !opens || !closes) continue;
      const range = `${opens}–${closes}`;
      if (!to) {
        out[from] = range;
        continue;
      }
      const start = DAY_KEYS.indexOf(from);
      const end = DAY_KEYS.indexOf(to);
      for (let i = 0; i < 7; i += 1) {
        const idx = (start + i) % 7;
        out[DAY_KEYS[idx]!] = range;
        if (idx === end) break;
      }
    }
  };

  const nodes = Array.isArray(spec) ? spec : [spec];
  for (const node of nodes) {
    if (typeof node === "string") applyString(node);
    else applySpec(node);
  }
  return Object.keys(out).length ? out : null;
}

export function todayKey(now = new Date(), timeZone = "Asia/Kolkata"): DayKey {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now).toLowerCase();
  return (dayKeyOf(wd) ?? "mon") as DayKey;
}

/**
 * Today's published hours and whether the venue is open right now.
 * Returns `open: null` when the stored hours can't be read reliably — never a guess.
 */
export function todayStatus(hours: OpeningHours | null, now = new Date(), timeZone = "Asia/Kolkata"): { day: DayKey; range: string | null; open: boolean | null } {
  const day = todayKey(now, timeZone);
  const range = hours?.[day] ?? null;
  if (!range) return { day, range: null, open: null };
  const m = /^(\d{2}):(\d{2})–(\d{2}):(\d{2})$/.exec(range);
  if (!m) return { day, range, open: null };
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const [h, mi] = parts.split(":").map(Number);
  const nowMin = (h ?? 0) * 60 + (mi ?? 0);
  const open = Number(m[1]) * 60 + Number(m[2]);
  let close = Number(m[3]) * 60 + Number(m[4]);
  if (close <= open) close += 24 * 60; // past-midnight closing
  const shifted = nowMin < open ? nowMin + 24 * 60 : nowMin;
  return { day, range, open: shifted >= open && shifted <= close };
}

export const DAY_LABEL: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
