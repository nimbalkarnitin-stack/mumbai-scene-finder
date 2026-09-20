/**
 * Swiggy MCP protocol helpers — pure, browser-safe, no secrets.
 *
 * Everything here follows the Swiggy Builders Club reference exactly:
 * Food server tools are `search_restaurants`, `get_restaurant_menu`, `search_menu` and
 * `get_addresses`; session credentials come from the authenticated MCP session and are never
 * tool arguments. No endpoint, tool, parameter or error code is invented here.
 */

export const SWIGGY_SERVERS = {
  food: "https://mcp.swiggy.com/food",
  // Documented sibling server; the same OAuth session is valid for it. Not called yet.
  dineout: "https://mcp.swiggy.com/dineout",
} as const;

export type SwiggyServer = keyof typeof SWIGGY_SERVERS;

/** Swiggy documents pageSize max 8 for get_restaurant_menu. */
export const MENU_PAGE_SIZE_MAX = 8;
/** Docs: retry transient upstream failures with exponential backoff + jitter, max 5 retries. */
export const MAX_RETRIES = 5;

export type SwiggyErrorClass =
  | "NOT_CONNECTED"
  | "SESSION_EXPIRED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "UPSTREAM_ERROR"
  | "TRANSPORT_ERROR"
  | "TOOL_ERROR"
  | "UNKNOWN";

/**
 * Map a real HTTP status onto a class. There is deliberately no RATE_LIMITED class: the MCP
 * layer does not currently enforce 429, and upstream shedding surfaces as UPSTREAM_ERROR.
 */
export function classifyHttpStatus(status: number): SwiggyErrorClass {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 419) return "SESSION_EXPIRED";
  if (status === 400 || status === 404 || status === 422) return "INVALID_REQUEST";
  if (status === 408 || status >= 500) return "UPSTREAM_ERROR";
  if (status >= 200 && status < 300) return "UNKNOWN";
  return "UNKNOWN";
}

export function isRetryable(errorClass: SwiggyErrorClass): boolean {
  return errorClass === "UPSTREAM_ERROR" || errorClass === "TRANSPORT_ERROR";
}

/** A fresh authorization is the only fix — v1.0 issues no refresh tokens. */
export function needsReauthorization(errorClass: SwiggyErrorClass): boolean {
  return errorClass === "UNAUTHORIZED" || errorClass === "SESSION_EXPIRED" || errorClass === "NOT_CONNECTED";
}

/** Exponential backoff with full-range jitter, capped so a retry storm cannot stall a request. */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(500 * 2 ** Math.max(attempt - 1, 0), 8000);
  return Math.round(base / 2 + random() * (base / 2));
}

/** Tokens live 5 days and cannot be refreshed; treat the last minute as already expired. */
export function isTokenExpired(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  const ts = Date.parse(expiresAt);
  return !Number.isFinite(ts) || ts - 60_000 <= now.getTime();
}

export class SwiggyError extends Error {
  readonly errorClass: SwiggyErrorClass;
  readonly httpStatus: number | null;
  constructor(errorClass: SwiggyErrorClass, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = "SwiggyError";
    this.errorClass = errorClass;
    this.httpStatus = httpStatus;
  }
}

/* ------------------------------------------------------------------ tool arguments */

export function searchRestaurantsArgs(input: { addressId: string; query: string; offset?: number | null }): Record<string, unknown> {
  if (!input.addressId) throw new SwiggyError("INVALID_REQUEST", "A Swiggy addressId is required.");
  if (!input.query?.trim()) throw new SwiggyError("INVALID_REQUEST", "A search query is required.");
  const args: Record<string, unknown> = { addressId: input.addressId, query: input.query.trim() };
  if (typeof input.offset === "number" && input.offset > 0) args["offset"] = Math.trunc(input.offset);
  return args;
}

