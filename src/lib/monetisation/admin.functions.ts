/**
 * Admin monetisation server functions. Every one is admin-gated; secret VALUES are
 * never returned — only whether a required secret is present.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { funnelMetrics } from "./attribution";
import { PARTNER_TEMPLATES, partnerSetupState, type PartnerConfig, type PartnerRecord } from "./partners";
import type { CommissionModel, ConversionStatus } from "./types";

async function assertAdmin(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

const commissionModel = z.enum(["CPA", "CPL", "CPS", "REVENUE_SHARE", "BOOKING_FEE", "FIXED_SPONSORSHIP"]);
const campaignStatus = z.enum(["draft", "scheduled", "active", "paused", "ended"]);
const partnerStatus = z.enum(["unconfigured", "configured", "active", "paused", "disabled"]);

/** Partners + offers + direct partnerships + setup readiness. */
export const listMonetisationSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: partners }, { data: offers }, { data: partnerships }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("affiliate_partners").select("*").order("kind").order("name"),
      supabaseAdmin.from("affiliate_offers").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("merchant_partnerships").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("monetisation_settings").select("key,value,description,updated_at"),
    ]);

    const present = (keys: string[]) => keys.filter((k) => !!process.env[k]);
    return {
      partners: (partners ?? []).map((p) => {
        const record = { ...p, capabilities: (p.capabilities ?? {}) as Record<string, unknown>, config: (p.config ?? {}) as PartnerConfig } as PartnerRecord;
        const setup = partnerSetupState(record, present(p.credential_env_keys));
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          kind: p.kind,
          adapter_key: p.adapter_key,
          status: p.status,
          enabled: p.enabled,
          currency: p.currency,
          notes: p.notes,
          default_commission_model: p.default_commission_model,
          default_commission_rate: p.default_commission_rate,
          config: record.config,
          credential_env_keys: p.credential_env_keys,
          setup_ready: setup.ready,
          missing_secrets: setup.missingSecrets,
          missing_config: setup.missingConfig,
          last_error: p.last_error,
        };
      }),
      offers: offers ?? [],
      partnerships: partnerships ?? [],
      settings: settings ?? [],
      templates: PARTNER_TEMPLATES,
    };
  });

