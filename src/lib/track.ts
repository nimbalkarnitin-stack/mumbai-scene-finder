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
  | "discovery_click" | "conversion" | "itinerary_generated" | "concierge_message" | "preference_set";

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

type LinkItem = { bookingUrl: string | null; websiteUrl?: string | null; name: string; areaName: string | null; affiliateLinkId: string | null; id: string };

/** A real booking link, the venue's own site, or a plain map lookup — never conflated. */
export type OutboundKind = "booking" | "website" | "map";
export interface OutboundLink { url: string; kind: OutboundKind; label: string }

function withTracking(base: string, affiliateLinkId: string | null) {
  try {
    const u = new URL(base);
    u.searchParams.set("utm_source", "sceneai");
    u.searchParams.set("utm_medium", "referral");
    if (affiliateLinkId) u.searchParams.set("sceneai_ref", affiliateLinkId);
    return u.toString();
  } catch {
    return base;
  }
}

/** Resolve where an item's primary button should go, and what that link actually is. */
export function resolveOutboundLink(item: LinkItem): OutboundLink {
  if (item.bookingUrl) return { url: withTracking(item.bookingUrl, item.affiliateLinkId), kind: "booking", label: "Book" };
  if (item.websiteUrl) return { url: withTracking(item.websiteUrl, item.affiliateLinkId), kind: "website", label: "Visit website" };
  // No stored booking link — a map lookup is discovery, not a booking.
  return {
    url: `https://www.google.com/maps/search/${encodeURIComponent(`${item.name} ${item.areaName ?? ""} Mumbai`)}`,
    kind: "map",
    label: "Find on maps",
  };
}

/** Open an outbound link and log it as a booking only when it really is one. */
export function openOutbound(item: LinkItem & { type: ItemType; isSponsored: boolean }, extra: Record<string, unknown> = {}) {
  const link = resolveOutboundLink(item);
  track(link.kind === "booking" ? "booking_click" : "discovery_click", {
    itemType: item.type,
    itemId: item.id,
    metadata: { linkKind: link.kind, affiliate: item.affiliateLinkId, sponsored: item.isSponsored, ...extra },
  });
  window.open(link.url, "_blank", "noopener,noreferrer");
  return link;
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
