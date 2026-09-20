import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSwiggyHealth } from "@/lib/swiggy/admin.functions";
import { formatIst } from "@/lib/ingestion/timezone";

export const Route = createFileRoute("/admin/swiggy")({ component: SwiggyHealthPage });

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function SwiggyHealthPage() {
  const q = useQuery({ queryKey: ["admin-swiggy-health"], queryFn: () => getSwiggyHealth(), refetchInterval: 60_000 });
  const d = q.data;

  return (
    <AdminShell title="Swiggy integration">
      {q.isLoading && <p className="text-sm text-muted-foreground">Reading Swiggy integration health…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {d && (
        <div className="space-y-6">
          <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
            Connection counts and call metadata only. Access tokens, user identities and Swiggy response bodies are never stored or shown here.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active sessions" value={d.connections.active} tone="text-teal" />
            <Stat label="Expired sessions" value={d.connections.expired} tone={d.connections.expired > 0 ? "text-saffron" : ""} />
            <Stat label="Success rate" value={d.successRate === null ? "—" : `${d.successRate}%`} />
            <Stat label="Avg latency" value={d.avgLatencyMs === null ? "—" : `${d.avgLatencyMs} ms`} />
          </div>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p className="eyebrow mb-2">Session state</p>
              <p>Registered OAuth clients: <span className="font-mono">{d.registeredClients}</span></p>
              <p>Last successful call: <span className="font-mono">{d.lastSuccessAt ? formatIst(d.lastSuccessAt) : "—"}</span></p>
              <p>Last error: <span className="font-mono">{d.lastErrorAt ? `${formatIst(d.lastErrorAt)} · ${d.lastErrorClass}` : "—"}</span></p>
              <p>Retries in sample: <span className="font-mono">{d.totalRetries}</span> over {d.sampleSize} calls</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p className="eyebrow mb-2">Error classes</p>
              {d.errorClasses.length === 0 ? (
                <p className="text-muted-foreground">No failures in the recent sample.</p>
              ) : (
                <ul className="space-y-1">
                  {d.errorClasses.map((e) => (
                    <li key={e.errorClass} className="flex justify-between"><span>{e.errorClass}</span><span className="font-mono">{e.count}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">Tool usage</h2>
            {d.byTool.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Swiggy calls recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="py-2">Server · tool</th><th className="py-2">Calls</th><th className="py-2">Errors</th><th className="py-2">Avg ms</th><th className="py-2">Retries</th></tr>
                  </thead>
                  <tbody>
                    {d.byTool.map((t) => (
                      <tr key={t.tool} className="border-t border-border">
                        <td className="py-2 font-mono text-xs">{t.tool}</td>
                        <td className="py-2 font-mono">{t.calls}</td>
                        <td className={`py-2 font-mono ${t.errors > 0 ? "text-saffron" : ""}`}>{t.errors}</td>
                        <td className="py-2 font-mono">{t.avgMs}</td>
                        <td className="py-2 font-mono">{t.retries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
