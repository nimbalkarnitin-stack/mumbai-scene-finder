import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["venues", "events", "experiences"] as const;
type T = (typeof TABLES)[number];

interface Health { table: T; total: number; verified: number; unverified: number; active: number; inactive: number }

async function countOf(t: T, flag?: "is_verified" | "is_active") {
  const q = supabase.from(t).select("id", { count: "exact", head: true });
  const { count } = await (flag ? q.eq(flag, true) : q);
  return count ?? 0;
}

/** Read-only snapshot of catalogue coverage. No writes, no fabricated numbers. */
export function DataHealth() {
  const q = useQuery({
    queryKey: ["admin-data-health"],
    queryFn: async () => {
      const rows: Health[] = await Promise.all(
        TABLES.map(async (t) => {
          const [total, verified, active] = await Promise.all([
            countOf(t),
            countOf(t, "is_verified"),
            countOf(t, "is_active"),
          ]);
          return { table: t, total, verified, unverified: total - verified, active, inactive: total - active };
        }),
      );
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * 86400000);
      const { count: upcoming } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("starts_at", now.toISOString())
        .lte("starts_at", in7.toISOString());
      return { rows, upcoming: upcoming ?? 0 };
    },
  });

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Data health</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Read-only</span>
      </div>
      {q.isLoading && <p className="text-xs text-muted-foreground">Checking the catalogue…</p>}
      {q.error && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="py-2">Type</th><th className="py-2">Total</th><th className="py-2">Verified</th><th className="py-2">Unverified</th><th className="py-2">Active</th><th className="py-2">Inactive</th></tr>
              </thead>
              <tbody>
                {q.data.rows.map((r) => (
                  <tr key={r.table} className="border-t border-border">
                    <td className="py-2 capitalize">{r.table}</td>
                    <td className="py-2 font-mono">{r.total}</td>
                    <td className="py-2 font-mono text-teal">{r.verified}</td>
                    <td className={`py-2 font-mono ${r.unverified > 0 ? "text-saffron" : "text-muted-foreground"}`}>{r.unverified}</td>
                    <td className="py-2 font-mono">{r.active}</td>
                    <td className="py-2 font-mono text-muted-foreground">{r.inactive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Events starting in the next 7 days (Asia/Kolkata): <span className="font-mono text-foreground">{q.data.upcoming}</span>
            {q.data.upcoming === 0 && " — the public “what's on” pages will stay empty until upcoming events are added."}
          </p>
        </>
      )}
      <VenueQuality />
      <DiscoveryPipelineHealth />
    </section>
  );
}

/** Read-only discovery + ingestion pipeline snapshot: candidate lifecycle, runs, errors, freshness. */
function DiscoveryPipelineHealth() {
  const q = useQuery({
    queryKey: ["admin-discovery-pipeline-health"],
    queryFn: async () => {
      const candidateCount = async (status?: string) => {
        const base = supabase.from("discovery_candidates").select("id", { count: "exact", head: true });
        const { count } = await (status ? base.eq("status", status) : base);
        return count ?? 0;
      };
      const [candidates, discovered, sourceFound, validated, rejected, ingested] = await Promise.all([
        candidateCount(),
        candidateCount("DISCOVERED"),
        candidateCount("SOURCE_FOUND"),
        candidateCount("VALIDATED"),
        candidateCount("REJECTED"),
        candidateCount("INGESTED"),
      ]);
      const [{ count: sourcePages }, { count: publishedSources }, { data: jobs }, { data: sources }] = await Promise.all([
        supabase.from("discovery_source_candidates").select("id", { count: "exact", head: true }),
        supabase.from("source_records").select("id", { count: "exact", head: true }).eq("review_status", "published"),
        supabase.from("ingestion_jobs").select("job_type,status,started_at,finished_at,records_created,records_updated,records_failed,error_summary").order("started_at", { ascending: false }).limit(8),
        supabase.from("ingestion_sources").select("slug,name,enabled,last_status,last_run_at,last_error").order("slug"),
      ]);
      return { candidates, discovered, sourceFound, validated, rejected, ingested, sourcePages: sourcePages ?? 0, publishedSources: publishedSources ?? 0, jobs: jobs ?? [], sources: sources ?? [] };
    },
  });

  if (!q.data) return null;
  const d = q.data;
  const stat = (label: string, value: number) => (
    <div key={label} className="rounded-xl border border-border px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="mb-3 text-sm font-semibold">Discovery pipeline</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Candidates", d.candidates)}
        {stat("Discovered", d.discovered)}
        {stat("Source found", d.sourceFound)}
        {stat("Validated", d.validated)}
        {stat("Ingested", d.ingested)}
        {stat("Rejected", d.rejected)}
        {stat("Source pages", d.sourcePages)}
        {stat("Published sources", d.publishedSources)}
      </div>

      <h4 className="mt-4 text-xs font-semibold">Recent runs</h4>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {d.jobs.length === 0 && <li>No runs recorded yet.</li>}
        {d.jobs.map((j, i) => (
          <li key={`${j.job_type}-${j.started_at}-${i}`}>
            <span className="text-foreground">{j.job_type}</span> · {j.status} · {new Date(j.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · +{j.records_created} new, {j.records_updated} updated, {j.records_failed} failed
            {j.error_summary ? ` · ${j.error_summary.slice(0, 120)}` : ""}
          </li>
        ))}
      </ul>

      <h4 className="mt-4 text-xs font-semibold">Source freshness</h4>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {d.sources.map((s) => (
          <li key={s.slug}>
            <span className="text-foreground">{s.name}</span> · {s.enabled ? "enabled" : "disabled"} · last run{" "}
            {s.last_run_at ? new Date(s.last_run_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "never"}
            {s.last_status ? ` · ${s.last_status}` : ""}
            {s.last_error ? ` · ${s.last_error.slice(0, 100)}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">Counts read live from the pipeline tables. Swiggy live data is never counted here — it is session-only and never stored.</p>
    </div>
  );
}


/** Read-only venue completeness + Mumbai-location snapshot. Figures come straight from the rows. */
function VenueQuality() {
  const q = useQuery({
    queryKey: ["admin-venue-quality"],
    queryFn: async () => {
      const { data } = await supabase
        .from("venues")
        .select("id,name,geo_status,completeness_score,missing_fields,quarantine_reason,opening_hours,phone,reservation_url,booking_url,menu_url,address,lat,is_active")
        .limit(1000);
      const rows = data ?? [];
      const count = (fn: (r: (typeof rows)[number]) => boolean) => rows.filter(fn).length;
      const scores = rows.map((r) => Number(r.completeness_score ?? 0));
      return {
        total: rows.length,
        valid: count((r) => r.geo_status === "VALID"),
        unverifiedGeo: count((r) => r.geo_status === "UNVERIFIED"),
        outOfRegion: count((r) => r.geo_status === "OUT_OF_REGION"),
        quarantined: count((r) => !!r.quarantine_reason),
        withHours: count((r) => !!r.opening_hours),
        withPhone: count((r) => !!r.phone),
        withBooking: count((r) => !!(r.reservation_url ?? r.booking_url)),
        withMenu: count((r) => !!r.menu_url),
        withAddress: count((r) => !!r.address),
        withCoords: count((r) => r.lat !== null),
        average: rows.length ? Number((scores.reduce((a, b) => a + b, 0) / rows.length).toFixed(1)) : 0,
        worst: [...rows].sort((a, b) => Number(a.completeness_score ?? 0) - Number(b.completeness_score ?? 0)).slice(0, 5),
      };
    },
  });

  if (!q.data) return null;
  const d = q.data;
  const stat = (label: string, value: number, suffix = "") => (
    <div key={label} className="rounded-xl border border-border px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}{suffix}</p>
    </div>
  );

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="mb-3 text-sm font-semibold">Venue profile quality</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Venues", d.total)}
        {stat("Avg completeness", d.average, "%")}
        {stat("Mumbai confirmed", d.valid)}
        {stat("Location unclear", d.unverifiedGeo)}
        {stat("Outside Mumbai", d.outOfRegion)}
        {stat("Quarantined", d.quarantined)}
        {stat("With hours", d.withHours)}
        {stat("With phone", d.withPhone)}
        {stat("With booking link", d.withBooking)}
        {stat("With menu", d.withMenu)}
        {stat("With address", d.withAddress)}
        {stat("With coordinates", d.withCoords)}
      </div>
      {d.worst.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {d.worst.map((r) => (
            <li key={r.id}>
              <span className="text-foreground">{r.name}</span> — {Number(r.completeness_score ?? 0)}% complete
              {r.missing_fields?.length ? `; missing ${r.missing_fields.slice(0, 5).join(", ")}` : ""}
              {r.quarantine_reason ? ` · quarantined: ${r.quarantine_reason}` : ""}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Completeness counts only fields a permitted source published; it never affects ranking.</p>
    </div>
  );
}
