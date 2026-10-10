import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { getIngestionHealth } from "@/lib/ingestion/admin.functions";
import { formatIst } from "@/lib/ingestion/timezone";

export const Route = createFileRoute("/admin/data-health")({ staticData: { sitemap: false }, component: DataHealthPage });

const pct = (n: number, total: number) => (total === 0 ? "—" : `${Math.round((n / total) * 100)}%`);

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function DataHealthPage() {
  const q = useQuery({ queryKey: ["admin-ingestion-health"], queryFn: () => getIngestionHealth(), refetchInterval: 60_000 });
  const d = q.data;

  return (
    <AdminShell title="Data health">
      {q.isLoading && <p className="text-sm text-muted-foreground">Gathering catalogue health…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {d && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Review queue" value={d.reviewQueue} tone={d.reviewQueue > 0 ? "text-saffron" : ""} />
            <Stat label="Duplicate candidates" value={d.duplicates} tone={d.duplicates > 0 ? "text-saffron" : ""} />
            <Stat label="Expiring today (IST)" value={d.expiringToday} />
            <Stat label="Cancelled / postponed" value={d.cancelled} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Catalogue coverage</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="py-2">Type</th><th className="py-2">Total</th><th className="py-2">Verified</th><th className="py-2">Updated &lt;24h</th><th className="py-2">Stale</th></tr>
                </thead>
                <tbody>
                  {d.catalogue.map((c) => (
                    <tr key={c.table} className="border-t border-border">
                      <td className="py-2 capitalize">{c.table}</td>
                      <td className="py-2 font-mono">{c.total}</td>
                      <td className="py-2 font-mono text-teal">{c.verified} <span className="text-muted-foreground">({pct(c.verified, c.total)})</span></td>
                      <td className="py-2 font-mono">{c.fresh24h} <span className="text-muted-foreground">({pct(c.fresh24h, c.total)})</span></td>
                      <td className={`py-2 font-mono ${c.stale > 0 ? "text-saffron" : "text-muted-foreground"}`}>{c.stale} <span className="text-muted-foreground">({pct(c.stale, c.total)})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Ingestion, last 24 hours (IST)</h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Runs" value={d.today.jobs} />
              <Stat label="Succeeded" value={d.today.success} tone="text-teal" />
              <Stat label="Failed" value={d.today.failed} tone={d.today.failed > 0 ? "text-destructive" : ""} />
              <Stat label="Created" value={d.today.created} />
              <Stat label="Updated" value={d.today.updated} />
              <Stat label="Records failed" value={d.today.failedRecords} tone={d.today.failedRecords > 0 ? "text-saffron" : ""} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">By source</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="py-2">Source</th><th className="py-2">Enabled</th><th className="py-2">Last run</th><th className="py-2">Last success</th><th className="py-2">Created</th><th className="py-2">Updated</th><th className="py-2">Failed</th></tr>
                </thead>
                <tbody>
                  {d.sources.map((s) => (
                    <tr key={s.slug} className="border-t border-border align-top">
                      <td className="py-2">
                        {s.name}
                        {s.last_error && <p className="max-w-[240px] truncate text-xs text-destructive">{s.last_error}</p>}
                      </td>
                      <td className="py-2 font-mono text-xs">{s.enabled ? "yes" : "no"}</td>
                      <td className="py-2 font-mono text-xs">{s.last_run_at ? `${formatIst(s.last_run_at)} IST` : "never"}</td>
                      <td className="py-2 font-mono text-xs">{s.stats?.last_success ? `${formatIst(s.stats.last_success)} IST` : "never"}</td>
                      <td className="py-2 font-mono">{s.stats?.created ?? 0}</td>
                      <td className="py-2 font-mono">{s.stats?.updated ?? 0}</td>
                      <td className="py-2 font-mono">{s.stats?.failed ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Recent runs</h2>
            <ul className="space-y-1.5 text-xs">
              {d.recentJobs.length === 0 && <li className="text-muted-foreground">No ingestion runs recorded yet.</li>}
              {d.recentJobs.map((j, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-border py-1.5 first:border-t-0">
                  <span>{j.source_name ?? "pipeline"} · {j.job_type}</span>
                  <span className={`font-mono ${j.status === "failed" ? "text-destructive" : j.status === "success" ? "text-teal" : "text-muted-foreground"}`}>
                    {j.status} · {formatIst(j.started_at)} IST
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
