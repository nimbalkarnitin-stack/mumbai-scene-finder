/**
 * Monetisation vocabulary. Client-safe: pure types and constants, no secrets,
 * no server-only imports. Nothing here asserts a commercial fact — commission
 * models, rates and partner capabilities all come from stored configuration.
 */

export type PartnerKind = "affiliate_network" | "direct_merchant" | "venue" | "sponsor";

export type PartnerStatus = "unconfigured" | "configured" | "active" | "paused" | "disabled";

export type CommissionModel = "CPA" | "CPL" | "CPS" | "REVENUE_SHARE" | "BOOKING_FEE" | "FIXED_SPONSORSHIP";

export type ConversionStatus = "pending" | "approved" | "rejected" | "paid";

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "ended";

/** How an outbound link was classified. `map` is discovery, never a booking. */
export type LinkKind = "booking" | "website" | "map" | "offer" | "sponsored";

export const COMMISSION_MODEL_LABEL: Record<CommissionModel, string> = {
  CPA: "CPA — fee per completed action",
  CPL: "CPL — fee per qualified lead",
  CPS: "CPS — fee per sale",
  REVENUE_SHARE: "Revenue share — % of booking value",
  BOOKING_FEE: "Booking fee — fixed fee per booking",
  FIXED_SPONSORSHIP: "Fixed sponsorship — flat campaign fee",
};

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  unconfigured: "Not configured",
  configured: "Configured (not live)",
  active: "Live",
  paused: "Paused",
  disabled: "Disabled",
};

export const CONVERSION_STATUS_LABEL: Record<ConversionStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

/** Fallback disclosures. Live copy is stored in monetisation_settings.disclosure. */
export const DEFAULT_DISCLOSURE = {
  affiliate:
    "Some links on SceneAI are affiliate links. If you book through them SceneAI may earn a commission at no extra cost to you.",
  sponsored:
    "Sponsored placement — paid for by the partner. It is always labelled and kept separate from organic recommendations.",
} as const;

export interface RankingWeightConfig {
  enabled: boolean;
  /** Share of the final score a monetised listing may gain. Kept small on purpose. */
  weight: number;
  /** Hard ceiling on the boost, whatever the weight says. */
  max_boost: number;
}

/** Monetisation must never dominate ranking: relevance-first by construction. */
export const DEFAULT_RANKING_WEIGHT: RankingWeightConfig = { enabled: true, weight: 0.03, max_boost: 0.05 };

/** Absolute ceiling enforced in code, so a bad settings row cannot buy the top slot. */
export const MAX_ALLOWED_MONETISATION_BOOST = 0.05;

export interface AttributionConfig {
  click_dedupe_window_minutes: number;
  conversion_window_days: number;
}

export const DEFAULT_ATTRIBUTION: AttributionConfig = { click_dedupe_window_minutes: 30, conversion_window_days: 30 };

/** Everything needed to build and log an outbound monetised link. */
export interface ClickContext {
  destinationUrl: string;
  linkKind: LinkKind;
  partnerSlug?: string | null;
  offerId?: string | null;
  sponsoredListingId?: string | null;
  merchantPartnershipId?: string | null;
  itemType?: "venue" | "event" | "experience" | null;
  itemId?: string | null;
  recommendationId?: string | null;
  sessionId?: string | null;
  placement?: string | null;
  campaign?: string | null;
  disclosureShown?: boolean;
  isSponsored?: boolean;
}
