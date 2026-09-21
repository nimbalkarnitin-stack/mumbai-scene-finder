import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MENU_PAGE_SIZE_MAX,
  SwiggyError,
  backoffDelayMs,
  bookDineoutTableArgs,
  classifyHttpStatus,
  dineoutRestaurantDetailsArgs,
  dineoutSlotsArgs,
  isRetryable,
  isTokenExpired,
  matchDineoutRestaurantToVenue,
  matchRestaurantToVenue,
  needsReauthorization,
  normaliseAddresses,
  normaliseDineoutBooking,
  normaliseDineoutDetails,
  normaliseDineoutSearch,
  normaliseDineoutSlots,
  normaliseMenuPage,
  normaliseRestaurantPage,
  openRestaurants,
  parseToolResult,
  restaurantMenuArgs,
  searchDineoutRestaurantsArgs,
  searchMenuArgs,
  searchRestaurantsArgs,
} from "./protocol";
import { codeChallengeS256, randomToken, resolveRedirectUri, safeReturnPath } from "./oauth.server";

describe("Swiggy tool arguments", () => {
  it("builds search_restaurants with only documented parameters", () => {
    expect(searchRestaurantsArgs({ addressId: "a1", query: "  biryani  ", offset: 20 })).toEqual({ addressId: "a1", query: "biryani", offset: 20 });
  });

  it("omits offset when absent or zero", () => {
    expect(searchRestaurantsArgs({ addressId: "a1", query: "pizza" })).toEqual({ addressId: "a1", query: "pizza" });
    expect(searchRestaurantsArgs({ addressId: "a1", query: "pizza", offset: 0 })).toEqual({ addressId: "a1", query: "pizza" });
  });

  it("requires addressId and query", () => {
    expect(() => searchRestaurantsArgs({ addressId: "", query: "x" })).toThrow(SwiggyError);
    expect(() => searchRestaurantsArgs({ addressId: "a1", query: "   " })).toThrow(SwiggyError);
  });

  it("caps menu pageSize at the documented maximum", () => {
    expect(restaurantMenuArgs({ addressId: "a1", restaurantId: "r1", page: 2, pageSize: 50 })).toEqual({ addressId: "a1", restaurantId: "r1", page: 2, pageSize: MENU_PAGE_SIZE_MAX });
  });

  it("passes only documented search_menu options", () => {
    expect(searchMenuArgs({ addressId: "a1", query: "paneer", vegFilter: true, restaurantIdOfAddedItem: "r9", offset: 10 })).toEqual({
      addressId: "a1",
      query: "paneer",
      restaurantIdOfAddedItem: "r9",
      vegFilter: true,
      offset: 10,
    });
    expect(searchMenuArgs({ addressId: "a1", query: "paneer" })).toEqual({ addressId: "a1", query: "paneer" });
  });

  it("builds Dineout calls with only documented parameters", () => {
    expect(searchDineoutRestaurantsArgs({ query: " Oye Kake ", latitude: 19.06, longitude: 72.83, limit: 50 })).toEqual({ query: "Oye Kake", latitude: 19.06, longitude: 72.83, limit: 30 });
    expect(dineoutRestaurantDetailsArgs({ restaurantId: "r1", latitude: 19.06, longitude: 72.83 })).toEqual({ restaurantId: "r1", latitude: 19.06, longitude: 72.83 });
    expect(dineoutSlotsArgs({ restaurantId: "r1", date: "2026-09-20", latitude: 19.06, longitude: 72.83 })).toEqual({ restaurantId: "r1", date: "2026-09-20", latitude: 19.06, longitude: 72.83 });
    expect(bookDineoutTableArgs({ restaurantId: "r1", slotId: 9, itemId: "r1-ticket-2", reservationTime: 1789911000, guestCount: 4, latitude: 19.06, longitude: 72.83 })).toEqual({ restaurantId: "r1", slotId: 9, itemId: "r1-ticket-2", reservationTime: 1789911000, guestCount: 4, latitude: 19.06, longitude: 72.83 });
  });

  it("rejects invalid Dineout dates and party sizes", () => {
    expect(() => dineoutSlotsArgs({ restaurantId: "r1", date: "20/09/2026", latitude: 19.06, longitude: 72.83 })).toThrow(SwiggyError);
    expect(() => bookDineoutTableArgs({ restaurantId: "r1", slotId: 9, itemId: "i1", reservationTime: 1, guestCount: 21, latitude: 19.06, longitude: 72.83 })).toThrow(SwiggyError);
  });
});

