import { trackInteraction } from "./scene.functions";
import type { ItemType } from "./scene-types";

const KEY = "vybz.session";
const LEGACY_KEY = "sceneai.session";

export function getSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  let id = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
  }
  window.localStorage.removeItem(LEGACY_KEY);
  return id;
}

export type EventType =
  | "search" | "recommendation_view" | "item_view" | "save" | "unsave" | "share" | "booking_click"
  | "discovery_click" | "conversion" | "itinerary_generated" | "concierge_message" | "preference_set"
  // Monetisation funnel: impression → affiliate click → booking start → conversion → commission.
  | "recommendation_impression" | "affiliate_click" | "booking_start" | "conversion_received"
  | "commission_approved" | "commission_paid" | "sponsored_impression" | "sponsored_click";


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
    u.searchParams.set("utm_source", "vybz");
    u.searchParams.set("utm_medium", "referral");
    if (affiliateLinkId) u.searchParams.set("vybz_ref", affiliateLinkId);
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
  if (item.openingHours) {
    // Venue hours are published per weekday; show today's window in Mumbai time.
    const day = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", weekday: "short" }).slice(0, 3).toLowerCase();
    const today = item.openingHours["today"] ?? item.openingHours[day];
    if (today) return `Today ${today}`;
  }
  if (item.bestTimes.length) return `Best ${item.bestTimes.join(" · ")}`;
  return "Check venue hours";
}

// ---------- monetised outbound links ----------

export interface MonetisedClickOptions {
  partnerSlug?: string | null;
  offerId?: string | null;
  sponsoredListingId?: string | null;
  merchantPartnershipId?: string | null;
  recommendationId?: string | null;
  placement?: string | null;
  campaign?: string | null;
  isSponsored?: boolean;
  /** Set false only if the surface genuinely shows no disclosure (it always should). */
  disclosureShown?: boolean;
}

/**
 * Open an outbound link through the monetisation layer.
 *
 * The click is recorded server-side with full attribution (session, listing,
 * recommendation, placement, campaign, disclosure) and the returned URL is used —
 * which is the partner deep link when a partner is configured AND live, and the
 * plain destination otherwise. Map lookups are never monetised or called bookings.
 */
export async function openOutboundMonetised(
  item: LinkItem & { type: ItemType; isSponsored: boolean },
  opts: MonetisedClickOptions = {},
) {
  const link = resolveOutboundLink(item);
  const win = window.open("about:blank", "_blank");
  if (win) win.opener = null;

  let destinationHost: string | null = null;
  try {
    destinationHost = new URL(link.url).host;
  } catch {
    destinationHost = null;
  }
  const meta = {
    linkKind: link.kind,
    sponsored: opts.isSponsored ?? item.isSponsored,
    placement: opts.placement ?? null,
    destinationHost,
    ...opts,
    // Requested partner; the partner that actually handled the click is added below.
    partnerSlug: opts.partnerSlug ?? null,
  };
  track(link.kind === "booking" ? "booking_click" : "discovery_click", { itemType: item.type, itemId: item.id, metadata: meta });
  if (link.kind === "booking") track("booking_start", { itemType: item.type, itemId: item.id, metadata: meta });
  if (opts.sponsoredListingId) track("sponsored_click", { itemType: item.type, itemId: item.id, metadata: meta });

  let url = link.url;
  try {
    const { recordAffiliateClick } = await import("./monetisation/monetisation.functions");
    const res = await recordAffiliateClick({
      data: {
        destinationUrl: link.url,
        linkKind: link.kind,
        partnerSlug: opts.partnerSlug ?? null,
        offerId: opts.offerId ?? null,
        sponsoredListingId: opts.sponsoredListingId ?? null,
        merchantPartnershipId: opts.merchantPartnershipId ?? null,
        itemType: item.type,
        itemId: item.id,
        recommendationId: opts.recommendationId ?? null,
        sessionId: getSessionId() ?? null,
        placement: opts.placement ?? null,
        campaign: opts.campaign ?? null,
        disclosureShown: opts.disclosureShown ?? true,
        isSponsored: opts.isSponsored ?? item.isSponsored,
      },
    });
    url = res.url;
  } catch {
    // Monetisation must never block the user reaching the venue.
  }

  if (win) win.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
  return link;
}
