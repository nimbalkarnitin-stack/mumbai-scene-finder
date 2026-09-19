/**
 * Monetisation as a SECONDARY ranking signal.
 *
 * Relevance, freshness, availability, budget fit and source verification are
 * computed first by the existing recommendation engine. This module may only
 * nudge the resulting score by a small, configurable, hard-capped amount, and it
 * records what it did so the effect is auditable.
 */

import { DEFAULT_RANKING_WEIGHT, MAX_ALLOWED_MONETISATION_BOOST, type RankingWeightConfig } from "./types";

export interface MonetisationSignal {
  /** A live, configured affiliate/partner link exists for this listing. */
  hasPartnerLink: boolean;
  /** A signed direct partnership covers this listing. */
  hasDirectPartnership: boolean;
}

export interface MonetisationAudit {
  applied: boolean;
  weight: number;
  boost: number;
  reason: string;
}

export interface Scored {
  id: string;
  score: number;
  isSponsored: boolean;
}

/** Effective config, clamped so a bad settings row can never buy the top slot. */
export function effectiveWeight(cfg: Partial<RankingWeightConfig> | null | undefined): RankingWeightConfig {
  const merged = { ...DEFAULT_RANKING_WEIGHT, ...(cfg ?? {}) };
  const cap = Math.min(Math.max(merged.max_boost, 0), MAX_ALLOWED_MONETISATION_BOOST);
  return { enabled: !!merged.enabled, weight: Math.min(Math.max(merged.weight, 0), cap), max_boost: cap };
}

export function monetisationBoost(signal: MonetisationSignal, cfg?: Partial<RankingWeightConfig> | null): MonetisationAudit {
  const w = effectiveWeight(cfg);
  if (!w.enabled) return { applied: false, weight: w.weight, boost: 0, reason: "monetisation ranking disabled" };
  const strength = signal.hasDirectPartnership ? 1 : signal.hasPartnerLink ? 0.6 : 0;
  if (strength === 0) return { applied: false, weight: w.weight, boost: 0, reason: "no monetised link" };
  const boost = Math.min(w.weight * strength, w.max_boost);
  return { applied: boost > 0, weight: w.weight, boost, reason: signal.hasDirectPartnership ? "direct partnership" : "affiliate link" };
}

export interface RankedWithMonetisation<T extends Scored> {
  item: T;
  relevanceScore: number;
  finalScore: number;
  monetisation: MonetisationAudit;
}

/**
 * Re-rank with the capped monetisation nudge applied on top of relevance.
 * Sponsored placements are NOT ranked here — they live in a separate, labelled rail.
 */
export function applyMonetisationSignal<T extends Scored>(
  items: T[],
  signalFor: (item: T) => MonetisationSignal,
  cfg?: Partial<RankingWeightConfig> | null,
): RankedWithMonetisation<T>[] {
  return items
    .map((item) => {
      const audit = monetisationBoost(signalFor(item), cfg);
      return { item, relevanceScore: item.score, finalScore: item.score * (1 + audit.boost), monetisation: audit };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
