import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/analytics")({ component: AnalyticsPage });

const EVENTS = ["search", "recommendation_view", "item_view", "save", "share", "booking_click", "conversion", "itinerary_generated", "concierge_message", "preference_set"];

function AnalyticsPage() {
  const q = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const [{ data: ints, error }, { data: rev }] = await Promise.all([
        supabase.from("interactions").select("event_type,metadata,created_at,item_type,item_id").gte("created_at", since).limit(5000),
        supabase.from("revenue_events").select("amount,source,occurred_at").gte("occurred_at", since),
      ]);
      if (error) throw error;
      const counts: Record<string, number> = {};
      const moods: Record<string, number> = {};
      const areas: Record<string, number> = {};
      const items: Record<string, number> = {};
      for (const i of ints ?? []) {
        counts[i.event_type] = (counts[i.event_type] ?? 0) + 1;
        const m = (i.metadata ?? {}) as Record<string, unknown>;
        if (i.event_type === "search") {
          if (typeof m["mood"] === "string") moods[m["mood"]] = (moods[m["mood"]] ?? 0) + 1;
          if (typeof m["area"] === "string") areas[m["area"]] = (areas[m["area"]] ?? 0) + 1;
        }
        if (i.event_type === "booking_click" && i.item_id) items[`${i.item_type}:${i.item_id}`] = (items[`${i.item_type}:${i.item_id}`] ?? 0) + 1;
      }
      const revenue = (rev ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const bySource: Record<string, number> = {};
      for (const r of rev ?? []) bySource[r.source] = (bySource[r.source] ?? 0) + Number(r.amount);
      const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { counts, moods: top(moods), areas: top(areas), items: top(items), revenue, bySource: top(bySource), total: ints?.length ?? 0 };
    },
  });
  const d = q.data;
  const conv = d && d.counts["recommendation_view"] ? ((d.counts["booking_click"] ?? 0) / d.counts["recommendation_view"] * 100).toFixed(1) : "0.0";
  return (
    <AdminShell title="Analytics · last 30 days">
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={`₹${(d?.revenue ?? 0).toLocaleString("en-IN")}`} />
        <Stat label="Interactions" value={String(d?.total ?? 0)} />
        <Stat label="Booking clicks" value={String(d?.counts["booking_click"] ?? 0)} />
        <Stat label="View → click" value={`${conv}%`} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Events">{EVENTS.map((e) => <Bar key={e} label={e.replace(/_/g, " ")} value={d?.counts[e] ?? 0} max={Math.max(1, ...Object.values(d?.counts ?? {}))} />)}</Panel>
        <Panel title="Revenue by source">{(d?.bySource ?? []).map(([k, v]) => <Bar key={k} label={k} value={v} max={Math.max(1, ...(d?.bySource ?? []).map(([, n]) => n))} money />)}{d && d.bySource.length === 0 && <Empty />}</Panel>
        <Panel title="Top moods searched">{(d?.moods ?? []).map(([k, v]) => <Bar key={k} label={k} value={v} max={d?.moods[0]?.[1] ?? 1} />)}{d && d.moods.length === 0 && <Empty />}</Panel>
        <Panel title="Top areas searched">{(d?.areas ?? []).map(([k, v]) => <Bar key={k} label={k} value={v} max={d?.areas[0]?.[1] ?? 1} />)}{d && d.areas.length === 0 && <Empty />}</Panel>
        <Panel title="Most-clicked listings">{(d?.items ?? []).map(([k, v]) => <Bar key={k} label={k} value={v} max={d?.items[0]?.[1] ?? 1} />)}{d && d.items.length === 0 && <Empty />}</Panel>
      </div>
    </AdminShell>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-border bg-card p-4"><p className="eyebrow">{label}</p><p className="mt-1 font-display text-3xl font-semibold">{value}</p></div>
);
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-4"><h2 className="mb-3 font-semibold">{title}</h2><div className="space-y-2">{children}</div></div>
);
const Bar = ({ label, value, max, money }: { label: string; value: number; max: number; money?: boolean }) => (
  <div className="text-xs"><div className="flex justify-between"><span className="capitalize">{label}</span><span className="font-mono">{money ? `₹${value.toLocaleString("en-IN")}` : value}</span></div><div className="mt-1 h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-primary to-saffron" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} /></div></div>
);
const Empty = () => <p className="text-xs text-muted-foreground">No data yet.</p>;
