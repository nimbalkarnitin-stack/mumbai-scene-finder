import { trackInteraction } from "./scene.functions";
import type { ItemType } from "./scene-types";

const KEY = "sceneai.session";

export function getSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export type EventType =
  | "search" | "recommendation_view" | "item_view" | "save" | "unsave" | "share" | "booking_click"
  | "conversion" | "itinerary_generated" | "concierge_message" | "preference_set";

export function track(eventType: EventType, opts: { itemType?: ItemType | undefined; itemId?: string | undefined; metadata?: Record<string, unknown> | undefined } = {}) {
  if (typeof window === "undefined") return;
  const data: { eventType: EventType; sessionId?: string; itemType?: ItemType; itemId?: string; metadata?: Record<string, unknown> } = { eventType };
  const sid = getSessionId();
  if (sid) data.sessionId = sid;
  if (opts.itemType) data.itemType = opts.itemType;
  if (opts.itemId) data.itemId = opts.itemId;
  if (opts.metadata) data.metadata = opts.metadata;
  void trackInteraction({ data }).catch(() => {});
}

/** Build the outbound booking URL, adding affiliate tracking when configured. */
export function buildBookingUrl(item: { bookingUrl: string | null; websiteUrl?: string | null; name: string; areaName: string | null; affiliateLinkId: string | null; id: string }) {
  const base = item.bookingUrl ?? item.websiteUrl;
  if (base) {
    try {
      const u = new URL(base);
      u.searchParams.set("utm_source", "sceneai");
      u.searchParams.set("utm_medium", "referral");
      if (item.affiliateLinkId) u.searchParams.set("sceneai_ref", item.affiliateLinkId);
      return u.toString();
    } catch {
      return base;
    }
  }
  // No verified booking link yet — send the user to a maps search rather than inventing one.
  return `https://www.google.com/maps/search/${encodeURIComponent(`${item.name} ${item.areaName ?? ""} Mumbai`)}`;
}

export function formatPrice(min: number | null, max: number | null) {
  if (min == null && max == null) return "Price on request";
  if (min != null && max != null && min !== max) return `₹${min.toLocaleString("en-IN")}–${max.toLocaleString("en-IN")}`;
  const v = (min ?? max) as number;
  return v === 0 ? "Free" : `₹${v.toLocaleString("en-IN")}`;
}

export function formatWhen(item: { startsAt: string | null; scheduleNote: string | null; openingHours: Record<string, string> | null; bestTimes: string[] }) {
  if (item.startsAt) {
    const d = new Date(item.startsAt);
    return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }
  if (item.scheduleNote) return item.scheduleNote;
  if (item.openingHours?.["today"]) return item.openingHours["today"];
  if (item.bestTimes.length) return `Best ${item.bestTimes.join(" · ")}`;
  return "Check venue hours";
}
