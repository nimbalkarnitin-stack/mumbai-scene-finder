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
    </section>
  );
}
