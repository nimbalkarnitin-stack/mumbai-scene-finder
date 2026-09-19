import { createFileRoute } from "@tanstack/react-router";

/**
 * Affiliate conversion postback: `/api/public/affiliate/<partner-slug>/postback`.
 *
 * Route placement authenticates nobody — every request is verified against the
 * partner's own signing secret (name stored in the partner config, value in
 * Project Settings → Secrets). Unconfigured partners reject everything, so this
 * endpoint is inert until the user supplies real partner configuration.
 *
 * Idempotent on (partner, external conversion id).
 */
export const Route = createFileRoute("/api/public/affiliate/$partner/postback")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const slug = params.partner;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: partner } = await supabaseAdmin
          .from("affiliate_partners")
          .select("id,slug,enabled,status,config,currency")
          .eq("slug", slug)
          .maybeSingle();
        if (!partner) return Response.json({ error: "Unknown partner" }, { status: 404 });
        if (!partner.enabled || partner.status !== "active") return Response.json({ error: "Partner not live" }, { status: 403 });

        const cfg = (partner.config ?? {}) as { postback_secret_env?: string | null };
        const secretName = cfg.postback_secret_env;
        const secret = secretName ? process.env[secretName] : undefined;
        if (!secret) return Response.json({ error: "Postback secret not configured" }, { status: 503 });

        const body = await request.text();
        const signature = request.headers.get("x-signature") ?? request.headers.get("x-postback-signature") ?? "";
        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
        const a = Buffer.from(signature, "utf8");
        const b = Buffer.from(expected, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Invalid signature" }, { status: 401 });

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : null);
        const num = (k: string) => (typeof payload[k] === "number" ? (payload[k] as number) : Number.isFinite(Number(payload[k])) && payload[k] !== null && payload[k] !== "" ? Number(payload[k]) : null);

        const externalId = str("conversion_id") ?? str("external_id") ?? str("id");
        if (!externalId) return Response.json({ error: "Missing conversion id" }, { status: 400 });
        const subid = str("subid") ?? str("sub_id") ?? str("sceneai_ref");

        const { reconcileConversion } = await import("@/lib/monetisation/attribution");
        const { loadMonetisationSettings } = await import("@/lib/monetisation/monetisation.server");
        const settings = await loadMonetisationSettings(supabaseAdmin);

        const { data: clicks } = subid
          ? await supabaseAdmin
              .from("affiliate_clicks")
              .select("id,subid,partner_id,offer_id,merchant_partnership_id,item_type,item_id,created_at")
              .eq("subid", subid)
          : { data: [] };

        const occurredAt = str("occurred_at") ?? str("timestamp");
        const match = reconcileConversion(
          {
            partnerSlug: partner.slug,
            externalConversionId: externalId,
            subid,
            orderValue: num("order_value") ?? num("sale_amount"),
            commissionAmount: num("commission") ?? num("commission_amount"),
            currency: str("currency") ?? partner.currency,
            status: "pending",
            occurredAt,
            raw: payload,
          },
          (clicks ?? []) as never,
          settings.attribution,
        );

        const { error } = await supabaseAdmin.from("affiliate_conversions").upsert(
          {
            partner_id: partner.id,
            click_id: match.clickId,
            offer_id: match.offerId,
            merchant_partnership_id: match.merchantPartnershipId,
            item_type: match.itemType,
            item_id: match.itemId,
            subid,
            external_conversion_id: externalId,
            status: "pending",
            order_value: num("order_value") ?? num("sale_amount"),
            commission_amount: num("commission") ?? num("commission_amount"),
            currency: str("currency") ?? partner.currency,
            occurred_at: occurredAt,
            reconciliation_status: match.reconciliationStatus,
            reconciled_at: match.clickId ? new Date().toISOString() : null,
            raw_payload: payload as never,
          } as never,
          { onConflict: "partner_id,external_conversion_id" },
        );
        if (error) return Response.json({ error: "Could not store conversion" }, { status: 500 });

        const { logMonetisationEvent } = await import("@/lib/monetisation/events.server");
        await logMonetisationEvent(supabaseAdmin, "conversion_received", {
          partner: partner.slug,
          externalId,
          reconciliation: match.reconciliationStatus,
        });

        return Response.json({ ok: true, reconciliation: match.reconciliationStatus });
      },
    },
  },
});
