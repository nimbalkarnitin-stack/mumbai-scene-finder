import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listSources, runIngestionNow, updateSource } from "@/lib/ingestion/admin.functions";
import { formatIst } from "@/lib/ingestion/timezone";

export const Route = createFileRoute("/admin/sources")({ component: Sources });

function Sources() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-sources"], queryFn: () => listSources() });
  const [pages, setPages] = useState<Record<string, string>>({});

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-sources"] });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof updateSource>[0] extends never ? never : { id: string; enabled?: boolean; refresh_interval_minutes?: number; authority_level?: number; config?: Record<string, unknown> }) =>
      updateSource({ data: vars }),
    onSuccess: () => { toast.success("Source updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = useMutation({
    mutationFn: (vars: { source?: string; task?: "orchestrate" | "verify" | "expire" | "dedupe" | "publish" }) => runIngestionNow({ data: vars }),
    onSuccess: () => { toast.success("Ingestion run finished — check Data health"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Sources"
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ember" disabled={run.isPending} onClick={() => run.mutate({ task: "orchestrate" })}>Run all</Button>
          <Button size="sm" variant="glass" disabled={run.isPending} onClick={() => run.mutate({ task: "expire" })}>Expire ended</Button>
          <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ task: "dedupe" })}>Find duplicates</Button>
        </div>
      }
    >
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading sources…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      <div className="space-y-3">
        {q.data?.sources.map((s) => {
          const cfgPages = Array.isArray((s.config as { pages?: unknown })?.pages) ? ((s.config as { pages: string[] }).pages) : [];
          const draft = pages[s.id] ?? cfgPages.join("\n");
          return (
            <article key={s.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.source_type} · adapter {s.adapter_key} · authority {s.authority_level}/5 · every {s.refresh_interval_minutes} min
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Last run: {s.last_run_at ? `${formatIst(s.last_run_at)} IST` : "never"} · {s.last_status ?? "—"}
                  </p>
                  {s.notes && <p className="mt-1 max-w-prose text-xs text-muted-foreground">{s.notes}</p>}
                  {s.last_error && <p className="mt-1 text-xs text-destructive">{s.last_error}</p>}
                  {s.requires_credentials && (
                    <p className={`mt-2 rounded-xl border px-3 py-2 text-xs ${s.credentials_ready ? "border-teal/40 bg-teal/10 text-teal" : "border-saffron/40 bg-saffron/10 text-saffron"}`}>
                      {s.credentials_ready
                        ? "Authorised access configured."
                        : `Credentials required before this source can run: ${s.missing_credentials.join(", ")}. Add them in Project Settings → Secrets once you have authorised access. Values are never shown here.`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${s.enabled ? "border-teal/40 bg-teal/10 text-teal" : "border-border text-muted-foreground"}`}>
                    {s.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <Button size="sm" variant={s.enabled ? "ghost" : "ember"} disabled={save.isPending || (!s.enabled && s.requires_credentials && !s.credentials_ready)}
                    onClick={() => save.mutate({ id: s.id, enabled: !s.enabled })}>
                    {s.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="glass" disabled={run.isPending || !s.enabled} onClick={() => run.mutate({ source: s.slug })}>Run now</Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow">Refresh interval (minutes)</span>
                  <Input
                    type="number"
                    min={15}
                    defaultValue={s.refresh_interval_minutes}
                    className="mt-1"
                    onBlur={(e) => {
                      const v = Number(e.currentTarget.value);
                      if (v && v !== s.refresh_interval_minutes) save.mutate({ id: s.id, refresh_interval_minutes: v });
                    }}
                  />
                </label>
                <label className="block">
                  <span className="eyebrow">Authority level (1–5)</span>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    defaultValue={s.authority_level}
                    className="mt-1"
                    onBlur={(e) => {
                      const v = Number(e.currentTarget.value);
                      if (v && v !== s.authority_level) save.mutate({ id: s.id, authority_level: v });
                    }}
                  />
                </label>
              </div>

              {s.adapter_key === "official_site" && (
                <div className="mt-3">
                  <span className="eyebrow">Official page URLs (one per line — first-party venue/organiser pages only)</span>
                  <textarea
                    value={draft}
                    onChange={(e) => setPages((p) => ({ ...p, [s.id]: e.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
                    placeholder="https://venue.example.com/events"
                  />
                  <Button
                    size="sm"
                    variant="glass"
                    className="mt-2"
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate({
                        id: s.id,
                        config: { ...(s.config as Record<string, unknown>), pages: draft.split(/\s+/).map((p) => p.trim()).filter(Boolean) },
                      })
                    }
                  >
                    Save pages
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </AdminShell>
  );
}