export function restaurantMenuArgs(input: { addressId: string; restaurantId: string; page?: number | null; pageSize?: number | null }): Record<string, unknown> {
  if (!input.addressId) throw new SwiggyError("INVALID_REQUEST", "A Swiggy addressId is required.");
  if (!input.restaurantId) throw new SwiggyError("INVALID_REQUEST", "A Swiggy restaurantId is required.");
  const args: Record<string, unknown> = { addressId: input.addressId, restaurantId: String(input.restaurantId) };
  if (typeof input.page === "number" && input.page > 0) args["page"] = Math.trunc(input.page);
  if (typeof input.pageSize === "number" && input.pageSize > 0) args["pageSize"] = Math.min(Math.trunc(input.pageSize), MENU_PAGE_SIZE_MAX);
  return args;
}

export function searchMenuArgs(input: {
  addressId: string;
  query: string;
  restaurantIdOfAddedItem?: string | null;
  vegFilter?: boolean | null;
  offset?: number | null;
}): Record<string, unknown> {
  if (!input.addressId) throw new SwiggyError("INVALID_REQUEST", "A Swiggy addressId is required.");
  if (!input.query?.trim()) throw new SwiggyError("INVALID_REQUEST", "A dish query is required.");
  const args: Record<string, unknown> = { addressId: input.addressId, query: input.query.trim() };
  if (input.restaurantIdOfAddedItem) args["restaurantIdOfAddedItem"] = String(input.restaurantIdOfAddedItem);
  if (typeof input.vegFilter === "boolean") args["vegFilter"] = input.vegFilter;
  if (typeof input.offset === "number" && input.offset > 0) args["offset"] = Math.trunc(input.offset);
  return args;
}

/* ------------------------------------------------------------------ response reading */

export interface SwiggyAddress {
  id: string;
  label: string | null;
  area: string | null;
}

export interface SwiggyRestaurant {
  id: string;
  name: string;
  availabilityStatus: string | null;
  isOpen: boolean;
  cuisines: string[];
  area: string | null;
  distance: string | null;
  deliveryTime: string | null;
  costForTwo: string | null;
  url: string | null;
}

export interface SwiggyMenuItem {
  id: string | null;
  name: string;
  price: number | null;
  description: string | null;
  isVeg: boolean | null;
  hasVariants: boolean;
  hasAddons: boolean;
  category: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function num(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Read the payload out of an MCP tools/call result without assuming a single shape. */
export function parseToolResult(result: unknown): unknown {
  const r = asRecord(result);
  if (r["isError"] === true) {
    const text = list(r["content"]).map((c) => str(asRecord(c)["text"])).filter(Boolean).join(" ");
    throw new SwiggyError("TOOL_ERROR", text || "Swiggy returned a tool error.");
  }
  if (r["structuredContent"] !== undefined) return r["structuredContent"];
  for (const part of list(r["content"])) {
    const p = asRecord(part);
    if (p["type"] === "text" && typeof p["text"] === "string") {
      try {
        return JSON.parse(p["text"] as string);
      } catch {
        return p["text"];
      }
    }
  }
  return r["result"] ?? result;
}

function firstArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const p = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(p[key])) return p[key] as unknown[];
  }
  for (const value of Object.values(p)) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = asRecord(value);
      for (const key of keys) if (Array.isArray(nested[key])) return nested[key] as unknown[];
    }
  }
  return [];
}

export function normaliseAddresses(payload: unknown): SwiggyAddress[] {
  return firstArray(payload, ["addresses", "data", "items"])
    .map((raw) => {
      const a = asRecord(raw);
      const id = str(a["addressId"], a["id"]);
      if (!id) return null;
      return {
        id,
        label: str(a["annotation"], a["name"], a["label"], a["addressLine1"], a["address"]),
        area: str(a["area"], a["locality"], a["city"]),
      } satisfies SwiggyAddress;
    })
    .filter((a): a is SwiggyAddress => a !== null);
}

