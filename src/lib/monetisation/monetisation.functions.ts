/**
 * Public monetisation server functions.
 *
 * - Outbound clicks are logged server-side with full attribution and an idempotent
 *   dedupe key, then the (possibly partner-rewritten) URL is returned.
 * - Sponsored placements are returned as a separate, clearly-labelled rail.
 * - Disclosure copy is read from stored settings, so it is never hardcoded in the UI.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_CITY_SLUG } from "../scene-constants";
import type { LinkKind } from "./types";

const itemType = z.enum(["venue", "event", "experience"]);
const linkKind = z.enum(["booking", "website", "map", "offer", "sponsored"]);

const ClickSchema = z.object({
  destinationUrl: z.string().min(1).max(2048),
  linkKind: linkKind.default("booking"),
  partnerSlug: z.string().max(80).nullish(),
  offerId: z.string().uuid().nullish(),
  sponsoredListingId: z.string().uuid().nullish(),
  merchantPartnershipId: z.string().uuid().nullish(),
  itemType: itemType.nullish(),
  itemId: z.string().uuid().nullish(),
  recommendationId: z.string().max(120).nullish(),
  sessionId: z.string().max(120).nullish(),
  placement: z.string().max(60).nullish(),
  campaign: z.string().max(120).nullish(),
  disclosureShown: z.boolean().optional(),
  isSponsored: z.boolean().optional(),
});

export interface AffiliateClickResult {
  url: string;
  subid: string;
  clickId: string | null;
  partnerApplied: boolean;
  /** Which partner actually handled the click (null when none was resolved). */
  partnerSlug: string | null;
  /** Why no partner link was used, for per-partner analytics. */
  fallbackReason: string | null;
  /** Which stored disclosure the surface must show alongside the link. */
  disclosure: "affiliate" | "sponsored" | "none";
  deduped: boolean;
}

/**
 * Record an outbound click and return where the user should be sent.
 * A `map` link is discovery, never a booking, and is never monetised.
 */
export const recordAffiliateClick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClickSchema.parse(input))
  .handler(async ({ data }): Promise<AffiliateClickResult> => {
    const { isSafeExternalUrl } = await import("@/lib/ingestion/url-guard");
    const { buildTrackedUrl } = await import("./partners");
    const { buildSubid, clickDedupeKey } = await import("./attribution");
    const { loadMonetisationSettings, loadPartner } = await import("./monetisation.server");

    if (!isSafeExternalUrl(data.destinationUrl)) throw new Error("Destination must be a public http(s) URL");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await loadMonetisationSettings(supabaseAdmin);

    const ctx = {
      destinationUrl: data.destinationUrl,
      linkKind: data.linkKind as LinkKind,
      partnerSlug: data.partnerSlug ?? null,
      offerId: data.offerId ?? null,
      sponsoredListingId: data.sponsoredListingId ?? null,
      merchantPartnershipId: data.merchantPartnershipId ?? null,
      itemType: data.itemType ?? null,
      itemId: data.itemId ?? null,
      recommendationId: data.recommendationId ?? null,
      sessionId: data.sessionId ?? null,
      placement: data.placement ?? null,
      campaign: data.campaign ?? null,
    };

    const now = new Date();
    const dedupeKey = clickDedupeKey(ctx, now, settings.attribution);
    const subid = buildSubid(ctx, now, settings.attribution);

    const monetisable = data.linkKind !== "map";
    const partner = monetisable && data.partnerSlug ? await loadPartner(supabaseAdmin, data.partnerSlug) : null;
    const link = monetisable
      ? buildTrackedUrl({ destinationUrl: data.destinationUrl, subid, partner })
      : { url: data.destinationUrl, partnerApplied: false, partnerSlug: null, reason: null as null };

    const row = {
      subid,
      dedupe_key: dedupeKey,
      partner_id: partner?.id ?? null,
      offer_id: data.offerId ?? null,
      sponsored_listing_id: data.sponsoredListingId ?? null,
      merchant_partnership_id: data.merchantPartnershipId ?? null,
      session_id: data.sessionId ?? null,
      item_type: data.itemType ?? null,
      item_id: data.itemId ?? null,
      recommendation_id: data.recommendationId ?? null,
      placement: data.placement ?? null,
      campaign: data.campaign ?? null,
      link_kind: data.linkKind,
      destination_url: data.destinationUrl,
      tracked_url: link.url,
      disclosure_shown: data.disclosureShown ?? true,
      is_sponsored: !!data.isSponsored,
      commission_model: partner?.default_commission_model ?? null,
      expected_commission_rate: partner?.default_commission_rate ?? null,
      metadata: { partner_applied: link.partnerApplied, fallback_reason: link.reason },
    };

    // Idempotent: the same click inside the dedupe window reuses its row and subid.
    const { data: inserted, error } = await supabaseAdmin
      .from("affiliate_clicks")
      .upsert(row as never, { onConflict: "dedupe_key", ignoreDuplicates: false })
      .select("id,created_at")
      .maybeSingle();

    let clickId = inserted?.id ?? null;
    let deduped = false;
    if (error || !clickId) {
      const { data: existing } = await supabaseAdmin.from("affiliate_clicks").select("id").eq("dedupe_key", dedupeKey).maybeSingle();
      clickId = existing?.id ?? null;
      deduped = !!existing;
    }

    // Sponsored campaign reporting: count the click on the placement itself.
    if (data.sponsoredListingId && !deduped) {
      const { data: sl } = await supabaseAdmin.from("sponsored_listings").select("clicks").eq("id", data.sponsoredListingId).maybeSingle();
      if (sl) await supabaseAdmin.from("sponsored_listings").update({ clicks: Number(sl.clicks ?? 0) + 1 }).eq("id", data.sponsoredListingId);
    }

    return {
      url: link.url,
      subid,
      clickId,
      partnerApplied: link.partnerApplied,
      disclosure: data.isSponsored ? "sponsored" : link.partnerApplied || partner ? "affiliate" : "none",
      deduped,
    };
  });