describe("error classification", () => {
  it("maps documented statuses without inventing a rate-limit class", () => {
    expect(classifyHttpStatus(401)).toBe("UNAUTHORIZED");
    expect(classifyHttpStatus(403)).toBe("FORBIDDEN");
    expect(classifyHttpStatus(419)).toBe("SESSION_EXPIRED");
    expect(classifyHttpStatus(429)).toBe("UNKNOWN");
    expect(classifyHttpStatus(503)).toBe("UPSTREAM_ERROR");
  });

  it("retries only transient upstream failures", () => {
    expect(isRetryable("UPSTREAM_ERROR")).toBe(true);
    expect(isRetryable("TRANSPORT_ERROR")).toBe(true);
    expect(isRetryable("UNAUTHORIZED")).toBe(false);
    expect(isRetryable("INVALID_REQUEST")).toBe(false);
  });

  it("requires re-authorisation for auth failures, since v1.0 has no refresh token", () => {
    expect(needsReauthorization("SESSION_EXPIRED")).toBe(true);
    expect(needsReauthorization("NOT_CONNECTED")).toBe(true);
    expect(needsReauthorization("UPSTREAM_ERROR")).toBe(false);
  });

  it("backs off exponentially with jitter inside a bounded range", () => {
    expect(backoffDelayMs(1, () => 0)).toBe(250);
    expect(backoffDelayMs(1, () => 1)).toBe(500);
    expect(backoffDelayMs(9, () => 1)).toBeLessThanOrEqual(8000);
    for (let attempt = 1; attempt <= 5; attempt++) {
      const d = backoffDelayMs(attempt);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(8000);
    }
  });
});

describe("token expiry", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("treats a missing or past expiry as expired", () => {
    expect(isTokenExpired(null, now)).toBe(true);
    expect(isTokenExpired("2025-12-31T23:59:00Z", now)).toBe(true);
  });
  it("treats the final minute as already expired", () => {
    expect(isTokenExpired("2026-01-01T00:00:30Z", now)).toBe(true);
    expect(isTokenExpired("2026-01-01T00:05:00Z", now)).toBe(false);
  });
});

describe("PKCE and callback safety", () => {
  it("produces a URL-safe verifier and S256 challenge", async () => {
    const verifier = randomToken(32);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    const challenge = await codeChallengeS256("abc123");
    expect(challenge).toBe("bKE9UspwyIPg8LsQHkJaiehiTeUdstI5JZOvaoQRgJA");
    expect(challenge).not.toContain("=");
  });

  it("requires HTTPS except on localhost", () => {
    expect(resolveRedirectUri("https://app.example.com")).toBe("https://app.example.com/api/public/swiggy/callback");
    expect(resolveRedirectUri("http://localhost:8080")).toBe("http://localhost:8080/api/public/swiggy/callback");
    expect(() => resolveRedirectUri("http://app.example.com")).toThrow(SwiggyError);
  });

  it("only accepts same-origin relative return paths", () => {
    expect(safeReturnPath("/v/oye-kake")).toBe("/v/oye-kake");
    expect(safeReturnPath("//evil.example.com")).toBe("/food");
    expect(safeReturnPath("https://evil.example.com")).toBe("/food");
    expect(safeReturnPath(null)).toBe("/food");
  });
});

describe("response reading", () => {
  it("unwraps a text tool result and raises tool errors", () => {
    expect(parseToolResult({ content: [{ type: "text", text: '{"restaurants":[]}' }] })).toEqual({ restaurants: [] });
    expect(() => parseToolResult({ isError: true, content: [{ type: "text", text: "bad address" }] })).toThrow(/bad address/);
  });

  it("normalises addresses without keeping raw address text beyond a label", () => {
    const addresses = normaliseAddresses({ addresses: [{ addressId: "a1", annotation: "Home", area: "Bandra" }, { name: "no id" }] });
    expect(addresses).toEqual([{ id: "a1", label: "Home", area: "Bandra" }]);
  });

  it("filters to OPEN restaurants only", () => {
    const page = normaliseRestaurantPage({
      restaurants: [
        { restaurantId: "1", name: "Open Place", availabilityStatus: "OPEN", sla: "32 mins" },
        { restaurantId: "2", name: "Shut Place", availabilityStatus: "CLOSED" },
      ],
      nextOffset: 20,
    });
    expect(page.nextOffset).toBe(20);
    expect(page.restaurants).toHaveLength(2);
    const open = openRestaurants(page.restaurants);
    expect(open.map((r) => r.name)).toEqual(["Open Place"]);
    expect(open[0]!.deliveryTime).toBe("32 mins");
  });

  it("paginates menu categories and flags variants and add-ons", () => {
    const page = normaliseMenuPage(
      {
        categories: [{ name: "Mains", items: [{ id: "i1", name: "Dal", price: 240, variants: [{ name: "Half" }] }] }],
        totalPages: 3,
      },
      1,
    );
    expect(page.categories[0]!.items[0]).toMatchObject({ name: "Dal", price: 240, hasVariants: true, category: "Mains" });
    expect(page.nextPage).toBe(2);
    expect(normaliseMenuPage({ categories: [], totalPages: 1 }, 1).nextPage).toBeNull();
  });
});

