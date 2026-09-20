/** Shared ingestion vocabulary. Client-safe: no secrets, no server-only imports. */

import type { VenueProfile } from "./venue-profile";

export type VerificationState = "VERIFIED" | "PARTIALLY_VERIFIED" | "REVIEW_REQUIRED" | "STALE" | "UNVERIFIED";

export type EventLifecycle =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "SOLD_OUT"
  | "POSTPONED"
  | "CANCELLED"
  | "EXPIRED";

export type SourceType =
  | "official_site"
  | "organiser_submission"
  | "partner_feed"
  | "ticketing_api"
  | "social_api"
  | "discovery";

export type ReviewStatus = "new" | "needs_review" | "approved" | "rejected" | "published" | "changed";

export type ItemKind = "venue" | "event" | "experience";

/** Human-readable trust wording for public surfaces. Never claim verification we don't have. */
export function trustLabel(state: VerificationState): { label: string; tone: "good" | "warn" | "muted" } {
  switch (state) {
    case "VERIFIED":
      return { label: "Verified", tone: "good" };
    case "PARTIALLY_VERIFIED":
      return { label: "Confirmed by one source only", tone: "warn" };
    case "REVIEW_REQUIRED":
      return { label: "Details may have changed — confirm with venue", tone: "warn" };
    case "STALE":
      return { label: "Not re-checked recently — confirm with venue", tone: "warn" };
    default:
      return { label: "Unverified — confirm with venue", tone: "muted" };
  }
}

export const LIFECYCLE_LABEL: Record<EventLifecycle, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  ACTIVE: "Active",
  SOLD_OUT: "Sold out",
  POSTPONED: "Postponed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

/**
 * A source record normalised into a catalogue-shaped draft.
 * Every factual field is nullable: adapters must leave unknowns null rather than guess.
 */
export interface NormalisedRecord {
  kind: ItemKind;
  name: string;
  description: string | null;
  /** ISO UTC instant. Events store the original timezone alongside. */
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  venueName: string | null;
  areaHint: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  bookingUrl: string | null;
  websiteUrl: string | null;
  categoryHint: string | null;
  language: string | null;
  ageMin: number | null;
  organiser: string | null;
  moodTags: string[];
  occasionTags: string[];
  groupTags: string[];
  keywords: string[];
  /** Confirmations drive the quality score — only set true when the source states the fact. */
  confirmed: {
    date: boolean;
    price: boolean;
    venue: boolean;
    location: boolean;
  };
  /** Raw text preserved for traceability / admin review. */
  sourceText: string | null;
  /**
   * Venue-profile facts the source published itself (hours, contact, menu, amenities…).
   * Always null unless the source stated them; adapters never infer these.
   */
  venue: VenueProfile | null;
}

export interface SourceRecordInput {
  externalId: string;
  sourceUrl: string | null;
  lastModified: string | null;
  payload: Record<string, unknown>;
  normalised: NormalisedRecord | null;
  parseStatus: "ok" | "partial" | "failed" | "needs_review";
  errorMessage?: string | null;
}

export interface QualityWeights {
  source_authority: number;
  freshness: number;
  date_confirmed: number;
  price_confirmed: number;
  venue_confirmed: number;
  location_confirmed: number;
  duplicate_confidence: number;
  content_completeness: number;
}

export interface QualityGate {
  publish_min: number;
  review_min: number;
  stale_after_hours: number;
}

export interface RefreshCadence {
  event_lt_48h_minutes: number;
  event_3_to_14d_minutes: number;
  event_gt_14d_minutes: number;
  venue_minutes: number;
  offer_minutes: number;
  social_minutes: number;
}

export const DEFAULT_WEIGHTS: QualityWeights = {
  source_authority: 30,
  freshness: 20,
  date_confirmed: 15,
  price_confirmed: 10,
  venue_confirmed: 10,
  location_confirmed: 5,
  duplicate_confidence: 5,
  content_completeness: 5,
};

export const DEFAULT_GATE: QualityGate = { publish_min: 70, review_min: 45, stale_after_hours: 72 };

export const DEFAULT_CADENCE: RefreshCadence = {
  event_lt_48h_minutes: 180,
  event_3_to_14d_minutes: 540,
  event_gt_14d_minutes: 1440,
  venue_minutes: 10080,
  offer_minutes: 540,
  social_minutes: 540,
};
