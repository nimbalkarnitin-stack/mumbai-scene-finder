import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SlidersHorizontal, CalendarDays } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/scene/AppShell";
import { ScenePicker } from "@/components/scene/ScenePicker";
import { SceneCard, SceneCardSkeleton } from "@/components/scene/SceneCard";
import { CatalogueEmptyState } from "@/components/scene/CatalogueEmptyState";
import { SponsoredRail } from "@/components/scene/SponsoredRail";
import { AffiliateDisclosure } from "@/components/scene/Disclosure";
import { Button } from "@/components/ui/button";
import { getRecommendations } from "@/lib/scene.functions";
import { BUDGETS, GROUPS, MOODS, TIMINGS } from "@/lib/scene-constants";
import { getHistorySignal, recordHistory } from "@/lib/history";
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
    const title = `${mood ? `${mood} picks` : "Your picks"} in Mumbai${s.timing ? ` · ${TIMINGS.find((t) => t.id === s.timing)?.label}` : ""} — vybz`;
    const desc = "Personalised Mumbai recommendations from vybz based on your mood, crew, budget, timing and area.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }] };
  },
  component: ScenePage,
});

function ScenePage() {
  const search = Route.useSearch();
  const [editing, setEditing] = useState(false);
  // Anonymous, device-local interest signal — slugs only, no personal data.
  const [history, setHistory] = useState<ReturnType<typeof getHistorySignal>>(undefined);

  useEffect(() => {
    recordHistory({ mood: search.mood ?? null, area: search.area ?? null });
    setHistory(getHistorySignal());
    track("search", { metadata: { ...search, surface: "scene" } });
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["recs", search, history],
    queryFn: () => getRecommendations({ data: { ...search, ...(history ? { history } : {}), limit: 10 } }),
  });

  useEffect(() => {
    if (!data) return;
    track("recommendation_view", { metadata: { ...search, count: data.items.length, candidates: data.total, personalised: !!history } });
    for (const item of data.items) {
      track("recommendation_impression", { itemType: item.type, itemId: item.id, metadata: { surface: "scene", score: item.score, relevanceScore: item.relevanceScore ?? item.score, monetisationBoost: item.monetisation?.boost ?? 0 } });
    }
  }, [data, search, history]);

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
          <CatalogueEmptyState className="col-span-full" filtered={data.total > 0} onChangeFilters={() => setEditing(true)} />
        )}
      </div>
      {data && data.items.length > 0 && <SponsoredRail className="mt-10" />}
      {data && data.items.length > 0 && <AffiliateDisclosure className="mx-4 mt-6 md:mx-6" />}
      {data && data.items.length > 0 && (
        <p className="px-4 pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:px-6">
          Ranked from {data.total} Mumbai listings · weighted on mood, budget, time, area, group, freshness, popularity &amp; your history · partner links may nudge order by at most {Math.round((data.monetisationWeight ?? 0) * 100)}%
        </p>
      )}
    </AppShell>
  );
}
