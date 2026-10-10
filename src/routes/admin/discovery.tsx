import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoveryAction, listDiscovery, runDiscoveryNow } from "@/lib/ingestion/admin.functions";
import { formatIst } from "@/lib/ingestion/timezone";

export const Route = createFileRoute("/admin/discovery")({ staticData: { sitemap: false },
  component: Discovery,
  head: () => ({
    meta: [
      { title: "Discovery candidates · MyMood admin" },
      { name: "description", content: "Review discovered Mumbai venues and organisers, resolve their official sources and promote validated pages into ingestion." },
      { property: "og:title", content: "Discovery candidates · MyMood admin" },
      { property: "og:description", content: "Discovered venues, official-source resolution status and next actions for the MyMood Mumbai catalogue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Status = "all" | "DISCOVERED" | "SOURCE_FOUND" | "VALIDATED" | "INGESTED" | "REJECTED";
const STATUSES: Status[] = ["all", "DISCOVERED", "SOURCE_FOUND", "VALIDATED", "INGESTED", "REJECTED"];

function Discovery() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("all");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const q = useQuery({ queryKey: ["admin-discovery", status], queryFn: () => listDiscovery({ data: { status } }) });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-discovery"] });

  const act = useMutation({
    mutationFn: (vars: { action: "recheck" | "promote" | "reject" | "reopen" | "add_candidate" | "run_google"; id?: string; name?: string; url?: string }) =>
      discoveryAction({ data: vars }),
    onSuccess: () => { toast.success("Done"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolve = useMutation({
    mutationFn: (task: "resolve" | "cross-verify") => runDiscoveryNow({ data: { task } }),
    onSuccess: () => { toast.success("Run finished"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const candidates = q.data?.candidates ?? [];
  const googleConfigured = q.data?.googleConfigured ?? false;
  const counts = STATUSES.slice(1).map((s) => ({ s, n: candidates.filter((c) => c.status === s).length }));

  return (
    <AdminShell
      title="Discovery"
      action={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ember" disabled={resolve.isPending} onClick={() => resolve.mutate("resolve")}>Resolve official sources</Button>
          <Button size="sm" variant="glass" disabled={resolve.isPending} onClick={() => resolve.mutate("cross-verify")}>Cross-verify</Button>
          <Button size="sm" variant="outline" disabled={act.isPending || !googleConfigured} onClick={() => act.mutate({ action: "run_google" })}>Run Google discovery</Button>
        </div>
      }
    >
      <div className={`rounded-2xl border p-4 text-sm ${googleConfigured ? "border-teal/40 bg-teal/10 text-teal" : "border-saffron/40 bg-saffron/10 text-saffron"}`}>
        {googleConfigured
          ? "Google discovery credential is configured. Enable the source under Sources, then run discovery."
          : "Google discovery is not configured yet. Add GOOGLE_PLACES_API_KEY in Project Settings → Secrets; the source stays switched off until then. Google is used only to identify candidate places and their own website links — no listing content is copied into the catalogue."}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "ember" : "outline"} onClick={() => setStatus(s)}>
            {s === "all" ? "All" : s.replace("_", " ").toLowerCase()}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {counts.map(({ s, n }) => (
          <span key={s} className="rounded-full border border-border px-2 py-0.5">{s.replace("_", " ").toLowerCase()}: {n}</span>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Add a candidate by hand</h2>
        <p className="mt-1 text-xs text-muted-foreground">Enter a real venue or organiser and its own website. The resolver will look for its what&apos;s-on page.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Venue or organiser name" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://venue.example.com" />
          <Button
            size="sm"
            variant="glass"
            disabled={act.isPending || name.trim().length < 2}
            onClick={() => act.mutate({ action: "add_candidate", name: name.trim(), ...(url.trim() ? { url: url.trim() } : {}) }, { onSuccess: () => { setName(""); setUrl(""); } })}
          >
            Add
          </Button>
        </div>
      </section>

      {q.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading candidates…</p>}
      {q.error && <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      {!q.isLoading && candidates.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No discovery candidates yet. Add one above, or configure and run Google discovery.</p>
      )}

      <div className="mt-4 space-y-3">
        {candidates.map((c) => {
          const pages = (q.data?.pages ?? []).filter((p) => p.candidate_id === c.id);
          const socials = (q.data?.socials ?? []).filter((s) => s.candidate_id === c.id);
          return (
            <article key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.status.replace("_", " ").toLowerCase()} · confidence {Number(c.confidence).toFixed(2)} · via {c.discovery_method}
                    {c.domain ? ` · ${c.domain}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Found {formatIst(c.discovered_at)} IST · last check {c.last_checked_at ? `${formatIst(c.last_checked_at)} IST` : "never"} · next {c.next_check_at ? `${formatIst(c.next_check_at)} IST` : "—"}
                  </p>
                  {c.official_website_url && <p className="mt-1 break-all text-xs text-muted-foreground">Official site: {c.official_website_url}</p>}
                  {c.events_page_url && <p className="break-all text-xs text-teal">What&apos;s-on page: {c.events_page_url}</p>}
                  {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
                  {c.last_error && <p className="mt-1 text-xs text-destructive">{c.last_error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="glass" disabled={act.isPending} onClick={() => act.mutate({ action: "recheck", id: c.id })}>Re-check</Button>
                  <Button size="sm" variant="ember" disabled={act.isPending || !c.events_page_url} onClick={() => act.mutate({ action: "promote", id: c.id })}>Promote to source</Button>
                  {c.status === "REJECTED" ? (
                    <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ action: "reopen", id: c.id })}>Reopen</Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ action: "reject", id: c.id })}>Reject</Button>
                  )}
                </div>
              </div>

              {pages.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                  {pages.map((p) => (
                    <li key={p.id} className="break-all text-muted-foreground">
                      <span className="font-mono text-[10px] uppercase tracking-wider">{p.kind}</span> · {p.url} · {Number(p.confidence).toFixed(2)}
                      {p.has_structured_data ? ` · structured: ${p.structured_kinds.join(", ")}` : ""}
                      {p.http_status ? ` · HTTP ${p.http_status}` : ""}
                      {p.validation_notes ? ` · ${p.validation_notes}` : ""}
                    </li>
                  ))}
                </ul>
              )}

              {socials.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {socials.map((s) => (
                    <li key={s.id} className="break-all">
                      <span className="font-mono text-[10px] uppercase tracking-wider">{s.platform}</span> · {s.profile_url} · {s.verification_state.toLowerCase()}
                      {s.authorised_api ? " · authorised API" : " · no authorised API access"}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </AdminShell>
  );
}
