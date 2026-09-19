/**
 * Partner abstraction layer.
 *
 * Every India-focused network (Cuelinks, vCommission, Admitad) and the direct
 * merchant channel is described by stored configuration only. We do NOT hardcode
 * endpoints, affiliate IDs, deep-link formats, commission rates or capabilities —
 * those are unknown until the user supplies them from the partner dashboard.
 *
 * Until a partner is configured AND enabled, link building falls back to the
 * plain destination URL, so the user experience never depends on monetisation.
 */

import type { CommissionModel, PartnerKind, PartnerStatus } from "./types";

export interface PartnerConfig {
  /** Template with {destination} and {subid} tokens, e.g. "https://host/?url={destination}&subid={subid}". */
  deep_link_template?: string | null;
  /** When there is no template, the query parameter used to carry our subid. */
  subid_param?: string | null;
  /** Name of the secret holding the postback signing secret (never the value). */
  postback_secret_env?: string | null;
  [key: string]: unknown;
}

export interface PartnerRecord {
  id: string;
  slug: string;
  name: string;
  kind: PartnerKind;
  adapter_key: string;
  status: PartnerStatus;
  enabled: boolean;
  base_url: string | null;
  credential_env_keys: string[];
  capabilities: Record<string, unknown>;
  config: PartnerConfig;
  disclosure_text: string | null;
  default_commission_model: CommissionModel | null;
  default_commission_rate: number | null;
  currency: string;
}

export interface PartnerTemplate {
  slug: string;
  name: string;
  adapterKey: string;
  kind: PartnerKind;
  /** Secrets the user must add in Project Settings → Secrets before enabling. */
  credentialEnvKeys: string[];
  /** What still has to be supplied by the user. Deliberately explicit. */
  configurationNeeded: string[];
}

export const PARTNER_TEMPLATES: PartnerTemplate[] = [
  {
    slug: "cuelinks",
    name: "Cuelinks",
    adapterKey: "cuelinks",
    kind: "affiliate_network",
    credentialEnvKeys: ["CUELINKS_API_TOKEN", "CUELINKS_CHANNEL_ID"],
    configurationNeeded: ["Tracking/deep-link URL format", "subid parameter name", "Reporting or postback setup", "Commission terms per merchant"],
  },
  {
    slug: "vcommission",
    name: "vCommission",
    adapterKey: "vcommission",
    kind: "affiliate_network",
    credentialEnvKeys: ["VCOMMISSION_API_KEY", "VCOMMISSION_AFFILIATE_ID"],
    configurationNeeded: ["Affiliate ID", "Tracking link format", "Postback URL + signing secret", "Approved offers"],
  },
  {
    slug: "admitad",
    name: "Admitad",
    adapterKey: "admitad",
    kind: "affiliate_network",
    credentialEnvKeys: ["ADMITAD_CLIENT_ID", "ADMITAD_CLIENT_SECRET", "ADMITAD_CAMPAIGN_ID"],
    configurationNeeded: ["Campaign / website ID", "Deep-link format", "Postback secret", "Approved programmes"],
  },
  {
    slug: "direct-merchant",
    name: "Direct merchant / venue partnerships",
    adapterKey: "direct",
    kind: "direct_merchant",
    credentialEnvKeys: [],
    configurationNeeded: ["Signed deal per venue (model + rate)", "Booking URL to attribute", "Reporting cadence"],
  },
];

export type LinkFallbackReason = "partner_missing" | "partner_disabled" | "partner_unconfigured" | "no_template" | "invalid_destination" | null;

export interface TrackedLink {
  url: string;
  /** True only when a configured, enabled partner actually rewrote the link. */
  partnerApplied: boolean;
  partnerSlug: string | null;
  reason: LinkFallbackReason;
}

function withDefaultParams(destination: string, subid: string, subidParam: string | null): string {
  try {
    const u = new URL(destination);
    u.searchParams.set("utm_source", "sceneai");
    u.searchParams.set("utm_medium", "referral");
    if (subidParam) u.searchParams.set(subidParam, subid);
    return u.toString();
  } catch {
    return destination;
  }
}

/** True when the partner is genuinely ready to receive traffic. */
export function isPartnerLive(p: PartnerRecord | null | undefined): boolean {
  return !!p && p.enabled && p.status === "active";
}

/**
 * Build the outbound URL for a click.
 * Disabled / unconfigured partners always fall back to the destination URL —
 * we never fabricate a tracking link.
 */
export function buildTrackedUrl(args: { destinationUrl: string; subid: string; partner?: PartnerRecord | null }): TrackedLink {
  const { destinationUrl, subid, partner } = args;
  let valid = true;
  try {
    new URL(destinationUrl);
  } catch {
    valid = false;
  }
  if (!valid) return { url: destinationUrl, partnerApplied: false, partnerSlug: partner?.slug ?? null, reason: "invalid_destination" };

  if (!partner) return { url: withDefaultParams(destinationUrl, subid, "sceneai_ref"), partnerApplied: false, partnerSlug: null, reason: "partner_missing" };
  if (!partner.enabled) return { url: withDefaultParams(destinationUrl, subid, "sceneai_ref"), partnerApplied: false, partnerSlug: partner.slug, reason: "partner_disabled" };
  if (partner.status !== "active")
    return { url: withDefaultParams(destinationUrl, subid, "sceneai_ref"), partnerApplied: false, partnerSlug: partner.slug, reason: "partner_unconfigured" };

  const template = partner.config?.deep_link_template ?? null;
  if (template) {
    const url = template.replace(/\{destination\}/g, encodeURIComponent(destinationUrl)).replace(/\{subid\}/g, encodeURIComponent(subid));
    return { url, partnerApplied: true, partnerSlug: partner.slug, reason: null };
  }

  const subidParam = partner.config?.subid_param ?? null;
  if (subidParam) return { url: withDefaultParams(destinationUrl, subid, subidParam), partnerApplied: true, partnerSlug: partner.slug, reason: null };

  return { url: withDefaultParams(destinationUrl, subid, "sceneai_ref"), partnerApplied: false, partnerSlug: partner.slug, reason: "no_template" };
}

/** Setup checklist shown in /admin/monetization. */
export function partnerSetupState(p: PartnerRecord, secretsPresent: string[]): {
  ready: boolean;
  missingSecrets: string[];
  missingConfig: string[];
} {
  const missingSecrets = p.credential_env_keys.filter((k) => !secretsPresent.includes(k));
  const missingConfig: string[] = [];
  if (!p.config?.deep_link_template && !p.config?.subid_param) missingConfig.push("deep_link_template or subid_param");
  if (p.kind === "affiliate_network" && !p.config?.postback_secret_env) missingConfig.push("postback_secret_env");
  return { ready: missingSecrets.length === 0 && missingConfig.length === 0, missingSecrets, missingConfig };
}
