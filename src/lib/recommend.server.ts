import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ItemType, Recommendation, SceneItem, SceneQuery, ScoreBreakdown, VenueDetails } from "./scene-types";

type DB = SupabaseClient<Database>;

const SELECT_VENUE =
  "id,slug,name,description,image_url,price_min,price_max,moods,group_types,tags,best_times,opening_hours,booking_url,website_url,source_url,affiliate_link_id,is_sponsored,popularity_score,is_verified,created_at,updated_at,categories(slug,name),areas(slug,name),sponsors(name)" +
  ",address,lat,lng,locality,map_url,phone,email,contact_url,reservation_url,booking_provider,reservations_available,menu_url,events_url,social_urls,special_hours,cuisines,dietary_options,service_type,amenities,dress_code,accessibility,parking,age_restriction,pet_policy,price_band,cover_charge,completeness_score,missing_fields,geo_status,last_verified_at";
const SELECT_EVENT =
  "id,slug,name,description,image_url,price_min,price_max,moods,group_types,tags,starts_at,ends_at,booking_url,source_url,affiliate_link_id,is_sponsored,popularity_score,is_verified,created_at,updated_at,categories(slug,name),areas(slug,name),sponsors(name)";
const SELECT_EXPERIENCE =
  "id,slug,name,description,image_url,price_min,price_max,moods,group_types,tags,best_times,schedule_note,booking_url,source_url,affiliate_link_id,is_sponsored,popularity_score,is_verified,created_at,updated_at,categories(slug,name),areas(slug,name),sponsors(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(row: any, type: ItemType): SceneItem {
  return {
    id: row.id,
    type,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    categorySlug: row.categories?.slug ?? null,
    categoryName: row.categories?.name ?? null,
    areaSlug: row.areas?.slug ?? null,
    areaName: row.areas?.name ?? null,
    priceMin: row.price_min ?? null,
    priceMax: row.price_max ?? null,
    moods: row.moods ?? [],
    groupTypes: row.group_types ?? [],
    tags: row.tags ?? [],
    bestTimes: row.best_times ?? [],
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    scheduleNote: row.schedule_note ?? null,
    openingHours: row.opening_hours ?? null,
    bookingUrl: row.booking_url ?? null,
    websiteUrl: row.website_url ?? null,
    affiliateLinkId: row.affiliate_link_id ?? null,
    isSponsored: !!row.is_sponsored,
    sponsorName: row.sponsors?.name ?? null,
    popularity: Number(row.popularity_score ?? 0),
    isVerified: !!row.is_verified,
    sourceUrl: row.source_url ?? null,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at,
    venue: type === "venue" ? venueDetails(row) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function venueDetails(row: any): VenueDetails {
  return {
    address: row.address ?? null,
    locality: row.locality ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    mapUrl: row.map_url ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    contactUrl: row.contact_url ?? null,
    reservationUrl: row.reservation_url ?? null,
    bookingProvider: row.booking_provider ?? null,
    reservationsAvailable: row.reservations_available ?? null,
    menuUrl: row.menu_url ?? null,
    eventsUrl: row.events_url ?? null,
    socialUrls: (row.social_urls ?? {}) as Record<string, string>,
    hours: row.opening_hours ?? null,
    specialHours: row.special_hours ?? null,
    cuisines: row.cuisines ?? [],
    dietaryOptions: row.dietary_options ?? [],
    serviceType: row.service_type ?? null,
    amenities: row.amenities ?? [],
    dressCode: row.dress_code ?? null,
    accessibility: row.accessibility ?? null,
    parking: row.parking ?? null,
    ageRestriction: row.age_restriction ?? null,
    petPolicy: row.pet_policy ?? null,
    priceBand: row.price_band ?? null,
    coverCharge: row.cover_charge ?? null,
    completeness: row.completeness_score === null || row.completeness_score === undefined ? null : Number(row.completeness_score),
    missingFields: row.missing_fields ?? [],
    geoStatus: row.geo_status ?? null,
    lastVerifiedAt: row.last_verified_at ?? null,
  };
}

export async function getCityId(db: DB, citySlug: string): Promise<string | null> {
  const { data } = await db.from("cities").select("id").eq("slug", citySlug).eq("is_active", true).maybeSingle();
  return data?.id ?? null;
}

export async function fetchCityItems(db: DB, cityId: string, type?: ItemType | undefined): Promise<SceneItem[]> {
  const nowIso = new Date().toISOString();
  const jobs: Promise<SceneItem[]>[] = [];
  if (!type || type === "venue") {
    jobs.push(
      (async () => {
        const r = await db.from("venues").select(SELECT_VENUE).eq("city_id", cityId).eq("is_active", true).limit(300);
        return (r.data ?? []).map((row) => normalize(row, "venue"));
      })(),
    );
  }
  if (!type || type === "event") {
    jobs.push(
      (async () => {
        const r = await db.from("events").select(SELECT_EVENT).eq("city_id", cityId).eq("is_active", true).gte("starts_at", nowIso).order("starts_at", { ascending: true }).limit(300);
        return (r.data ?? []).map((row) => normalize(row, "event"));
      })(),
    );
  }
  if (!type || type === "experience") {
    jobs.push(
      (async () => {
        const r = await db.from("experiences").select(SELECT_EXPERIENCE).eq("city_id", cityId).eq("is_active", true).limit(300);
        return (r.data ?? []).map((row) => normalize(row, "experience"));
      })(),
    );
  }
  const res = await Promise.all(jobs);
  return res.flat();
}

export async function fetchItemBySlug(db: DB, cityId: string, type: ItemType, slug: string): Promise<SceneItem | null> {
  if (type === "venue") {
    const { data } = await db.from("venues").select(SELECT_VENUE).eq("city_id", cityId).eq("slug", slug).maybeSingle();
    return data ? normalize(data, type) : null;
  }
  if (type === "event") {
    const { data } = await db.from("events").select(SELECT_EVENT).eq("city_id", cityId).eq("slug", slug).maybeSingle();
    return data ? normalize(data, type) : null;
  }
  const { data } = await db.from("experiences").select(SELECT_EXPERIENCE).eq("city_id", cityId).eq("slug", slug).maybeSingle();
  return data ? normalize(data, type) : null;
}

// ---------- time window (Asia/Kolkata) ----------
const TZ = "Asia/Kolkata";

function zonedNow(): { date: Date; weekday: number; hour: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", hour: "numeric", hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sat";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 20) % 24;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { date: now, weekday, hour };
}

