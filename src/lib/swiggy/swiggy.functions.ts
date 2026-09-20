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
  matchRestaurantToVenue,
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
