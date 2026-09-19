import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { actOnSourceRecord, listReviewQueue, mergeDuplicate, setEventLifecycle, type ReviewQueue } from "@/lib/ingestion/admin.functions";
import { formatIst } from "@/lib/ingestion/timezone";

export const Route = createFileRoute("/admin/data-review")({ component: DataReview });

const QUEUES: { key: ReviewQueue; label: string }[] = [
  { key: "new", label: "New" },
  { key: "needs_review", label: "Needs review" },
  { key: "changed", label: "Changed" },
  { key: "expiring", label: "Expiring soon" },
  { key: "stale", label: "Stale" },
  { key: "failed", label: "Failed" },
  { key: "duplicates", label: "Duplicate candidates" },
  { key: "cancelled", label: "Cancelled / postponed" },
];

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}: <span className="text-foreground">{String(value)}</span>
    </p>
  );
}

function DataReview() {
  const [queue, setQueue] = useState<ReviewQueue>("new");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-review", queue], queryFn: () => listReviewQueue({ data: { queue } }) });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-review"] });
    void qc.invalidateQueries({ queryKey: ["admin-data-health"] });
  };
  const act = useMutation({
    mutationFn: (vars: { id: string; action: "approve" | "reject" | "verify" | "retry" | "needs_review" }) => actOnSourceRecord({ data: vars }),
    onSuccess: () => { toast.success("Record updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const lifecycle = useMutation({
    mutationFn: (vars: { id: string; lifecycle: "ACTIVE" | "CANCELLED" | "POSTPONED" | "EXPIRED" | "DRAFT" }) => setEventLifecycle({ data: vars }),
    onSuccess: () => { toast.success("Status updated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const merge = useMutation({
    mutationFn: (vars: { id: string; action: "merge" | "reject" }) => mergeDuplicate({ data: vars }),
    onSuccess: () => { toast.success("Duplicate resolved — both source records kept"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Data review">
      <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1">
        {QUEUES.map((t) => (
          <button
            key={t.key}
            onClick={() => setQueue(t.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${queue === t.key ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading queue…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data && "rows" in q.data && q.data.rows.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">This queue is empty.</p>
      )}

      <div className="space-y-3">
        {q.data?.kind === "records" &&
          q.data.rows.map((r) => {
            const n = (r.normalised ?? {}) as Record<string, unknown>;
            return (
              <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{String(n["name"] ?? "(unnamed record)")}</h3>
                    <Field label="Source" value={r.source_name} />
                    <Field label="Kind" value={String(n["kind"] ?? "unknown")} />
                    <Field label="Starts" value={n["startsAt"] ? `${formatIst(String(n["startsAt"]))} IST` : "not stated by source"} />
                    <Field label="Price" value={n["priceMin"] === null || n["priceMin"] === undefined ? "not stated" : `₹${String(n["priceMin"])}`} />
                    <Field label="Quality" value={r.quality_score ?? "—"} />
                    <Field label="State" value={r.verification_status} />
                    {r.error_message && <p className="mt-1 text-xs text-destructive">{r.error_message}</p>}
                    {r.source_url && (
                      <a href={r.source_url} target="_blank" rel="noreferrer noopener" className="mt-1 block truncate text-xs text-primary underline">
                        {r.source_url}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ember" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "approve" })}>Approve</Button>
                    <Button size="sm" variant="glass" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "verify" })}>Verify</Button>
                    <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "retry" })}>Retry</Button>
                    <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "reject" })}>Reject</Button>
                  </div>
                </div>
              </article>
            );
          })}

        {q.data?.kind === "events" &&
          q.data.rows.map((e) => (
            <article key={e.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{e.name}</h3>
                  <Field label="Starts" value={`${formatIst(e.starts_at)} IST`} />
                  <Field label="Status" value={e.lifecycle_status} />
                  <Field label="State" value={e.verification_status} />
                  <Field label="Source" value={e.source_name} />
                  <Field label="Last checked" value={e.source_last_checked_at ? `${formatIst(e.source_last_checked_at)} IST` : "—"} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="glass" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate({ id: e.id, lifecycle: "ACTIVE" })}>Mark active</Button>
                  <Button size="sm" variant="outline" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate({ id: e.id, lifecycle: "POSTPONED" })}>Postponed</Button>
                  <Button size="sm" variant="ghost" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate({ id: e.id, lifecycle: "CANCELLED" })}>Cancelled</Button>
                </div>
              </div>
            </article>
          ))}

        {q.data?.kind === "duplicates" &&
          q.data.rows.map((d) => (
            <article key={d.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Match score {Number(d.match_score).toFixed(0)}</p>
                  <h3 className="truncate font-semibold">{d.primary?.name ?? d.primary_id}</h3>
                  <Field label="Keeps" value={d.primary?.starts_at ? `${formatIst(d.primary.starts_at)} IST · ${d.primary.source_name ?? "—"}` : d.primary_id} />
                  <h3 className="mt-2 truncate font-semibold text-muted-foreground">{d.candidate?.name ?? d.candidate_id}</h3>
                  <Field label="Retires" value={d.candidate?.starts_at ? `${formatIst(d.candidate.starts_at)} IST · ${d.candidate.source_name ?? "—"}` : d.candidate_id} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ember" disabled={merge.isPending} onClick={() => merge.mutate({ id: d.id, action: "merge" })}>Merge</Button>
                  <Button size="sm" variant="ghost" disabled={merge.isPending} onClick={() => merge.mutate({ id: d.id, action: "reject" })}>Not a duplicate</Button>
                </div>
              </div>
            </article>
          ))}
      </div>
    </AdminShell>
  );
}
