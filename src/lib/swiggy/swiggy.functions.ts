/**
 * Swiggy server functions — the only way the browser touches Swiggy.
 *
 * Every function is authenticated; the access token stays on the server. Swiggy-originated
 * responses are returned for the current request only and are never written into My Mood's
 * catalogue, analytics or recommendation-learning data.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MENU_PAGE_SIZE_MAX,
  SwiggyError,
  bookDineoutTableArgs,
  dineoutRestaurantDetailsArgs,
  dineoutSlotsArgs,
  matchDineoutRestaurantToVenue,
  matchRestaurantToVenue,
  normaliseDineoutBooking,
  normaliseDineoutDetails,
  normaliseDineoutSearch,
  normaliseDineoutSlots,
  searchDineoutRestaurantsArgs,
  normaliseAddresses,
  normaliseMenuPage,
  normaliseRestaurantPage,
  openRestaurants,
  restaurantMenuArgs,
  searchMenuArgs,
  searchRestaurantsArgs,
  type SwiggyRestaurant,
} from "./protocol";

function requestOrigin(): string {
  const request = getRequest();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) return `${proto ?? "https"}://${forwardedHost}`;
  return new URL(request.url).origin;
}

/** Turn any failure into a message a user can act on, keeping the class for the UI. */
function fail(err: unknown): never {
  if (err instanceof SwiggyError) throw new Error(`${err.errorClass}: ${err.message}`);
  throw err instanceof Error ? err : new Error(String(err));
}

export const getSwiggyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionState } = await import("./oauth.server");
    return getConnectionState(context.userId);
  });

export const startSwiggyConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ returnPath: z.string().max(300).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { beginAuthorization } = await import("./oauth.server");
    try {
      return await beginAuthorization({ userId: context.userId, origin: requestOrigin(), returnPath: data.returnPath ?? null });
    } catch (err) {
      return fail(err);
    }
  });

export const disconnectSwiggy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectSwiggyAccount } = await import("./oauth.server");
    await disconnectSwiggyAccount(context.userId);
    return { disconnected: true };
  });

export const listSwiggyAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { callSwiggyTool } = await import("./client.server");
    try {
      const payload = await callSwiggyTool({ userId: context.userId, tool: "get_addresses", args: {} });
      // Only the address id and its label are handed back — no raw Swiggy PII is stored.
      return { addresses: normaliseAddresses(payload) };
    } catch (err) {
      return fail(err);
    }
  });

export const searchSwiggyRestaurants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ addressId: z.string().min(1), query: z.string().min(1).max(120), offset: z.number().int().min(0).nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    try {
      const payload = await callSwiggyTool({
        userId: context.userId,
        tool: "search_restaurants",
        args: searchRestaurantsArgs({ addressId: data.addressId, query: data.query, offset: data.offset ?? null }),
      });
      const page = normaliseRestaurantPage(payload);
      // Swiggy: only OPEN restaurants may be presented as currently available.
      return { restaurants: openRestaurants(page.restaurants), closedCount: page.restaurants.length - openRestaurants(page.restaurants).length, nextOffset: page.nextOffset, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return fail(err);
    }
  });

export const getSwiggyMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        addressId: z.string().min(1),
        restaurantId: z.string().min(1),
        page: z.number().int().min(1).nullable().optional(),
        pageSize: z.number().int().min(1).max(MENU_PAGE_SIZE_MAX).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    const page = data.page ?? 1;
    try {
      const payload = await callSwiggyTool({
        userId: context.userId,
        tool: "get_restaurant_menu",
        args: restaurantMenuArgs({ addressId: data.addressId, restaurantId: data.restaurantId, page, pageSize: data.pageSize ?? MENU_PAGE_SIZE_MAX }),
      });
      return { ...normaliseMenuPage(payload, page), page, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return fail(err);
    }
  });

export const searchSwiggyDishes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        addressId: z.string().min(1),
        query: z.string().min(1).max(120),
        restaurantIdOfAddedItem: z.string().nullable().optional(),
        vegFilter: z.boolean().nullable().optional(),
        offset: z.number().int().min(0).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    try {
      const payload = await callSwiggyTool({
        userId: context.userId,
        tool: "search_menu",
        args: searchMenuArgs({
          addressId: data.addressId,
          query: data.query,
          restaurantIdOfAddedItem: data.restaurantIdOfAddedItem ?? null,
          vegFilter: data.vegFilter ?? null,
          offset: data.offset ?? null,
        }),
      });
      const page = normaliseMenuPage(payload, 1);
      return { categories: page.categories, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return fail(err);
    }
  });