export interface SponsoredPlacement {
  id: string;
  campaignName: string;
  placement: string;
  disclosureLabel: string;
  itemType: "venue" | "event" | "experience" | null;
  itemId: string | null;
  sponsorName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
}

/** Live, in-window sponsored placements. Always rendered separately and labelled. */
export const listSponsoredPlacements = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ city: z.string().optional(), placement: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<{ placements: SponsoredPlacement[]; disclosure: string }> => {
    const { createPublicClient } = await import("../public-db.server");
    const { loadMonetisationSettings } = await import("./monetisation.server");
    const db = createPublicClient();
    const settings = await loadMonetisationSettings(db);
    const { data: city } = await db.from("cities").select("id").eq("slug", data.city ?? DEFAULT_CITY_SLUG).maybeSingle();

    let q = db
      .from("sponsored_listings")
      .select("id,campaign_name,placement,disclosure_label,item_type,item_id,starts_at,ends_at,priority,sponsors(name)")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .limit(12);
    if (city?.id) q = q.or(`city_id.eq.${city.id},city_id.is.null`);
    if (data.placement) q = q.eq("placement", data.placement);
    const { data: rows } = await q;

    return {
      placements: (rows ?? []).map((r) => ({
        id: r.id,
        campaignName: r.campaign_name,
        placement: r.placement,
        disclosureLabel: r.disclosure_label,
        itemType: r.item_type,
        itemId: r.item_id,
        sponsorName: (r.sponsors as { name: string } | null)?.name ?? null,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        priority: r.priority,
      })),
      disclosure: settings.disclosure.sponsored,
    };
  });

/**
 * Public monetisation context for a city: disclosure copy, the auditable ranking
 * weight, and which listings carry a live monetised link (used as a secondary signal).
 */
export const getMonetisationContext = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ city: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createPublicClient } = await import("../public-db.server");
    const { loadMonetisationSettings } = await import("./monetisation.server");
    const { effectiveWeight } = await import("./ranking");
    const db = createPublicClient();
    const settings = await loadMonetisationSettings(db);
    const { data: city } = await db.from("cities").select("id").eq("slug", data.city ?? DEFAULT_CITY_SLUG).maybeSingle();

    const offers = city?.id
      ? await db.from("affiliate_offers").select("item_type,item_id,partner_id").eq("status", "active")
      : { data: [] as { item_type: string | null; item_id: string | null; partner_id: string }[] };

    const monetisedItemIds = [...new Set((offers.data ?? []).map((o) => o.item_id).filter((v): v is string => !!v))];
    return {
      disclosure: settings.disclosure,
      ranking: effectiveWeight(settings.ranking),
      monetisedItemIds,
    };
  });
