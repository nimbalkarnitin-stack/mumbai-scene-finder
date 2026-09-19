import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import {
  getRevenueMetrics,
  importConversions,
  listClicksAndConversions,
  listMonetisationSetup,
  listSponsoredCampaigns,
  setConversionStatus,
  updateMonetisationSetting,
  updatePartner,
} from "@/lib/monetisation/admin.functions";
import { COMMISSION_MODEL_LABEL, CONVERSION_STATUS_LABEL, PARTNER_STATUS_LABEL, type ConversionStatus } from "@/lib/monetisation/types";

export const Route = createFileRoute("/admin/monetization")({ component: MonetizationPage });

const money = (n: number, currency = "INR") => `${currency === "INR" ? "₹" : `${currency} `}${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(Number(n || 0) * 100).toFixed(1)}%`;

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MonetizationPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const setup = useQuery({ queryKey: ["mon-setup"], queryFn: () => listMonetisationSetup() });
  const metrics = useQuery({ queryKey: ["mon-metrics", days], queryFn: () => getRevenueMetrics({ data: { days } }) });
  const ledger = useQuery({ queryKey: ["mon-ledger"], queryFn: () => listClicksAndConversions({ data: { limit: 50 } }) });
  const campaigns = useQuery({ queryKey: ["mon-campaigns"], queryFn: () => listSponsoredCampaigns() });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["mon-setup"] });
    void qc.invalidateQueries({ queryKey: ["mon-metrics"] });
    void qc.invalidateQueries({ queryKey: ["mon-ledger"] });
  };

  const partnerMut = useMutation({
    mutationFn: (v: { id: string; enabled?: boolean; status?: "unconfigured" | "configured" | "active" | "paused" | "disabled" }) => updatePartner({ data: v }),
    onSuccess: () => { toast.success("Partner updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" | "paid" }) => setConversionStatus({ data: v }),
    onSuccess: () => { toast.success("Commission updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const weightMut = useMutation({
    mutationFn: (weight: number) => updateMonetisationSetting({ data: { key: "ranking_weight", value: { enabled: weight > 0, weight, max_boost: 0.05 } } }),
    onSuccess: () => { toast.success("Ranking weight saved"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [importPartner, setImportPartner] = useState("");
  const [importJson, setImportJson] = useState("");
  const importMut = useMutation({
    mutationFn: async () => {
      const rows = JSON.parse(importJson) as unknown;
      if (!Array.isArray(rows)) throw new Error("Paste a JSON array of conversion rows");
      return importConversions({ data: { partnerId: importPartner, rows: rows as never } });
    },
    onSuccess: (r) => { toast.success(`Imported ${r.imported} rows · ${r.matched} matched`); setImportJson(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const m = metrics.data?.metrics;
  const rankingSetting = setup.data?.settings.find((s) => s.key === "ranking_weight")?.value as { weight?: number } | undefined;

  return (
    <AdminShell
      title="Monetisation"
      action={
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "ember" : "glass"} onClick={() => setDays(d)}>{d}d</Button>
          ))}
        </div>
      }
    >
      {/* Revenue dashboard */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Revenue funnel · last {days} days</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Recommendation impressions" value={String(m?.impressions ?? 0)} />
          <Card label="Affiliate clicks" value={String(m?.clicks ?? 0)} sub={`CTR ${pct(m?.ctr ?? 0)}`} />
          <Card label="Booking starts" value={String(m?.bookingStarts ?? 0)} />
          <Card label="Conversions" value={String(m?.conversions ?? 0)} sub={`Conv. rate ${pct(m?.conversionRate ?? 0)}`} />
          <Card label="Booking value" value={money(m?.bookingValue ?? 0)} sub={`AOV ${money(m?.averageOrderValue ?? 0)}`} />
          <Card label="Commission" value={money(m?.commission ?? 0)} sub={`EPC ${money(m?.epc ?? 0)}`} />
          <Card label="Approved / paid" value={`${m?.approved ?? 0} / ${m?.paid ?? 0}`} sub={`Pending ${metrics.data?.pipeline.pending ?? 0}`} />
          <Card label="Unmatched conversions" value={String(metrics.data?.pipeline.unmatched ?? 0)} sub="Need reconciliation" />
        </div>
        {(m?.clicks ?? 0) === 0 && (
          <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
            No monetisation activity recorded yet. Every figure here comes from stored clicks and partner-reported conversions — nothing is estimated.
          </p>
        )}
      </section>

      {/* Revenue by partner */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">By partner</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card/60 text-xs text-muted-foreground">
              <tr><th className="p-3">Partner</th><th className="p-3">Clicks</th><th className="p-3">Conversions</th><th className="p-3">Booking value</th><th className="p-3">Commission</th></tr>
            </thead>
            <tbody>
              {(metrics.data?.byPartner ?? []).map((r) => (
                <tr key={r.name} className="border-t border-border">
                  <td className="p-3">{r.name}</td><td className="p-3">{r.clicks}</td><td className="p-3">{r.conversions}</td>
                  <td className="p-3">{money(r.bookingValue)}</td><td className="p-3">{money(r.commission)}</td>
                </tr>
              ))}
              {(metrics.data?.byPartner ?? []).length === 0 && <tr><td className="p-3 text-xs text-muted-foreground" colSpan={5}>No partner activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Partner setup */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Partners &amp; setup status</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {(setup.data?.partners ?? []).map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {p.kind.replace(/_/g, " ")} · {PARTNER_STATUS_LABEL[p.status]}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${p.setup_ready ? "bg-teal/15 text-teal" : "bg-saffron/15 text-saffron"}`}>
                  {p.setup_ready ? "Ready" : "Needs setup"}
                </span>
              </div>
              {p.default_commission_model && <p className="mt-2 text-xs text-muted-foreground">{COMMISSION_MODEL_LABEL[p.default_commission_model]}{p.default_commission_rate != null ? ` · ${p.default_commission_rate}%` : ""}</p>}
              {p.missing_secrets.length > 0 && (
                <p className="mt-2 text-xs text-saffron">Missing secrets: {p.missing_secrets.join(", ")} — add them in Project Settings → Secrets.</p>
              )}
              {p.missing_config.length > 0 && <p className="mt-1 text-xs text-saffron">Missing config: {p.missing_config.join(", ")}</p>}
              {p.notes && <p className="mt-2 text-[11px] text-muted-foreground">{p.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="glass" disabled={partnerMut.isPending} onClick={() => partnerMut.mutate({ id: p.id, status: p.status === "active" ? "paused" : "active", enabled: p.status !== "active" })}>
                  {p.status === "active" ? "Pause" : "Set live"}
                </Button>
                <Button size="sm" variant="glass" disabled={partnerMut.isPending || !p.enabled} onClick={() => partnerMut.mutate({ id: p.id, enabled: false, status: "disabled" })}>Disable</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sponsored campaigns */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Sponsored placements</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card/60 text-xs text-muted-foreground">
              <tr><th className="p-3">Campaign</th><th className="p-3">Placement</th><th className="p-3">Status</th><th className="p-3">Dates</th><th className="p-3">Fee / budget</th><th className="p-3">Impr.</th><th className="p-3">Clicks</th></tr>
            </thead>
            <tbody>
              {(campaigns.data ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3">{c.campaign_name}</td><td className="p-3">{c.placement}</td><td className="p-3 capitalize">{c.status}</td>
                  <td className="p-3 font-mono text-[11px]">{c.starts_at ? new Date(c.starts_at).toLocaleDateString("en-IN") : "—"} → {c.ends_at ? new Date(c.ends_at).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="p-3">{c.fee_amount != null ? money(Number(c.fee_amount), c.currency) : "—"} / {c.budget_amount != null ? money(Number(c.budget_amount), c.currency) : "—"}</td>
                  <td className="p-3">{c.impressions}</td><td className="p-3">{c.clicks}</td>
                </tr>
              ))}
              {(campaigns.data ?? []).length === 0 && <tr><td className="p-3 text-xs text-muted-foreground" colSpan={7}>No sponsored campaigns. Paid placements only appear on the site once a campaign is live and points at a real listing.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Commissions */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Commissions &amp; reconciliation</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card/60 text-xs text-muted-foreground">
              <tr><th className="p-3">Partner ref</th><th className="p-3">Status</th><th className="p-3">Order</th><th className="p-3">Commission</th><th className="p-3">Match</th><th className="p-3">Actions</th></tr>
            </thead>
            <tbody>
              {(ledger.data?.conversions ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-mono text-[11px]">{c.external_conversion_id}</td>
                  <td className="p-3">{CONVERSION_STATUS_LABEL[c.status as ConversionStatus]}</td>
                  <td className="p-3">{c.order_value != null ? money(Number(c.order_value), c.currency) : "—"}</td>
                  <td className="p-3">{c.commission_amount != null ? money(Number(c.commission_amount), c.currency) : "—"}</td>
                  <td className="p-3 text-xs">{c.reconciliation_status}</td>
                  <td className="p-3">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="glass" onClick={() => statusMut.mutate({ id: c.id, status: "approved" })}>Approve</Button>
                      <Button size="sm" variant="glass" onClick={() => statusMut.mutate({ id: c.id, status: "paid" })}>Paid</Button>
                      <Button size="sm" variant="glass" onClick={() => statusMut.mutate({ id: c.id, status: "rejected" })}>Reject</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(ledger.data?.conversions ?? []).length === 0 && <tr><td className="p-3 text-xs text-muted-foreground" colSpan={6}>No conversions received. Partner postbacks arrive at /api/public/affiliate/&lt;partner&gt;/postback once a partner is live and its signing secret is stored.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <p className="font-semibold">Import a partner report</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste the partner's exported rows as JSON: [{'{'}"externalConversionId":"…","subid":"…","orderValue":0,"commissionAmount":0,"status":"pending"{'}'}]. Re-importing the same rows is safe.
          </p>
          <select className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" value={importPartner} onChange={(e) => setImportPartner(e.target.value)}>
            <option value="">Select partner…</option>
            {(setup.data?.partners ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <textarea className="mt-2 h-28 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs" value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder="[]" />
          <Button className="mt-2" variant="ember" size="sm" disabled={!importPartner || !importJson || importMut.isPending} onClick={() => importMut.mutate()}>Import &amp; reconcile</Button>
        </div>
      </section>

      {/* Recent clicks */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recent outbound clicks</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card/60 text-xs text-muted-foreground">
              <tr><th className="p-3">When</th><th className="p-3">Kind</th><th className="p-3">Placement</th><th className="p-3">Subid</th><th className="p-3">Disclosure</th></tr>
            </thead>
            <tbody>
              {(ledger.data?.clicks ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-mono text-[11px]">{new Date(c.created_at).toLocaleString("en-IN")}</td>
                  <td className="p-3">{c.link_kind}</td><td className="p-3">{c.placement ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px]">{c.subid}</td>
                  <td className="p-3">{c.disclosure_shown ? "shown" : "missing"}</td>
                </tr>
              ))}
              {(ledger.data?.clicks ?? []).length === 0 && <tr><td className="p-3 text-xs text-muted-foreground" colSpan={5}>No outbound clicks recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ranking weight */}
      <section className="mt-8 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Ranking weight (secondary signal)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Relevance, freshness, availability, budget fit and source verification decide the order. A monetised listing may gain at most 5% — the current setting is{" "}
          <strong>{Math.round((rankingSetting?.weight ?? 0.03) * 100)}%</strong>. Every recommendation records its pre-boost relevance score.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[0, 0.01, 0.03, 0.05].map((w) => (
            <Button key={w} size="sm" variant={Math.abs((rankingSetting?.weight ?? 0.03) - w) < 0.0001 ? "ember" : "glass"} onClick={() => weightMut.mutate(w)}>
              {Math.round(w * 100)}%
            </Button>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