/**
 * Live delivery availability for a venue already in My Mood's catalogue.
 * Returns a restaurant only on a confident name match; My Mood's own facts stay canonical.
 */
export const findSwiggyMatchForVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ addressId: z.string().min(1), venueName: z.string().min(2).max(160) }).parse(input))
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    try {
      const payload = await callSwiggyTool({
        userId: context.userId,
        tool: "search_restaurants",
        args: searchRestaurantsArgs({ addressId: data.addressId, query: data.venueName }),
      });
      const page = normaliseRestaurantPage(payload);
      const match: SwiggyRestaurant | null = matchRestaurantToVenue(data.venueName, page.restaurants);
      return { match, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return fail(err);
    }
  });

/**
 * Live, session-only delivery context for a handful of catalogue venues shown in
 * recommendations. Returns nothing but open/ETA/cost hints keyed by My Mood's own venue id;
 * no Swiggy payload is persisted and canonical venue facts are never overwritten.
 */
export const enrichVenuesWithSwiggy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        addressId: z.string().min(1),
        venues: z.array(z.object({ id: z.string().uuid(), name: z.string().min(2).max(160) })).min(1).max(6),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    const live: Record<string, { isOpen: boolean; deliveryTime: string | null; costForTwo: string | null; matchedName: string }> = {};
    for (const venue of data.venues) {
      try {
        const payload = await callSwiggyTool({
          userId: context.userId,
          tool: "search_restaurants",
          args: searchRestaurantsArgs({ addressId: data.addressId, query: venue.name }),
        });
        const match = matchRestaurantToVenue(venue.name, normaliseRestaurantPage(payload).restaurants);
        // Only OPEN restaurants may be surfaced as currently available.
        if (match && match.isOpen) {
          live[venue.id] = { isOpen: true, deliveryTime: match.deliveryTime, costForTwo: match.costForTwo, matchedName: match.name };
        }
      } catch (err) {
        // A Swiggy failure must never degrade canonical recommendations.
        if (err instanceof SwiggyError && (err.errorClass === "NOT_CONNECTED" || err.errorClass === "SESSION_EXPIRED" || err.errorClass === "UNAUTHORIZED")) return fail(err);
      }
    }
    return { live, fetchedAt: new Date().toISOString() };
  });


export const findDineoutMatchForVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ venueName: z.string().min(2).max(160), area: z.string().max(120).nullable().optional(), latitude: z.number(), longitude: z.number() }).parse(input))
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    try {
      const searchPayload = await callSwiggyTool({
        userId: context.userId,
        server: "dineout",
        tool: "search_restaurants_dineout",
        args: searchDineoutRestaurantsArgs({ query: data.venueName, latitude: data.latitude, longitude: data.longitude, limit: 10 }),
      });
      const search = normaliseDineoutSearch(searchPayload);
      const match = matchDineoutRestaurantToVenue(data.venueName, data.area, search.restaurants);
      if (!match) return { match: null, details: null, latitude: search.latitude ?? data.latitude, longitude: search.longitude ?? data.longitude, fetchedAt: new Date().toISOString() };
      const latitude = search.latitude ?? data.latitude;
      const longitude = search.longitude ?? data.longitude;
      const detailsPayload = await callSwiggyTool({ userId: context.userId, server: "dineout", tool: "get_restaurant_details", args: dineoutRestaurantDetailsArgs({ restaurantId: match.id, latitude, longitude }) });
      return { match, details: normaliseDineoutDetails(detailsPayload), latitude, longitude, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return fail(err);
    }
  });

export const getDineoutSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), latitude: z.number(), longitude: z.number() }).parse(input))
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    try {
      const payload = await callSwiggyTool({ userId: context.userId, server: "dineout", tool: "get_available_slots", args: dineoutSlotsArgs(data) });
      return { ...normaliseDineoutSlots(payload), fetchedAt: new Date().toISOString() };
    } catch (err) {
      return fail(err);
    }
  });

export const bookDineoutTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().min(1), slotId: z.number().int(), itemId: z.string().min(1), reservationTime: z.number().int(), guestCount: z.number().int().min(1).max(20), latitude: z.number(), longitude: z.number() }).parse(input))
  .handler(async ({ data, context }) => {
    const { callSwiggyTool } = await import("./client.server");
    try {
      const payload = await callSwiggyTool({ userId: context.userId, server: "dineout", tool: "book_table", args: bookDineoutTableArgs(data) });
      const booking = normaliseDineoutBooking(payload);
      if (!booking) throw new SwiggyError("TOOL_ERROR", "Swiggy did not return a booking confirmation.");
      return { booking, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return fail(err);
    }
  });
