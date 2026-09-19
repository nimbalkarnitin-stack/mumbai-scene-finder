/**
 * Cross-source verification: per-field provenance and conflict detection.
 *
 * Conflicts are *detected and surfaced*, never silently resolved. The engine never
 * invents a value and never picks a winner on its own — an admin decides.
 */

import type { NormalisedRecord, VerificationState } from "./types";

export const PROVENANCE_FIELDS = [
  "title",
  "description",
  "starts_at",
  "ends_at",
  "venue",
  "price_min",
  "booking_url",
  "image_url",
  "organiser",
] as const;

export type ProvenanceField = (typeof PROVENANCE_FIELDS)[number];

export interface FieldObservation {
  field: ProvenanceField;
  /** Canonical string form of the observed value, or null when the source didn't state it. */
  value: string | null;
  sourceName: string;
  sourceType: string;
  sourceUrl: string | null;
  authorityLevel: number;
  sourceRecordId: string | null;
  observedAt: string;
}

export interface FieldConflict {
  field: ProvenanceField;
  values: { value: string; sources: string[]; authorityLevel: number }[];
}

/** Read the fields we track from a normalised record. Absent facts stay null. */
export function fieldValuesFrom(rec: NormalisedRecord): Record<ProvenanceField, string | null> {
  return {
    title: rec.name || null,
    description: rec.description,
    starts_at: rec.startsAt,
    ends_at: rec.endsAt,
    venue: rec.venueName ?? rec.address ?? null,
    price_min: rec.priceMin === null ? null : String(rec.priceMin),
    booking_url: rec.bookingUrl,
    image_url: rec.imageUrl,
    organiser: rec.organiser,
  };
}

/** Comparison form: dates to the minute, prices numeric, text case/space-insensitive. */
export function canonicalise(field: ProvenanceField, value: string | null): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (field === "starts_at" || field === "ends_at") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 16);
  }
  if (field === "price_min") {
    const n = Number(raw.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? String(n) : null;
  }
  if (field === "booking_url" || field === "image_url") return raw.replace(/\/+$/, "").toLowerCase();
  if (field === "description") return raw.slice(0, 160).toLowerCase().replace(/\s+/g, " ");
  return raw.toLowerCase().replace(/\s+/g, " ");
}

/** Fields where two different stated values are a real contradiction worth review. */
const CONFLICT_FIELDS = new Set<ProvenanceField>(["starts_at", "ends_at", "venue", "price_min", "booking_url"]);

export function detectFieldConflicts(observations: FieldObservation[]): FieldConflict[] {
  const byField = new Map<ProvenanceField, Map<string, { sources: Set<string>; authorityLevel: number }>>();
  for (const obs of observations) {
    if (!CONFLICT_FIELDS.has(obs.field)) continue;
    const canonical = canonicalise(obs.field, obs.value);
    if (canonical === null) continue; // a source staying silent is never a conflict
    const values = byField.get(obs.field) ?? new Map();
    const entry = values.get(canonical) ?? { sources: new Set<string>(), authorityLevel: obs.authorityLevel };
    entry.sources.add(obs.sourceName);
    entry.authorityLevel = Math.max(entry.authorityLevel, obs.authorityLevel);
    values.set(canonical, entry);
    byField.set(obs.field, values);
  }

  const conflicts: FieldConflict[] = [];
  for (const [field, values] of byField) {
    if (values.size < 2) continue;
    conflicts.push({
      field,
      values: [...values.entries()].map(([value, e]) => ({ value, sources: [...e.sources].sort(), authorityLevel: e.authorityLevel })),
    });
  }
  return conflicts.sort((a, b) => a.field.localeCompare(b.field));
}

export interface CrossSourceInput {
  observations: FieldObservation[];
  conflicts: FieldConflict[];
  /** Hours since the most recent source check. */
  ageHours: number;
  staleAfterHours: number;
  /** Source types considered first-party for this entity. */
  firstPartyTypes?: string[];
}

export interface CrossSourceResult {
  state: VerificationState;
  distinctSources: number;
  agreeingSources: number;
  hasFirstParty: boolean;
  reasons: string[];
}

/**
 * Cross-source state:
 * - conflicting stated facts    -> REVIEW_REQUIRED
 * - stale (nothing re-checked)  -> STALE
 * - >=2 sources agree on the key facts, one of them first-party -> VERIFIED
 * - a single first-party source -> PARTIALLY_VERIFIED
 * - anything else               -> UNVERIFIED
 */
export function crossSourceState(input: CrossSourceInput): CrossSourceResult {
  const firstParty = new Set(input.firstPartyTypes ?? ["official_site", "organiser_submission", "ticketing_api", "partner_feed"]);
  const sources = new Set(input.observations.map((o) => o.sourceName));
  const hasFirstParty = input.observations.some((o) => firstParty.has(o.sourceType));
  const reasons: string[] = [];

  const keyFields: ProvenanceField[] = ["starts_at", "venue"];
  let agreeing = 0;
  for (const field of keyFields) {
    const stated = input.observations.filter((o) => o.field === field && canonicalise(field, o.value) !== null);
    const distinct = new Set(stated.map((o) => canonicalise(field, o.value)));
    if (stated.length >= 2 && distinct.size === 1) agreeing += 1;
  }

  if (input.conflicts.length > 0) {
    reasons.push(`${input.conflicts.length} field(s) disagree between sources: ${input.conflicts.map((c) => c.field).join(", ")}`);
    return { state: "REVIEW_REQUIRED", distinctSources: sources.size, agreeingSources: agreeing, hasFirstParty, reasons };
  }
  if (input.ageHours > input.staleAfterHours) {
    reasons.push(`not re-checked for ${Math.round(input.ageHours)}h`);
    return { state: "STALE", distinctSources: sources.size, agreeingSources: agreeing, hasFirstParty, reasons };
  }
  if (sources.size >= 2 && hasFirstParty && agreeing >= 1) {
    reasons.push("two or more sources agree, including a first-party source");
    return { state: "VERIFIED", distinctSources: sources.size, agreeingSources: agreeing, hasFirstParty, reasons };
  }
  if (hasFirstParty) {
    reasons.push("only one first-party source has confirmed these details");
    return { state: "PARTIALLY_VERIFIED", distinctSources: sources.size, agreeingSources: agreeing, hasFirstParty, reasons };
  }
  reasons.push("no first-party source has confirmed these details");
  return { state: "UNVERIFIED", distinctSources: sources.size, agreeingSources: agreeing, hasFirstParty, reasons };
}

/** Public surfaces only show states that a source actually backs. */
export const PUBLIC_VISIBLE_STATES: VerificationState[] = ["VERIFIED", "PARTIALLY_VERIFIED", "REVIEW_REQUIRED"];

export function isPubliclyListable(state: string | null | undefined): boolean {
  return PUBLIC_VISIBLE_STATES.includes((state ?? "UNVERIFIED") as VerificationState);
}