export function timingWindow(timing?: string): { start: Date; end: Date; daypart: string[]; label: string } | null {
  if (!timing) return null;
  const { date, weekday } = zonedNow();
  const dayMs = 86400000;
  // Compute midnight IST of today
  const istOffset = 5.5 * 3600000;
  const istNow = new Date(date.getTime() + istOffset);
  const midnightIst = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - istOffset;
  const dayStart = (offset: number) => new Date(midnightIst + offset * dayMs);
  const daysUntil = (target: number) => (target - weekday + 7) % 7;
  switch (timing) {
    case "tonight":
      return { start: date, end: new Date(midnightIst + dayMs + 4 * 3600000), daypart: ["evening", "night"], label: "Tonight" };
    case "tomorrow":
      return { start: dayStart(1), end: dayStart(2), daypart: ["day", "evening", "night"], label: "Tomorrow" };
    case "saturday": {
      const d = daysUntil(6);
      return { start: d === 0 ? date : dayStart(d), end: dayStart(d + 1), daypart: ["day", "evening", "night", "weekend"], label: "Saturday" };
    }
    case "sunday": {
      const d = daysUntil(0);
      return { start: d === 0 ? date : dayStart(d), end: dayStart(d + 1), daypart: ["day", "evening", "night", "weekend"], label: "Sunday" };
    }
    case "weekend": {
      const dSat = daysUntil(6);
      const dSun = daysUntil(0);
      const start = weekday === 0 || weekday === 6 ? date : dayStart(dSat);
      const end = dayStart((weekday === 0 ? 0 : dSun) + 1);
      return { start, end, daypart: ["day", "evening", "night", "weekend"], label: "This weekend" };
    }
    default:
      return null;
  }
}

