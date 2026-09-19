import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoveryAction, googleDiscoveryStatus, googleTestConnection, listSources, runIngestionNow, setGoogleQueries, updateSource } from "@/lib/ingestion/admin.functions";
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

              {s.adapter_key === "apify" && (
                <ApifyConfig
                  source={s}
                  saving={save.isPending}
                  onSave={(config) => save.mutate({ id: s.id, config: { ...(s.config as Record<string, unknown>), ...config } })}
                />
              )}

              {s.adapter_key === "google_discovery" && (
                <GoogleDiscoveryConfig
                  source={s}
                  saving={save.isPending}
                  onSave={(config) => save.mutate({ id: s.id, config: { ...(s.config as Record<string, unknown>), ...config } })}
                />
              )}


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

interface ApifySourceRow {
  config: unknown;
  credentials_ready: boolean;
  missing_credentials: string[];
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  enabled: boolean;
}

/** Apify Actor configuration. Shows connector + actor readiness; never shows secret values. */
function ApifyConfig({ source, saving, onSave }: { source: ApifySourceRow; saving: boolean; onSave: (config: Record<string, unknown>) => void }) {
  const cfg = (source.config ?? {}) as { actor_id?: unknown; actor_input?: unknown; run_timeout_seconds?: unknown; max_items?: unknown; page_size?: unknown };
  const [actorId, setActorId] = useState(typeof cfg.actor_id === "string" ? cfg.actor_id : "");
  const [input, setInput] = useState(JSON.stringify(cfg.actor_input ?? {}, null, 2));
  const [inputError, setInputError] = useState<string | null>(null);
  const actorReady = typeof cfg.actor_id === "string" && cfg.actor_id.trim().length > 0;

  const submit = () => {
    let parsed: unknown = {};
    try {
      parsed = input.trim() ? JSON.parse(input) : {};
    } catch {
      setInputError("Actor input must be valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setInputError("Actor input must be a JSON object.");
      return;
    }
    if (!actorId.trim()) {
      setInputError("Enter the Actor ID (owner~actor-name) you are authorised to run.");
      return;
    }
    setInputError(null);
    onSave({ actor_id: actorId.trim(), actor_input: parsed });
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-background/60 p-3">
      <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-wider">
        <span className={`rounded-full border px-2 py-0.5 ${source.credentials_ready ? "border-teal/40 bg-teal/10 text-teal" : "border-saffron/40 bg-saffron/10 text-saffron"}`}>
          Connector {source.credentials_ready ? "connected" : "not connected"}
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${actorReady ? "border-teal/40 bg-teal/10 text-teal" : "border-saffron/40 bg-saffron/10 text-saffron"}`}>
          Actor {actorReady ? "configured" : "not configured"}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          Last run {source.last_run_at ? `${formatIst(source.last_run_at)} IST` : "never"} · {source.last_status ?? "—"}
        </span>
      </div>

      {!source.credentials_ready && (
        <p className="text-xs text-muted-foreground">
          Link the Apify account to this project first. Credentials stay on the server and are never shown here.
        </p>
      )}

      <label className="block">
        <span className="eyebrow">Actor ID (owner~actor-name)</span>
        <Input value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="owner~actor-name" className="mt-1 font-mono text-xs" />
      </label>

      <label className="block">
        <span className="eyebrow">Actor input (JSON)</span>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs"
          placeholder={'{\n  "city": "mumbai"\n}'}
        />
      </label>

      {inputError && <p className="text-xs text-destructive">{inputError}</p>}
      {source.last_error && <p className="text-xs text-destructive">Last error: {source.last_error}</p>}

      <Button size="sm" variant="glass" disabled={saving} onClick={submit}>
        Save Actor configuration
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Only run Actors you are authorised to use. Nothing is fetched until this source is enabled and run.
      </p>
    </div>
  );
}

interface GoogleSourceRow {
  config: unknown;
  credentials_ready: boolean;
  missing_credentials: string[];
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  enabled: boolean;
}

/**
 * Google Discovery panel: status, credential state, query registry, budget and controls.
 * Google is a discovery signal only — it identifies candidate places and their own website links.
 * No Google listing content is stored, and the source cannot run without the Places credential.
 */
function GoogleDiscoveryConfig({ source, saving, onSave }: { source: GoogleSourceRow; saving: boolean; onSave: (config: Record<string, unknown>) => void }) {
  const qc = useQueryClient();
  const cfg = (source.config ?? {}) as { queries_per_run?: unknown; daily_request_budget?: unknown; monthly_request_budget?: unknown };
  const status = useQuery({ queryKey: ["google-discovery-status"], queryFn: () => googleDiscoveryStatus() });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["google-discovery-status"] });
    void qc.invalidateQueries({ queryKey: ["admin-sources"] });
  };

  const test = useMutation({
    mutationFn: () => googleTestConnection(),
    onSuccess: (r) => { r.ok ? toast.success(r.message) : toast.error(r.message); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleQueries = useMutation({
    mutationFn: (vars: { enabled: boolean; area?: string; category?: string }) => setGoogleQueries({ data: vars }),
    onSuccess: (r) => { toast.success(`${r.updated} queries updated`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const runNow = useMutation({
    mutationFn: () => discoveryAction({ data: { action: "run_google", confirm: true } }),
    onSuccess: (r) => {
      const d = r.result as { queries_succeeded: number; new_candidates: number; duplicate_candidates: number; api_requests: number };
      toast.success(`${d.queries_succeeded} queries · ${d.new_candidates} new candidates · ${d.duplicate_candidates} duplicates · ${d.api_requests} API requests`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = status.data;
  const [area, setArea] = useState("");

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-background/60 p-3">
      <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-wider">
        <span className={`rounded-full border px-2 py-0.5 ${s?.credentialConfigured ? "border-teal/40 bg-teal/10 text-teal" : "border-saffron/40 bg-saffron/10 text-saffron"}`}>
          {s?.status ?? "loading"}
        </span>
        <span className={`rounded-full border px-2 py-0.5 ${s?.credentialConfigured ? "border-teal/40 bg-teal/10 text-teal" : "border-saffron/40 bg-saffron/10 text-saffron"}`}>
          Credential {s?.credentialConfigured ? `configured (${s.credentialEnvName})` : "missing"}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          {s ? `${s.queries.enabled}/${s.queries.total} queries enabled` : "queries —"}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          Last run {source.last_run_at ? `${formatIst(source.last_run_at)} IST` : "never"} · {source.last_status ?? "—"}
        </span>
      </div>

      {s && !s.credentialConfigured && (
        <p className="text-xs text-muted-foreground">
          Add {s.missingCredentials.join(" or ")} in Project Settings → Secrets. No Google requests are made until the credential exists, and its value is never shown here.
        </p>
      )}

      {s && (
        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Requests today" value={`${s.requests.today}/${s.requests.dailyLimit}`} />
          <Metric label="Requests this month" value={`${s.requests.month}/${s.requests.monthlyLimit}`} />
          <Metric label="Candidates found" value={`${s.candidates.total}`} />
          <Metric label="Official sources found" value={`${s.candidates.sourceFound}`} />
          <Metric label="Validated" value={`${s.candidates.validated}`} />
          <Metric label="Ingested" value={`${s.candidates.ingested}`} />
          <Metric label="Rejected / failed" value={`${s.candidates.rejected} / ${s.candidates.failed}`} />
          <Metric label="Open conflicts" value={`${s.openConflicts}`} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="eyebrow">Queries per run</span>
          <Input type="number" min={1} max={60} defaultValue={Number(cfg.queries_per_run ?? 30)} className="mt-1"
            onBlur={(e) => { const v = Number(e.currentTarget.value); if (v) onSave({ queries_per_run: Math.min(60, Math.max(1, v)) }); }} />
        </label>
        <label className="block">
          <span className="eyebrow">Daily request budget</span>
          <Input type="number" min={1} defaultValue={Number(cfg.daily_request_budget ?? 500)} className="mt-1"
            onBlur={(e) => { const v = Number(e.currentTarget.value); if (v) onSave({ daily_request_budget: v }); }} />
        </label>
        <label className="block">
          <span className="eyebrow">Monthly request budget</span>
          <Input type="number" min={1} defaultValue={Number(cfg.monthly_request_budget ?? 5000)} className="mt-1"
            onBlur={(e) => { const v = Number(e.currentTarget.value); if (v) onSave({ monthly_request_budget: v }); }} />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="eyebrow">Area or category</span>
          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Bandra West" className="mt-1" />
        </label>
        <Button size="sm" variant="glass" disabled={toggleQueries.isPending || !area.trim()} onClick={() => toggleQueries.mutate({ enabled: true, area: area.trim() })}>Enable area</Button>
        <Button size="sm" variant="ghost" disabled={toggleQueries.isPending || !area.trim()} onClick={() => toggleQueries.mutate({ enabled: false, area: area.trim() })}>Disable area</Button>
        <Button size="sm" variant="glass" disabled={toggleQueries.isPending || !area.trim()} onClick={() => toggleQueries.mutate({ enabled: true, category: area.trim() })}>Enable category</Button>
        <Button size="sm" variant="ghost" disabled={toggleQueries.isPending || !area.trim()} onClick={() => toggleQueries.mutate({ enabled: false, category: area.trim() })}>Disable category</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate()}>Test connection</Button>
        <Button
          size="sm"
          variant="ember"
          disabled={runNow.isPending || saving || !source.enabled || !s?.credentialConfigured}
          onClick={() => {
            if (!window.confirm(`Run Google Discovery now? This will spend up to ${Number(cfg.queries_per_run ?? 30)} Google Places requests.`)) return;
            runNow.mutate();
          }}
        >
          Run now
        </Button>
      </div>

      {source.last_error && <p className="text-xs text-destructive">Last error: {source.last_error}</p>}
      {s?.recentErrors?.map((e, i) => (
        <p key={i} className="text-xs text-destructive">HTTP {e.http_status} · {e.endpoint} · {String(e.error).slice(0, 160)}</p>
      ))}

      {s && s.queries.recent.length > 0 && (
        <div className="max-h-52 overflow-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-background/80 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-2">Query</th><th className="p-2">Last run</th><th className="p-2">Results</th></tr>
            </thead>
            <tbody>
              {s.queries.recent.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2">{row.query_text}</td>
                  <td className="p-2 text-muted-foreground">{row.last_run_at ? `${formatIst(row.last_run_at)} IST` : "never"}</td>
                  <td className="p-2 text-muted-foreground">{row.last_error ? <span className="text-destructive">error</span> : (row.last_result_count ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Only candidate names, Place IDs and their own website links are stored. Event facts always come from the official or authorised source, never from Google listings.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