describe("venue matching", () => {
  const list = normaliseRestaurantPage({
    restaurants: [
      { restaurantId: "1", name: "Oye Kake", availabilityStatus: "OPEN" },
      { restaurantId: "2", name: "Bastian Bandra", availabilityStatus: "OPEN" },
    ],
  }).restaurants;

  it("matches on an exact normalised name", () => {
    expect(matchRestaurantToVenue("oye kake!", list)?.id).toBe("1");
  });
  it("matches a contained name prefix", () => {
    expect(matchRestaurantToVenue("Bastian", list)?.id).toBe("2");
  });
  it("never guesses an unrelated venue", () => {
    expect(matchRestaurantToVenue("Soho House Juhu", list)).toBeNull();
    expect(matchRestaurantToVenue("Oy", list)).toBeNull();
  });
});

describe("Dineout live data", () => {
  const search = normaliseDineoutSearch({ success: true, data: { latitude: 19.06, longitude: 72.83, restaurants: [{ id: "d1", name: "Oye Kake Fort", cuisine: ["Punjabi"], locality: "Fort", rating: { value: "4.5" }, offers: [{ offerTitle: "Flat 10%" }] }] } });

  it("normalises search and conservatively matches the venue", () => {
    expect(search.restaurants[0]).toMatchObject({ id: "d1", name: "Oye Kake Fort", rating: "4.5", offers: ["Flat 10%"] });
    expect(matchDineoutRestaurantToVenue("Oye Kake", "Fort", search.restaurants)?.id).toBe("d1");
    expect(matchDineoutRestaurantToVenue("Unrelated", "Fort", search.restaurants)).toBeNull();
  });

  it("normalises details, bookable inventory, and confirmation", () => {
    const details = normaliseDineoutDetails({ success: true, data: { statusCode: 0, data: { restaurantId: "d1", restaurant: { id: "d1", name: "Oye Kake", description: "Punjabi dining", address: "Fort, Mumbai", locality: "Fort", area: "South Mumbai", avgRating: 4.5, totalRatings: "1K+", timings: "12 PM–11 PM", cuisines: ["Punjabi"], imageUrl: "https://images.example/main.jpg", mastheadImageUrls: ["https://images.example/room.jpg", "javascript:bad"], deals: [{ id: 5, title: "Free booking", coverCharge: 0 }] }, menuImages: [{ imageUrl: "https://images.example/menu.jpg", label: "Food menu" }], menuImageGroups: [{ title: "Bar menu", images: [{ imageUrl: "https://images.example/bar.jpg" }] }], amenities: ["Family friendly"] } } });
    expect(details).toMatchObject({ id: "d1", name: "Oye Kake", description: "Punjabi dining", address: "Fort, Mumbai", locality: "Fort", area: "South Mumbai", rating: 4.5, totalRatings: "1K+", imageUrl: "https://images.example/main.jpg", mastheadImageUrls: ["https://images.example/room.jpg"], amenities: ["Family friendly"] });
    expect(details?.menuImages).toEqual([{ imageUrl: "https://images.example/menu.jpg", label: "Food menu" }, { imageUrl: "https://images.example/bar.jpg", label: "Bar menu" }]);

    const slots = normaliseDineoutSlots({ success: true, data: { restaurantId: "d1", latitude: 19.06, longitude: 72.83, slots: [
      { dateStr: "2026-09-20", displayTime: "8:00 PM", reservationTime: 1789911000, availableInventory: 3, deals: [{ itemId: "d1-ticket-1", slotId: 1, isFree: true, bookingPrice: 0, availableInventoryCount: 3 }] },
      { dateStr: "2026-09-20", displayTime: "9:00 PM", reservationTime: 1789914600, availableInventory: 0, deals: [{ itemId: "d1-ticket-2", slotId: 2, isFree: true, bookingPrice: 0 }] },
    ] } });
    expect(slots.slots).toHaveLength(1);
    expect(slots.slots[0]?.deals[0]).toMatchObject({ itemId: "d1-ticket-1", slotId: 1, isFree: true });
    expect(normaliseDineoutBooking({ success: true, data: { orderId: "order-1", isDineout: true, restaurantName: "Oye Kake", guestCount: 2, status: "CONFIRMED" } })).toMatchObject({ orderId: "order-1", guestCount: 2, status: "CONFIRMED" });
  });

  it("never sends credentials as Dineout tool arguments", () => {
    const calls = [
      searchDineoutRestaurantsArgs({ query: "Oye Kake", latitude: 19.06, longitude: 72.83 }),
      dineoutRestaurantDetailsArgs({ restaurantId: "d1", latitude: 19.06, longitude: 72.83 }),
      dineoutSlotsArgs({ restaurantId: "d1", date: "2026-09-20", latitude: 19.06, longitude: 72.83 }),
    ];
    for (const args of calls) expect(Object.keys(args)).not.toContain("token");
  });
});

