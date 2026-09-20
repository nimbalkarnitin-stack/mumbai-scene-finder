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
    </section>
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
