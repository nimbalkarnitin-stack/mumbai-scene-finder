/**
 * Attribution primitives: recommendation impression → click → outbound booking →
 * conversion → commission. Pure and deterministic so they can be tested without a
 * database, and idempotent by construction (stable subids + dedupe keys).
 */

import type { AttributionConfig, ClickContext, ConversionStatus } from "./types";
import { DEFAULT_ATTRIBUTION } from "./types";

/** Small, dependency-free 32-bit hash. Only used to build dedupe keys. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

/**
 * Dedupe key for a click: same session + entity + destination inside the same
 * time bucket is the same click. Guarantees one row per genuine click attempt.
 */
export function clickDedupeKey(ctx: ClickContext, at: Date = new Date(), config: AttributionConfig = DEFAULT_ATTRIBUTION): string {
  const windowMs = Math.max(1, config.click_dedupe_window_minutes) * 60_000;
  const bucket = Math.floor(at.getTime() / windowMs);
  const parts = [
    ctx.sessionId ?? "anon",
    ctx.itemType ?? "-",
    ctx.itemId ?? "-",
    ctx.partnerSlug ?? "-",
    ctx.offerId ?? "-",
    ctx.sponsoredListingId ?? "-",
    ctx.destinationUrl,
    ctx.linkKind,
    String(bucket),
  ];
  return `c_${stableHash(parts.join("|"))}_${bucket}`;
}

/** Tracking id passed to the partner. Deterministic from the dedupe key, so retries reuse it. */
export function buildSubid(ctx: ClickContext, at: Date = new Date(), config: AttributionConfig = DEFAULT_ATTRIBUTION): string {
  return `sa-${clickDedupeKey(ctx, at, config).slice(2)}`;
}

export interface ConversionReport {
  partnerSlug: string;
  externalConversionId: string;
  subid: string | null;
  orderValue: number | null;
  commissionAmount: number | null;
  currency: string;
  status: ConversionStatus;
  occurredAt: string | null;
  raw: Record<string, unknown>;
}

export interface ClickRow {
  id: string;
  subid: string;
  partner_id: string | null;
  offer_id: string | null;
  merchant_partnership_id: string | null;
  item_type: string | null;
  item_id: string | null;
  created_at: string;
}

export interface Reconciliation {
  clickId: string | null;
  reconciliationStatus: "matched" | "unmatched" | "outside_window";
  itemType: string | null;
  itemId: string | null;
  offerId: string | null;
  merchantPartnershipId: string | null;
}

/**
 * Match a partner-reported conversion back to the click that produced it.
 * Never guesses: without a subid match the conversion stays unmatched for an admin.
 */
export function reconcileConversion(
  report: ConversionReport,
  clicks: ClickRow[],
  config: AttributionConfig = DEFAULT_ATTRIBUTION,
): Reconciliation {
  const miss: Reconciliation = {
    clickId: null,
    reconciliationStatus: "unmatched",
    itemType: null,
    itemId: null,
    offerId: null,
    merchantPartnershipId: null,
  };
  if (!report.subid) return miss;
  const click = clicks.find((c) => c.subid === report.subid);
  if (!click) return miss;

  const occurred = report.occurredAt ? new Date(report.occurredAt).getTime() : Date.now();
  const clicked = new Date(click.created_at).getTime();
  const windowMs = Math.max(1, config.conversion_window_days) * 86_400_000;
  const withinWindow = occurred >= clicked - 60_000 && occurred - clicked <= windowMs;

  return {
    clickId: click.id,
    reconciliationStatus: withinWindow ? "matched" : "outside_window",
    itemType: click.item_type,
    itemId: click.item_id,
    offerId: click.offer_id,
    merchantPartnershipId: click.merchant_partnership_id,
  };
}

/** Allowed commission state machine. Rejected and paid are terminal. */
const TRANSITIONS: Record<ConversionStatus, ConversionStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  rejected: [],
  paid: [],
};

export function canTransition(from: ConversionStatus, to: ConversionStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export interface FunnelCounts {
  impressions: number;
  clicks: number;
  bookingStarts: number;
  conversions: number;
  approved: number;
  paid: number;
  bookingValue: number;
  commission: number;
}

export interface FunnelMetrics extends FunnelCounts {
  ctr: number;
  conversionRate: number;
  /** Earnings per hundred clicks, the affiliate standard. */
  epc: number;
  averageOrderValue: number;
}

export function funnelMetrics(c: FunnelCounts): FunnelMetrics {
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    ...c,
    ctr: ratio(c.clicks, c.impressions),
    conversionRate: ratio(c.conversions, c.clicks),
    epc: ratio(c.commission, c.clicks),
    averageOrderValue: ratio(c.bookingValue, c.conversions),
  };
}
