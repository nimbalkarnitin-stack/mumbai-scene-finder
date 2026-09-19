import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SlidersHorizontal, CalendarDays } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/scene/AppShell";
import { ScenePicker } from "@/components/scene/ScenePicker";
import { SceneCard, SceneCardSkeleton } from "@/components/scene/SceneCard";
import { Button } from "@/components/ui/button";
import { getRecommendations } from "@/lib/scene.functions";
import { BUDGETS, GROUPS, MOODS, TIMINGS } from "@/lib/scene-constants";
import { track } from "@/lib/track";

const searchSchema = z.object({
  mood: z.string().optional(),
  group: z.string().optional(),
  budget: z.coerce.number().optional(),
  timing: z.string().optional(),
  area: z.string().optional(),
});

export const Route = createFileRoute("/scene")({
  validateSearch: searchSchema,
  head: ({ match }) => {
    const s = match.search;
    const mood = MOODS.find((m) => m.id === s.mood)?.label;
    const title = `${mood ? `${mood} picks` : "Your picks"} in Mumbai${s.timing ? ` · ${TIMINGS.find((t) => t.id === s.timing)?.label}` : ""} — SceneAI`;
    const desc = "Personalised Mumbai recommendations from SceneAI based on your mood, crew, budget, timing and area.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }] };
  },
  component: ScenePage,
});

function ScenePage() {
  const search = Route.useSearch();
  const [editing, setEditing] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["recs", search],
    queryFn: () => getRecommendations({ data: { ...search, limit: 10 } }),
  });

  useEffect(() => {
    if (data?.items.length) track("recommendation_view", { metadata: { ...search, count: data.items.length } });
  }, [data, search]);

  const summary = [
    MOODS.find((m) => m.id === search.mood)?.label,
    GROUPS.find((g) => g.id === search.group)?.label,
    BUDGETS.find((b) => b.id === search.budget)?.label && `under ${BUDGETS.find((b) => b.id === search.budget)?.label}`,
    TIMINGS.find((t) => t.id === search.timing)?.label,
    search.area && search.area.replace(/-/g, " "),
  ].filter(Boolean);

  return (
    <AppShell>
      <div className="px-4 pt-6 md:px-6 md:pt-10">
        <p className="eyebrow text-primary-glow">Your scene</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
            {summary.length ? summary.join(" · ") : "Tonight in Mumbai"}
          </h1>
          <div className="flex gap-2">
            <Button variant="glass" size="sm" onClick={() => setEditing((e) => !e)}>
              <SlidersHorizontal className="size-3.5" /> {editing ? "Hide filters" : "Refine"}
            </Button>
            <Button asChild variant="ember" size="sm">
              <Link to="/plan" search={{ mood: search.mood, group: search.group, budget: search.budget, timing: search.timing, area: search.area }}>
                <CalendarDays className="size-3.5" /> Build itinerary
              </Link>
            </Button>
          </div>
        </div>
        {editing && (
          <div className="mt-5 rounded-[1.75rem] border border-border bg-card/70 p-4 md:p-6 animate-rise">
            <ScenePicker initial={search} compact />
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <SceneCardSkeleton key={i} />)}
        {isError && <p className="col-span-full text-sm text-destructive">Couldn't load recommendations. Please try again.</p>}
        {data?.items.map((item, i) => <SceneCard key={item.id} item={item} index={i} />)}
        {data && data.items.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-10 text-center">
            <h2 className="text-xl font-semibold">Nothing verified matches yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              SceneAI never invents events or prices. Loosen a filter, or ask the concierge for ideas.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="glass" size="sm" onClick={() => setEditing(true)}>Change filters</Button>
              <Button asChild size="sm"><Link to="/concierge">Ask concierge</Link></Button>
            </div>
          </div>
        )}
      </div>
      {data && data.items.length > 0 && (
        <p className="px-4 pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:px-6">
          Ranked from {data.total} Mumbai listings · weighted on mood, budget, time, area, group, freshness, popularity &amp; your history
        </p>
      )}
    </AppShell>
  );
}