describe("integration flow (mocked)", () => {
  it("chains search_restaurants -> get_restaurant_menu -> search_menu with session-supplied credentials", async () => {
    const calls: { tool: string; args: Record<string, unknown>; auth: string | null }[] = [];
    const fakeServer = async (tool: string, args: Record<string, unknown>, auth: string | null) => {
      calls.push({ tool, args, auth });
      if (tool === "search_restaurants") {
        return { content: [{ type: "text", text: JSON.stringify({ restaurants: [{ restaurantId: "r1", name: "Oye Kake", availabilityStatus: "OPEN" }], nextOffset: 20 }) }] };
      }
      if (tool === "get_restaurant_menu") {
        return { content: [{ type: "text", text: JSON.stringify({ categories: [{ name: "Rolls", items: [{ id: "i1", name: "Paneer Roll", price: 180 }] }], totalPages: 1 }) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify({ categories: [{ name: "Rolls", items: [{ id: "i1", name: "Paneer Roll", price: 180, isVeg: true }] }] }) }] };
    };

    const addressId = "addr-1";
    const search = normaliseRestaurantPage(parseToolResult(await fakeServer("search_restaurants", searchRestaurantsArgs({ addressId, query: "rolls" }), "Bearer x")));
    const restaurant = openRestaurants(search.restaurants)[0]!;
    const menu = normaliseMenuPage(parseToolResult(await fakeServer("get_restaurant_menu", restaurantMenuArgs({ addressId, restaurantId: restaurant.id, page: 1, pageSize: 8 }), "Bearer x")), 1);
    const dish = normaliseMenuPage(parseToolResult(await fakeServer("search_menu", searchMenuArgs({ addressId, query: "paneer", vegFilter: true }), "Bearer x")), 1);

    expect(restaurant.name).toBe("Oye Kake");
    expect(menu.categories[0]!.items[0]!.price).toBe(180);
    expect(dish.categories[0]!.items[0]!.isVeg).toBe(true);
    // No credential is ever passed as a tool argument.
    for (const c of calls) expect(Object.keys(c.args)).not.toContain("token");
    expect(calls.map((c) => c.tool)).toEqual(["search_restaurants", "get_restaurant_menu", "search_menu"]);
  });
});

describe("live enrichment boundaries", () => {
  const source = readFileSync(new URL("./swiggy.functions.ts", import.meta.url), "utf8");

  it("never writes Swiggy responses into the canonical catalogue", () => {
    for (const table of ["venues", "events", "experiences", "source_records", "discovery_candidates"]) {
      expect(source.includes(`from("${table}")`)).toBe(false);
    }
    expect(source.includes("supabaseAdmin")).toBe(false);
  });

  it("bounds the enrichment batch and requires an address", () => {
    expect(source).toContain("enrichVenuesWithSwiggy");
    expect(source).toMatch(/venues: z\.array\([\s\S]*?\)\.min\(1\)\.max\(6\)/);
    expect(source).toContain("addressId: z.string().min(1)");
  });

  it("only surfaces OPEN restaurants as live delivery context", () => {
    expect(source).toContain("match.isOpen");
    const live = openRestaurants([
      { id: "1", name: "A", availabilityStatus: "OPEN", isOpen: true, cuisines: [], area: null, distance: null, deliveryTime: "30 mins", costForTwo: null, url: null },
      { id: "2", name: "B", availabilityStatus: "CLOSED", isOpen: false, cuisines: [], area: null, distance: null, deliveryTime: null, costForTwo: null, url: null },
    ]);
    expect(live.map((r) => r.id)).toEqual(["1"]);
  });
});
