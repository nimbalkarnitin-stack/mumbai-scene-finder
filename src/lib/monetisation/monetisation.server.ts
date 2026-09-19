/**
 * Server-only monetisation helpers. Loads auditable settings and partner
 * configuration; never returns credentials to the caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PartnerConfig, PartnerRecord } from "./partners";
import { DEFAULT_ATTRIBUTION, DEFAULT_DISCLOSURE, DEFAULT_RANKING_WEIGHT, type AttributionConfig, type RankingWeightConfig } from "./types";

type DB = SupabaseClient<Database>;

export interface MonetisationSettings {
  ranking: RankingWeightConfig;
  attribution: AttributionConfig;
  disclosure: { affiliate: string; sponsored: string };
}

export async function loadMonetisationSettings(db: DB): Promise<MonetisationSettings> {
  const { data } = await db.from("monetisation_settings").select("key,value");
  const map = new Map((data ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
  const ranking = { ...DEFAULT_RANKING_WEIGHT, ...((map.get("ranking_weight") ?? {}) as Partial<RankingWeightConfig>) };
  const attribution = { ...DEFAULT_ATTRIBUTION, ...((map.get("attribution") ?? {}) as Partial<AttributionConfig>) };
  const disclosure = { ...DEFAULT_DISCLOSURE, ...((map.get("disclosure") ?? {}) as Partial<typeof DEFAULT_DISCLOSURE>) };
  return { ranking, attribution, disclosure };
}

/** Partner row shaped for the link builder. Credentials are never included. */
export async function loadPartner(db: DB, slug: string): Promise<PartnerRecord | null> {
  const { data } = await db.from("affiliate_partners").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    kind: data.kind,
    adapter_key: data.adapter_key,
    status: data.status,
    enabled: data.enabled,
    base_url: data.base_url,
    credential_env_keys: data.credential_env_keys,
    capabilities: (data.capabilities ?? {}) as Record<string, unknown>,
    config: (data.config ?? {}) as PartnerConfig,
    disclosure_text: data.disclosure_text,
    default_commission_model: data.default_commission_model,
    default_commission_rate: data.default_commission_rate,
    currency: data.currency,
  };
}