// ---------- scoring ----------
const MOOD_CATEGORY: Record<string, string[]> = {
  party: ["nightlife", "live-music"],
  romantic: ["restaurants", "cafes", "outdoors", "arts-culture"],
  "live-music": ["live-music"],
  comedy: ["comedy"],
  food: ["restaurants", "cafes"],
  outdoors: ["outdoors", "experiences"],
  chill: ["cafes", "outdoors", "arts-culture"],
  "something-new": ["experiences", "arts-culture", "events"],
};

export const WEIGHTS = {
  preference: 0.25,
  budget: 0.15,
  time: 0.15,
  location: 0.15,
  occasion: 0.1,
  freshness: 0.07,
  popularity: 0.08,
  history: 0.05,
} as const;

const AREA_NEIGHBOURS: Record<string, string[]> = {
  bandra: ["khar", "juhu", "bkc"],
  khar: ["bandra", "juhu"],
  juhu: ["khar", "bandra", "versova", "andheri"],
  versova: ["juhu", "andheri"],
  andheri: ["juhu", "versova", "powai"],
  powai: ["andheri"],
  "lower-parel": ["worli"],
  worli: ["lower-parel", "bandra"],
  colaba: ["fort", "marine-drive"],
  fort: ["colaba", "marine-drive"],
  "marine-drive": ["fort", "colaba"],
  bkc: ["bandra"],
};