export const updatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: partnerStatus.optional(),
        enabled: z.boolean().optional(),
        base_url: z.string().nullable().optional(),
        dashboard_url: z.string().nullable().optional(),
        default_commission_model: commissionModel.nullable().optional(),
        default_commission_rate: z.number().min(0).max(100).nullable().optional(),
        disclosure_text: z.string().max(400).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        config: z.record(z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { isSafeExternalUrl } = await import("@/lib/ingestion/url-guard");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;

    for (const key of ["base_url", "dashboard_url"] as const) {
      const v = patch[key];
      if (typeof v === "string" && v && !isSafeExternalUrl(v)) throw new Error(`${key} must be a public http(s) URL`);
    }
    if (patch.config) {
      const tpl = (patch.config as PartnerConfig).deep_link_template;
      if (typeof tpl === "string" && tpl) {
        if (!/^https:\/\//i.test(tpl)) throw new Error("Deep-link template must be an https URL");
        if (!tpl.includes("{destination}")) throw new Error("Deep-link template must contain {destination}");
      }
    }
    // A partner can only go live once it has a way to carry our subid.
    if (patch.enabled === true || patch.status === "active") {
      const { data: current } = await supabaseAdmin.from("affiliate_partners").select("config").eq("id", id).maybeSingle();
      const cfg = { ...((current?.config ?? {}) as PartnerConfig), ...((patch.config ?? {}) as PartnerConfig) };
      if (!cfg.deep_link_template && !cfg.subid_param) throw new Error("Add a deep-link template or a subid parameter before enabling this partner");
    }

    const { error } = await supabaseAdmin.from("affiliate_partners").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        partner_id: z.string().uuid(),
        title: z.string().min(2).max(200),
        description: z.string().max(2000).nullish(),
        destination_url: z.string().nullish(),
        deep_link_template: z.string().nullish(),
        external_id: z.string().max(200).nullish(),
        item_type: z.enum(["venue", "event", "experience"]).nullish(),
        item_id: z.string().uuid().nullish(),
        commission_model: commissionModel.default("CPA"),
        commission_rate: z.number().min(0).max(100).nullish(),
        commission_flat: z.number().min(0).nullish(),
        status: campaignStatus.default("draft"),
        starts_at: z.string().nullish(),
        ends_at: z.string().nullish(),
        terms_url: z.string().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { isSafeExternalUrl } = await import("@/lib/ingestion/url-guard");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.destination_url && !isSafeExternalUrl(data.destination_url)) throw new Error("Destination URL must be a public http(s) URL");
    if (data.status === "active" && !data.destination_url) throw new Error("An active offer needs a destination URL");
    const { error } = await supabaseAdmin.from("affiliate_offers").upsert(data as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertPartnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        partner_id: z.string().uuid().nullish(),
        merchant_name: z.string().min(2).max(200),
        item_type: z.enum(["venue", "event", "experience"]).nullish(),
        item_id: z.string().uuid().nullish(),
        model: commissionModel.default("CPA"),
        commission_rate: z.number().min(0).max(100).nullish(),
        flat_fee: z.number().min(0).nullish(),
        booking_fee: z.number().min(0).nullish(),
        status: partnerStatus.default("unconfigured"),
        contact_name: z.string().max(200).nullish(),
        contact_email: z.string().email().nullish(),
        payout_terms: z.string().max(1000).nullish(),
        contract_starts_at: z.string().nullish(),
        contract_ends_at: z.string().nullish(),
        notes: z.string().max(2000).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const needsRate: CommissionModel[] = ["CPS", "REVENUE_SHARE"];
    if (needsRate.includes(data.model) && data.commission_rate == null) throw new Error(`${data.model} needs a commission rate (%)`);
    if (data.model === "BOOKING_FEE" && data.booking_fee == null) throw new Error("Booking-fee deals need a booking fee");
    if (data.model === "FIXED_SPONSORSHIP" && data.flat_fee == null) throw new Error("Fixed sponsorship needs a flat fee");
    const { error } = await supabaseAdmin.from("merchant_partnerships").upsert(data as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertSponsoredListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        partner_id: z.string().uuid().nullish(),
        sponsor_id: z.string().uuid().nullish(),
        campaign_name: z.string().min(2).max(200),
        placement: z.string().min(2).max(60).default("discovery"),
        item_type: z.enum(["venue", "event", "experience"]).nullish(),
        item_id: z.string().uuid().nullish(),
        status: campaignStatus.default("draft"),
        starts_at: z.string().nullish(),
        ends_at: z.string().nullish(),
        fee_amount: z.number().min(0).nullish(),
        budget_amount: z.number().min(0).nullish(),
        priority: z.number().min(0).max(100).default(0),
        disclosure_label: z.string().min(2).max(40).default("Sponsored"),
        notes: z.string().max(2000).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.status === "active") {
      if (!data.item_id || !data.item_type) throw new Error("A live sponsored placement must point at a catalogue listing");
      if (!data.starts_at || !data.ends_at) throw new Error("A live sponsored placement needs campaign start and end dates");
    }
    const { error } = await supabaseAdmin.from("sponsored_listings").upsert(data as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSponsoredCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sponsored_listings")
      .select("id,campaign_name,placement,status,starts_at,ends_at,fee_amount,budget_amount,currency,priority,impressions,clicks,item_type,item_id,disclosure_label,notes")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const listClicksAndConversions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().min(1).max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = data.limit ?? 50;
    const [{ data: clicks }, { data: conversions }] = await Promise.all([
      supabaseAdmin
        .from("affiliate_clicks")
        .select("id,subid,link_kind,placement,campaign,item_type,item_id,destination_url,is_sponsored,disclosure_shown,created_at,affiliate_partners(name,slug)")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from("affiliate_conversions")
        .select("id,subid,external_conversion_id,status,order_value,commission_amount,currency,occurred_at,reported_at,reconciliation_status,import_batch,click_id,affiliate_partners(name,slug)")
        .order("reported_at", { ascending: false })
        .limit(limit),
    ]);
    return { clicks: clicks ?? [], conversions: conversions ?? [] };
  });

/** Move a commission through pending → approved → paid (or reject). */
export const setConversionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected", "paid"]), reason: z.string().max(500).nullish(), payoutReference: z.string().max(200).nullish() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { canTransition } = await import("./attribution");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("affiliate_conversions").select("id,status").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Conversion not found");
    const from = row.status as ConversionStatus;
    const to = data.status as ConversionStatus;
    if (!canTransition(from, to)) throw new Error(`Cannot move a ${from} commission to ${to}`);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: to };
    if (to === "approved") patch["approved_at"] = now;
    if (to === "rejected") {
      patch["rejected_at"] = now;
      patch["rejection_reason"] = data.reason ?? null;
    }
    if (to === "paid") {
      patch["paid_at"] = now;
      patch["payout_reference"] = data.payoutReference ?? null;
    }
    const { error } = await supabaseAdmin.from("affiliate_conversions").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    const { logMonetisationEvent } = await import("./events.server");
    await logMonetisationEvent(supabaseAdmin, to === "paid" ? "commission_paid" : to === "approved" ? "commission_approved" : "conversion_received", {
      conversionId: data.id,
      from,
      to,
    });
    return { ok: true };
  });

