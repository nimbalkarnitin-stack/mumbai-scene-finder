/** Deterministic + fuzzy entity resolution helpers. Pure and unit-testable. */

const NOISE = /\b(live|show|tickets?|presents?|feat\.?|featuring|the|a|an|at|in|mumbai|night|edition|vol\.?\s*\d+)\b/g;

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2018\u2019'`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(value: string): Set<string> {
  const out = new Set<string>();
  const s = ` ${value} `;
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
  return out;
}

/** Dice coefficient on character bigrams: 0..1. */
export function similarity(a: string, b: string): number {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const sa = bigrams(x);
  const sb = bigrams(y);
  let shared = 0;
  for (const g of sa) if (sb.has(g)) shared += 1;
  return (2 * shared) / (sa.size + sb.size);
}

export interface DedupeInput {
  name: string;
  startsAt?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  areaId?: string | null;
  organiser?: string | null;
  description?: string | null;
  externalId?: string | null;
  sourceName?: string | null;
}

export interface DuplicateVerdict {
  score: number;
  signals: Record<string, number | boolean | string>;
  /** Same source + same external id, or identical name and start time. */
  deterministic: boolean;
  isCandidate: boolean;
}

const CANDIDATE_THRESHOLD = 0.62;

export function compareRecords(a: DedupeInput, b: DedupeInput): DuplicateVerdict {
  const nameScore = similarity(a.name, b.name);
  const deterministic =
    (!!a.externalId && a.externalId === b.externalId && a.sourceName === b.sourceName) ||
    (nameScore > 0.95 && !!a.startsAt && a.startsAt === b.startsAt);

  let timeScore = 0;
  if (a.startsAt && b.startsAt) {
    const diffMinutes = Math.abs(new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()) / 60000;
    timeScore = diffMinutes <= 90 ? 1 : diffMinutes <= 24 * 60 ? 0.5 : 0;
  } else if (!a.startsAt && !b.startsAt) timeScore = 0.5;

  const venueScore =
    a.venueId && b.venueId
      ? a.venueId === b.venueId
        ? 1
        : 0
      : a.venueName && b.venueName
        ? similarity(a.venueName, b.venueName)
        : 0;
  const areaScore = a.areaId && b.areaId ? (a.areaId === b.areaId ? 1 : 0) : 0;
  const organiserScore = a.organiser && b.organiser ? similarity(a.organiser, b.organiser) : 0;
  const descScore = a.description && b.description ? similarity(a.description.slice(0, 240), b.description.slice(0, 240)) : 0;

  const score = deterministic
    ? 1
    : Math.round(
        (nameScore * 0.45 + timeScore * 0.2 + venueScore * 0.15 + areaScore * 0.05 + organiserScore * 0.08 + descScore * 0.07) * 1000,
      ) / 1000;

  return {
    score,
    deterministic,
    isCandidate: score >= CANDIDATE_THRESHOLD,
    signals: { nameScore, timeScore, venueScore, areaScore, organiserScore, descScore },
  };
}

/** 0..1 confidence that a record is unique (used by the quality score). */
export function duplicateConfidenceFrom(openCandidates: number): number {
  if (openCandidates <= 0) return 1;
  return Math.max(0, 1 - openCandidates * 0.5);
}
