import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataHealth } from "@/components/admin/DataHealth";
import { ENTITIES } from "@/lib/admin-entities";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({ component: Overview });

function Overview() {
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const tables = ["venues", "events", "experiences", "offers", "sponsors", "guides", "profiles"] as const;
      const counts = await Promise.all(tables.map(async (t) => { const { count } = await supabase.from(t).select("id", { count: "exact", head: true }); return [t, count ?? 0] as const; }));
      const { count: unverified } = await supabase.from("venues").select("id", { count: "exact", head: true }).eq("is_verified", false);
      const { data: recent } = await supabase.from("interactions").select("event_type,created_at").order("created_at", { ascending: false }).limit(10);
      return { counts: Object.fromEntries(counts), unverified: unverified ?? 0, recent: recent ?? [] };
    },
  });
  return (
    <AdminShell title="Overview">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(q.data?.counts ?? {}).map(([k, v]) => (
          <Link key={k} to={k === "profiles" ? "/admin/users" : "/admin/$entity"} params={{ entity: k }} className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
            <p className="eyebrow capitalize">{k === "profiles" ? "Users" : ENTITIES[k]?.label ?? k}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{v}</p>
          </Link>
        ))}
      </div>
      {q.data && q.data.unverified > 0 && (
        <p className="mt-6 rounded-2xl border border-saffron/30 bg-saffron/10 px-4 py-3 text-sm text-saffron">{q.data.unverified} venue{q.data.unverified === 1 ? "" : "s"} still unverified — confirm hours and prices before promoting them.</p>
      )}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">Recent activity</h2>
        {q.data?.recent.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
        <ul className="space-y-1.5 text-xs">
          {q.data?.recent.map((r, i) => <li key={i} className="flex justify-between"><span className="capitalize">{r.event_type.replace(/_/g, " ")}</span><span className="font-mono text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN")}</span></li>)}
        </ul>
      </div>
    </AdminShell>
  );
}