/**
 * Reconciliation import: paste the rows a partner reports (CSV/JSON export) and
 * match them to stored clicks. Idempotent on (partner, external conversion id).
 */
export const importConversions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        partnerId: z.string().uuid(),
        batch: z.string().max(120).optional(),
        rows: z
          .array(
            z.object({
              externalConversionId: z.string().min(1).max(200),
              subid: z.string().max(200).nullish(),
              orderValue: z.number().min(0).nullish(),
              commissionAmount: z.number().min(0).nullish(),
              currency: z.string().max(8).optional(),
              status: z.enum(["pending", "approved", "rejected", "paid"]).optional(),
              occurredAt: z.string().nullish(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { reconcileConversion } = await import("./attribution");
    const { loadMonetisationSettings } = await import("./monetisation.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await loadMonetisationSettings(supabaseAdmin);

    const subids = data.rows.map((r) => r.subid).filter((s): s is string => !!s);
    const { data: clicks } = subids.length
      ? await supabaseAdmin
          .from("affiliate_clicks")
          .select("id,subid,partner_id,offer_id,merchant_partnership_id,item_type,item_id,created_at")
          .in("subid", subids)
      : { data: [] };

    const batch = data.batch ?? `import-${new Date().toISOString().slice(0, 19)}`;
    const payload = data.rows.map((r) => {
      const match = reconcileConversion(
        {
          partnerSlug: "",
          externalConversionId: r.externalConversionId,
          subid: r.subid ?? null,
          orderValue: r.orderValue ?? null,
          commissionAmount: r.commissionAmount ?? null,
          currency: r.currency ?? "INR",
          status: r.status ?? "pending",
          occurredAt: r.occurredAt ?? null,
          raw: {},
        },
        (clicks ?? []) as never,
        settings.attribution,
      );
      return {
        partner_id: data.partnerId,
        click_id: match.clickId,
        offer_id: match.offerId,
        merchant_partnership_id: match.merchantPartnershipId,
        item_type: match.itemType,
        item_id: match.itemId,
        subid: r.subid ?? null,
        external_conversion_id: r.externalConversionId,
        status: r.status ?? "pending",
        order_value: r.orderValue ?? null,
        commission_amount: r.commissionAmount ?? null,
        currency: r.currency ?? "INR",
        occurred_at: r.occurredAt ?? null,
        reconciliation_status: match.reconciliationStatus,
        reconciled_at: match.clickId ? new Date().toISOString() : null,
        import_batch: batch,
        raw_payload: r as unknown as Record<string, unknown>,
      };
    });

    const { error, data: saved } = await supabaseAdmin
      .from("affiliate_conversions")
      .upsert(payload as never, { onConflict: "partner_id,external_conversion_id" })
      .select("id,reconciliation_status");
    if (error) throw new Error(error.message);
    const matched = (saved ?? []).filter((r) => r.reconciliation_status === "matched").length;
    return { ok: true, imported: saved?.length ?? 0, matched, unmatched: (saved?.length ?? 0) - matched, batch };
  });

/** Revenue dashboard metrics. Nothing is estimated: every number comes from stored rows. */
export const getRevenueMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ days: z.number().min(1).max(365).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const days = data.days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const [{ data: clicks }, { data: conversions }, { data: impressions }, { data: bookingStarts }, { data: partners }, { data: sponsored }] = await Promise.all([
      supabaseAdmin.from("affiliate_clicks").select("id,partner_id,item_type,item_id,link_kind,is_sponsored,created_at").gte("created_at", since),
      supabaseAdmin.from("affiliate_conversions").select("partner_id,status,order_value,commission_amount,item_type,item_id,reported_at,reconciliation_status").gte("reported_at", since),
      supabaseAdmin.from("interactions").select("id", { count: "exact", head: true }).eq("event_type", "recommendation_impression").gte("created_at", since),
      supabaseAdmin.from("interactions").select("id", { count: "exact", head: true }).eq("event_type", "booking_start").gte("created_at", since),
      supabaseAdmin.from("affiliate_partners").select("id,name,slug,status,enabled"),
      supabaseAdmin.from("sponsored_listings").select("id,campaign_name,status,impressions,clicks,fee_amount,budget_amount,currency"),
    ]);

    const conv = conversions ?? [];
    const sum = (rows: typeof conv, key: "order_value" | "commission_amount") => rows.reduce((t, r) => t + Number(r[key] ?? 0), 0);
    const counts = {
      impressions: (impressions as unknown as { length?: number })?.length ?? 0,
      clicks: (clicks ?? []).length,
      bookingStarts: (bookingStarts as unknown as { length?: number })?.length ?? 0,
      conversions: conv.length,
      approved: conv.filter((c) => c.status === "approved").length,
      paid: conv.filter((c) => c.status === "paid").length,
      bookingValue: sum(conv, "order_value"),
      commission: sum(conv, "commission_amount"),
    };

    // Impression/booking-start counts come back as head-only queries; read their counts properly.
    const [{ count: impressionCount }, { count: bookingStartCount }] = await Promise.all([
      supabaseAdmin.from("interactions").select("id", { count: "exact", head: true }).eq("event_type", "recommendation_impression").gte("created_at", since),
      supabaseAdmin.from("interactions").select("id", { count: "exact", head: true }).eq("event_type", "booking_start").gte("created_at", since),
    ]);
    counts.impressions = impressionCount ?? 0;
    counts.bookingStarts = bookingStartCount ?? 0;

    const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));
    const byPartner = new Map<string, { name: string; clicks: number; conversions: number; commission: number; bookingValue: number }>();
    for (const c of clicks ?? []) {
      const key = c.partner_id ?? "unattributed";
      const row = byPartner.get(key) ?? { name: partnerName.get(key) ?? "Unattributed", clicks: 0, conversions: 0, commission: 0, bookingValue: 0 };
      row.clicks += 1;
      byPartner.set(key, row);
    }
    for (const c of conv) {
      const key = c.partner_id ?? "unattributed";
      const row = byPartner.get(key) ?? { name: partnerName.get(key) ?? "Unattributed", clicks: 0, conversions: 0, commission: 0, bookingValue: 0 };
      row.conversions += 1;
      row.commission += Number(c.commission_amount ?? 0);
      row.bookingValue += Number(c.order_value ?? 0);
      byPartner.set(key, row);
    }

    const byEntity = new Map<string, number>();
    for (const c of clicks ?? []) {
      const key = `${c.item_type ?? "-"}:${c.item_id ?? "-"}`;
      byEntity.set(key, (byEntity.get(key) ?? 0) + 1);
    }

    return {
      days,
      metrics: funnelMetrics(counts),
      pipeline: {
        pending: conv.filter((c) => c.status === "pending").length,
        approved: counts.approved,
        rejected: conv.filter((c) => c.status === "rejected").length,
        paid: counts.paid,
        unmatched: conv.filter((c) => c.reconciliation_status !== "matched").length,
      },
      byPartner: [...byPartner.values()].sort((a, b) => b.clicks - a.clicks),
      topEntities: [...byEntity.entries()].map(([key, clickCount]) => ({ key, clicks: clickCount })).sort((a, b) => b.clicks - a.clicks).slice(0, 10),
      linkKinds: Object.entries(
        (clicks ?? []).reduce<Record<string, number>>((acc, c) => {
          acc[c.link_kind] = (acc[c.link_kind] ?? 0) + 1;
          return acc;
        }, {}),
      ),
      sponsored: sponsored ?? [],
    };
  });

/** Update the auditable monetisation ranking weight / disclosure copy. */
export const updateMonetisationSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.enum(["ranking_weight", "disclosure", "attribution"]), value: z.record(z.unknown()) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { effectiveWeight } = await import("./ranking");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let value = data.value;
    if (data.key === "ranking_weight") value = effectiveWeight(data.value as never) as unknown as Record<string, unknown>;
    const { error } = await supabaseAdmin
      .from("monetisation_settings")
      .upsert({ key: data.key, value: value as never, updated_by: context.userId } as never, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true, value };
  });
