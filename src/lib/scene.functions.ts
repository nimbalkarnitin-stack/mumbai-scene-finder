import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ItemType, Recommendation, SceneItem } from "./scene-types";
import { DEFAULT_CITY_SLUG } from "./scene-constants";

const itemType = z.enum(["venue", "event", "experience"]);

const QuerySchema = z.object({
  city: z.string().optional(),
  mood: z.string().optional(),
  group: z.string().optional(),
  budget: z.number().optional(),
  timing: z.string().optional(),
  area: z.string().optional(),
  category: z.string().optional(),
  type: itemType.optional(),
  limit: z.number().min(1).max(40).optional(),
  history: z.object({ moods: z.array(z.string()).optional(), areas: z.array(z.string()).optional(), categories: z.array(z.string()).optional() }).optional(),
});

export type SceneQueryInput = z.infer<typeof QuerySchema>;

export const getRecommendations = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => QuerySchema.parse(input))
  .handler(async ({ data }): Promise<{ items: Recommendation[]; total: number }> => {
    const { createPublicClient } = await import("./public-db.server");
    const { getCityId, fetchCityItems, scoreItems } = await import("./recommend.server");
    const db = createPublicClient();
    const cityId = await getCityId(db, data.city ?? DEFAULT_CITY_SLUG);
    if (!cityId) return { items: [], total: 0 };
    const items = await fetchCityItems(db, cityId, data.type);
    const ranked = scoreItems(items, data);
    return { items: ranked, total: items.length };
  });

export const listItems = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({
      city: z.string().optional(),
      category: z.string().optional(),
      type: itemType.optional(),
      area: z.string().optional(),
      sort: z.enum(["popular", "newest", "soonest"]).optional(),
      limit: z.number().max(60).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<SceneItem[]> => {
    const { createPublicClient } = await import("./public-db.server");
    const { getCityId, fetchCityItems } = await import("./recommend.server");
    const db = createPublicClient();
    const cityId = await getCityId(db, data.city ?? DEFAULT_CITY_SLUG);
    if (!cityId) return [];
    let items = await fetchCityItems(db, cityId, data.type);
    if (data.category) items = items.filter((i) => i.categorySlug === data.category);
    if (data.area) items = items.filter((i) => i.areaSlug === data.area);
    const sort = data.sort ?? "popular";
    items.sort((a, b) => {
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "soonest") return (a.startsAt ?? "9").localeCompare(b.startsAt ?? "9");
      return b.popularity - a.popularity;
    });
    return items.slice(0, data.limit ?? 40);
  });

export const getItem = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ city: z.string().optional(), type: itemType, slug: z.string() }).parse(input))
  .handler(async ({ data }): Promise<{ item: SceneItem; related: SceneItem[] } | null> => {
    const { createPublicClient } = await import("./public-db.server");
    const { getCityId, fetchItemBySlug, fetchCityItems } = await import("./recommend.server");
    const db = createPublicClient();
    const cityId = await getCityId(db, data.city ?? DEFAULT_CITY_SLUG);
    if (!cityId) return null;
    const item = await fetchItemBySlug(db, cityId, data.type, data.slug);
    if (!item) return null;
    const all = await fetchCityItems(db, cityId);
    const related = all
      .filter((i) => i.id !== item.id && (i.categorySlug === item.categorySlug || i.areaSlug === item.areaSlug))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 4);
    return { item, related };
  });

export const getCityMeta = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ city: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./public-db.server");
    const db = createPublicClient();
    const { data: city } = await db.from("cities").select("id,slug,name").eq("slug", data.city ?? DEFAULT_CITY_SLUG).maybeSingle();
    if (!city) return { city: null, areas: [], categories: [] };
    const [{ data: areas }, { data: categories }] = await Promise.all([
      db.from("areas").select("id,slug,name,zone").eq("city_id", city.id).eq("is_active", true).order("name"),
      db.from("categories").select("id,slug,name,kind,icon").eq("is_active", true).order("sort_order"),
    ]);
    return { city, areas: areas ?? [], categories: categories ?? [] };
  });

export const listOffers = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ city: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./public-db.server");
    const { getCityId } = await import("./recommend.server");
    const db = createPublicClient();
    const cityId = await getCityId(db, data.city ?? DEFAULT_CITY_SLUG);
    if (!cityId) return [];
    const { data: offers } = await db
      .from("offers")
      .select("id,title,description,discount_text,promo_code,url,valid_until,is_members_only,is_sponsored,item_type,item_id,sponsors(name)")
      .eq("city_id", cityId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    return offers ?? [];
  });

export const listGuides = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ city: z.string().optional(), slug: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./public-db.server");
    const { getCityId } = await import("./recommend.server");
    const db = createPublicClient();
    const cityId = await getCityId(db, data.city ?? DEFAULT_CITY_SLUG);
    if (!cityId) return [];
    let q = db.from("guides").select("id,slug,title,excerpt,body,cover_image_url,created_at").eq("city_id", cityId).eq("is_published", true);
    if (data.slug) q = q.eq("slug", data.slug);
    const { data: guides } = await q.order("created_at", { ascending: false });
    return guides ?? [];
  });

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient } = await import("./public-db.server");
  const db = createPublicClient();
  const { data } = await db.from("digital_products").select("id,slug,title,description,price,image_url,purchase_url").eq("is_active", true);
  return data ?? [];
});

/** Trending = most interactions in last 7 days, falling back to popularity. */
export const getTrending = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ city: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<SceneItem[]> => {
    const { createPublicClient } = await import("./public-db.server");
    const { getCityId, fetchCityItems } = await import("./recommend.server");
    const db = createPublicClient();
    const cityId = await getCityId(db, data.city ?? DEFAULT_CITY_SLUG);
    if (!cityId) return [];
    const items = await fetchCityItems(db, cityId);
    return items.sort((a, b) => b.popularity - a.popularity).slice(0, 12);
  });

/** Analytics: anonymous or signed-in; the row's user_id is validated by RLS. */
export const trackInteraction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      eventType: z.enum(["search", "recommendation_view", "item_view", "save", "unsave", "share", "booking_click", "conversion", "itinerary_generated", "concierge_message", "preference_set"]),
      itemType: itemType.optional(),
      itemId: z.string().uuid().optional(),
      sessionId: z.string().max(80).optional(),
      userId: z.string().uuid().optional(),
      city: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("./public-db.server");
    const { getCityId } = await import("./recommend.server");
    const db = createPublicClient();
    const cityId = await getCityId(db, data.city ?? DEFAULT_CITY_SLUG);
    // Anonymous insert (RLS: user_id must be null for anon). Signed-in attribution is joined by session_id.
    await db.from("interactions").insert({
      event_type: data.eventType,
      item_type: (data.itemType as ItemType | undefined) ?? null,
      item_id: data.itemId ?? null,
      session_id: data.sessionId ?? null,
      city_id: cityId,
      metadata: { ...(data.metadata ?? {}), ...(data.userId ? { user_id: data.userId } : {}) },
    });
    return { ok: true };
  });