export function normaliseRestaurant(raw: unknown): SwiggyRestaurant | null {
  const r = asRecord(raw);
  const id = str(r["restaurantId"], r["id"]);
  const name = str(r["restaurantName"], r["name"]);
  if (!id || !name) return null;
  const status = str(r["availabilityStatus"], r["status"]);
  return {
    id,
    name,
    availabilityStatus: status,
    isOpen: (status ?? "").toUpperCase() === "OPEN",
    cuisines: list(r["cuisines"] ?? r["cuisine"]).map((c) => str(c) ?? "").filter(Boolean).slice(0, 6),
    area: str(r["area"], r["locality"], r["areaName"]),
    distance: str(r["distance"], r["distanceInKm"], r["distanceString"]),
    deliveryTime: str(r["deliveryTime"], r["sla"], r["slaString"], r["eta"]),
    costForTwo: str(r["costForTwo"], r["costForTwoString"]),
    url: str(r["url"], r["deeplink"], r["link"]),
  };
}

export interface RestaurantPage {
  restaurants: SwiggyRestaurant[];
  nextOffset: number | null;
}

export function normaliseRestaurantPage(payload: unknown): RestaurantPage {
  const restaurants = firstArray(payload, ["restaurants", "results", "data", "items"])
    .map(normaliseRestaurant)
    .filter((r): r is SwiggyRestaurant => r !== null);
  const p = asRecord(payload);
  const nested = asRecord(p["data"]);
  return { restaurants, nextOffset: num(p["nextOffset"], nested["nextOffset"]) };
}

/** Swiggy: only OPEN restaurants may be presented as currently available. */
export function openRestaurants(restaurants: SwiggyRestaurant[]): SwiggyRestaurant[] {
  return restaurants.filter((r) => r.isOpen);
}

export interface MenuPage {
  categories: { name: string | null; items: SwiggyMenuItem[] }[];
  nextPage: number | null;
  totalPages: number | null;
}

export function normaliseMenuPage(payload: unknown, currentPage = 1): MenuPage {
  const p = asRecord(payload);
  const rawCategories = firstArray(payload, ["categories", "menu", "menuCategories", "data", "items"]);
  const categories = rawCategories.map((rawCat) => {
    const c = asRecord(rawCat);
    const itemsRaw = Array.isArray(c["items"]) ? (c["items"] as unknown[]) : [rawCat];
    const items = itemsRaw
      .map((rawItem) => {
        const i = asRecord(rawItem);
        const name = str(i["name"], i["itemName"], i["title"]);
        if (!name) return null;
        return {
          id: str(i["id"], i["itemId"]),
          name,
          price: num(i["price"], i["finalPrice"], i["defaultPrice"]),
          description: str(i["description"]),
          isVeg: typeof i["isVeg"] === "boolean" ? (i["isVeg"] as boolean) : str(i["itemAttribute"], i["vegClassifier"])?.toUpperCase() === "VEG" ? true : null,
          hasVariants: list(i["variants"] ?? i["variantGroups"]).length > 0 || i["hasVariants"] === true,
          hasAddons: list(i["addons"] ?? i["addonGroups"]).length > 0 || i["hasAddons"] === true,
          category: str(c["name"], c["categoryName"], i["category"]),
        } satisfies SwiggyMenuItem;
      })
      .filter((i): i is SwiggyMenuItem => i !== null);
    return { name: str(c["name"], c["categoryName"]), items };
  }).filter((c) => c.items.length > 0);

  const totalPages = num(p["totalPages"], asRecord(p["data"])["totalPages"]);
  const hasMore = p["hasMore"] === true || (totalPages !== null && currentPage < totalPages);
  return { categories, nextPage: hasMore ? currentPage + 1 : null, totalPages };
}

/* ------------------------------------------------------------------ catalogue matching */

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Find the Swiggy restaurant that is confidently the same business as a My Mood venue.
 * Exact normalised match, or one name fully containing the other. Never a fuzzy guess —
 * an unmatched venue simply shows no live Swiggy section.
 */
export function matchRestaurantToVenue(venueName: string, restaurants: SwiggyRestaurant[]): SwiggyRestaurant | null {
  const target = normaliseName(venueName);
  if (target.length < 3) return null;
  const exact = restaurants.find((r) => normaliseName(r.name) === target);
  if (exact) return exact;
  return (
    restaurants.find((r) => {
      const n = normaliseName(r.name);
      return n.length >= 4 && (n.startsWith(`${target} `) || target.startsWith(`${n} `));
    }) ?? null
  );
}
