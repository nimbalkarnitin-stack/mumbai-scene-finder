import {
  DEFAULT_CADENCE,
  DEFAULT_GATE,
  DEFAULT_WEIGHTS,
  type NormalisedRecord,
  type QualityGate,
  type QualityWeights,
  type RefreshCadence,
  type VerificationState,
} from "./types";

export interface QualitySignals {
  /** 1-5 configured authority of the source. */
  authorityLevel: number;
  /** Hours since the record was last checked against its source. */
  ageHours: number;
  dateConfirmed: boolean;
  priceConfirmed: boolean;
  venueConfirmed: boolean;
  locationConfirmed: boolean;
  /** 0-1: 1 = certainly unique, 0 = unresolved duplicate candidate. */
  duplicateConfidence: number;
  /** 0-1 completeness of the normalised content. */
  completeness: number;
}

export function completenessOf(rec: NormalisedRecord): number {
  const checks = [
    !!rec.name,
    !!rec.description,
    !!rec.imageUrl,
    !!(rec.bookingUrl || rec.websiteUrl),
    !!(rec.venueName || rec.address),
    !!rec.categoryHint,
    rec.moodTags.length > 0,
    rec.kind !== "event" || !!rec.startsAt,
  ];
  return checks.filter(Boolean).length / checks.length;
}

/** Freshness decays linearly to zero over the stale window. */
function freshnessRatio(ageHours: number, staleAfterHours: number): number {
  if (!Number.isFinite(ageHours) || ageHours < 0) return 0;
  return Math.max(0, Math.min(1, 1 - ageHours / Math.max(1, staleAfterHours)));
}

export function computeQualityScore(
  signals: QualitySignals,
  weights: QualityWeights = DEFAULT_WEIGHTS,
  gate: QualityGate = DEFAULT_GATE,
): number {
  const authorityRatio = Math.max(0, Math.min(1, (signals.authorityLevel - 1) / 4));
  const score =
    weights.source_authority * authorityRatio +
    weights.freshness * freshnessRatio(signals.ageHours, gate.stale_after_hours) +
    weights.date_confirmed * (signals.dateConfirmed ? 1 : 0) +
    weights.price_confirmed * (signals.priceConfirmed ? 1 : 0) +
    weights.venue_confirmed * (signals.venueConfirmed ? 1 : 0) +
    weights.location_confirmed * (signals.locationConfirmed ? 1 : 0) +
    weights.duplicate_confidence * Math.max(0, Math.min(1, signals.duplicateConfidence)) +
    weights.content_completeness * Math.max(0, Math.min(1, signals.completeness));
  return Math.round(score * 10) / 10;
}

/** Maps a numeric score + age to the public-facing state. Ambiguous records never reach VERIFIED. */
export function verificationStateFor(
  score: number,
  signals: Pick<QualitySignals, "ageHours" | "dateConfirmed" | "duplicateConfidence">,
  gate: QualityGate = DEFAULT_GATE,
): VerificationState {
  if (signals.ageHours > gate.stale_after_hours) return "STALE";
  if (score >= gate.publish_min && signals.dateConfirmed && signals.duplicateConfidence >= 0.8) return "VERIFIED";
  if (score >= gate.review_min) return "REVIEW_REQUIRED";
  return "UNVERIFIED";
}

/** Quality gate: only VERIFIED records publish automatically. */
export function passesPublishGate(score: number, state: VerificationState, gate: QualityGate = DEFAULT_GATE): boolean {
  return state === "VERIFIED" && score >= gate.publish_min;
}

/** Configurable refresh cadence: nearer events are re-checked more often. */
export function nextRefreshAt(
  kind: "event" | "venue" | "experience" | "offer" | "social",
  referenceIso: string | null,
  now: Date = new Date(),
  cadence: RefreshCadence = DEFAULT_CADENCE,
): string {
  let minutes: number;
  if (kind === "event" && referenceIso) {
    const hoursAway = (new Date(referenceIso).getTime() - now.getTime()) / 3600000;
    if (hoursAway < 48) minutes = cadence.event_lt_48h_minutes;
    else if (hoursAway <= 14 * 24) minutes = cadence.event_3_to_14d_minutes;
    else minutes = cadence.event_gt_14d_minutes;
  } else if (kind === "event") minutes = cadence.event_gt_14d_minutes;
  else if (kind === "offer") minutes = cadence.offer_minutes;
  else if (kind === "social") minutes = cadence.social_minutes;
  else minutes = cadence.venue_minutes;
  return new Date(now.getTime() + minutes * 60000).toISOString();
}