export function scoreItems(items: SceneItem[], q: SceneQuery): Recommendation[] {
  const window = timingWindow(q.timing);
  const now = Date.now();
  const maxPop = Math.max(1, ...items.map((i) => i.popularity));

  const scored = items.map<Recommendation>((item) => {
    const reasons: string[] = [];
    const b: ScoreBreakdown = { preference: 0, budget: 0, time: 0, location: 0, occasion: 0, freshness: 0, popularity: 0, history: 0 };

    // Preference / mood
    let pref = 0.4;
    if (q.mood) {
      const moodHit = item.moods.includes(q.mood);
      const catHit = !!item.categorySlug && (MOOD_CATEGORY[q.mood] ?? []).includes(item.categorySlug);
      pref = moodHit && catHit ? 1 : moodHit ? 0.85 : catHit ? 0.65 : 0.2;
      if (moodHit) reasons.push(`Tagged ${labelize(q.mood)}`);
      else if (catHit) reasons.push(`${item.categoryName ?? "Category"} fits a ${labelize(q.mood)} mood`);
    }
    if (q.category) {
      pref = item.categorySlug === q.category ? Math.max(pref, 1) : pref * 0.3;
    }
    b.preference = pref;

    // Budget
    let budget = 0.6;
    if (q.budget) {
      const cost = item.priceMax ?? item.priceMin;
      if (cost == null) budget = 0.5;
      else if (cost <= q.budget) {
        budget = 1;
        reasons.push(`Around ₹${formatNum(item.priceMin ?? cost)}${item.priceMax && item.priceMax !== item.priceMin ? `–${formatNum(item.priceMax)}` : ""} per person — inside your budget`);
      } else if (cost <= q.budget * 1.3) budget = 0.5;
      else budget = 0.1;
    }
    b.budget = budget;

    // Time
    let time = 0.6;
    if (window) {
      if (item.type === "event" && item.startsAt) {
        const t = new Date(item.startsAt).getTime();
        const inWindow = t >= window.start.getTime() && t <= window.end.getTime();
        time = inWindow ? 1 : 0;
        if (inWindow) reasons.push(`Happening ${window.label.toLowerCase()}`);
      } else if (item.bestTimes.length) {
        const hit = item.bestTimes.some((bt) => window.daypart.includes(bt));
        time = hit ? 0.9 : 0.4;
        if (hit) reasons.push(`Good for ${window.label.toLowerCase()}`);
      } else time = 0.6;
    }
    b.time = time;

    // Location
    let loc = 0.6;
    if (q.area) {
      if (item.areaSlug === q.area) {
        loc = 1;
        reasons.push(`In ${item.areaName}`);
      } else if (item.areaSlug && (AREA_NEIGHBOURS[q.area] ?? []).includes(item.areaSlug)) {
        loc = 0.7;
        reasons.push(`Close to your area (${item.areaName})`);
      } else loc = 0.15;
    }
    b.location = loc;

    // Occasion / group
    let occ = 0.6;
    if (q.group) {
      occ = item.groupTypes.length === 0 ? 0.5 : item.groupTypes.includes(q.group) ? 1 : 0.2;
      if (occ === 1) reasons.push(`Works well for ${q.group === "solo" ? "going solo" : `a ${q.group}`}`);
    }
    b.occasion = occ;

    // Freshness
    const ageDays = (now - new Date(item.createdAt).getTime()) / 86400000;
    let fresh = Math.max(0, 1 - ageDays / 60);
    if (q.mood === "something-new") fresh = Math.min(1, fresh + 0.3);
    if (ageDays < 14) reasons.push("New on SceneAI");
    b.freshness = fresh;

    // Popularity
    const pop = item.popularity / maxPop;
    if (pop > 0.7) reasons.push("Trending with SceneAI users");
    b.popularity = pop;

    // History
    let hist = 0.5;
    if (q.history) {
      const hits = [
        ...(q.history.moods ?? []).filter((m) => item.moods.includes(m)),
        ...(q.history.areas ?? []).filter((a) => item.areaSlug === a),
        ...(q.history.categories ?? []).filter((c) => item.categorySlug === c),
      ].length;
      hist = Math.min(1, 0.5 + hits * 0.25);
      if (hits > 1) reasons.push("Similar to things you've saved");
    }
    b.history = hist;

    let score =
      b.preference * WEIGHTS.preference +
      b.budget * WEIGHTS.budget +
      b.time * WEIGHTS.time +
      b.location * WEIGHTS.location +
      b.occasion * WEIGHTS.occasion +
      b.freshness * WEIGHTS.freshness +
      b.popularity * WEIGHTS.popularity +
      b.history * WEIGHTS.history;

    // Verified listings are preferred, unverified ones are still shown (and flagged in the UI).
    if (item.isVerified) {
      score *= 1.08;
      if (item.sourceUrl) reasons.push("Details checked against a source");
    } else {
      score *= 0.9;
    }

    // Hard filters
    if (q.type && item.type !== q.type) score = 0;
    if (window && item.type === "event" && time === 0) score = 0;
    if (q.category && item.categorySlug !== q.category) score *= 0.2;

    return { ...item, score: Number(score.toFixed(4)), reasons: dedupe(reasons).slice(0, 3), breakdown: b };
  });

  const organic = scored.filter((s) => s.score > 0.15 && !s.isSponsored).sort((a, c) => c.score - a.score);
  const sponsored = scored.filter((s) => s.score > 0.35 && s.isSponsored).sort((a, c) => c.score - a.score);
  const limit = q.limit ?? 10;
  const out = organic.slice(0, limit);
  // At most one clearly-labelled sponsored placement, slotted at position 3.
  if (sponsored[0]) out.splice(Math.min(2, out.length), 0, sponsored[0]);
  return out.slice(0, Math.max(limit, 5));
}

function dedupe<T>(arr: T[]) {
  return Array.from(new Set(arr));
}
function labelize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function formatNum(n: number) {
  return n.toLocaleString("en-IN");
}
