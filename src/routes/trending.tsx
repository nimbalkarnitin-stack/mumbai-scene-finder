import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { SceneCard, SceneCardSkeleton } from "@/components/scene/SceneCard";
import { getTrending } from "@/lib/scene.functions";

const TITLE = "Trending in Mumbai — vybz";
const DESC = "What Mumbai is saving, sharing and booking right now, ranked by vybz.";

export const Route = createFileRoute("/trending")({ staticData: { sitemap: true },
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: () => {
    const { data, isLoading } = useQuery({ queryKey: ["trending"], queryFn: () => getTrending({ data: {} }), staleTime: 60_000 });
    return (
      <AppShell>
        <PageHeader eyebrow="Right now" title="Trending in Mumbai" description="Ranked by real saves, shares and booking clicks over the last week." />
        <div className="grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <SceneCardSkeleton key={i} />)}
          {data?.map((item, i) => (
            <div key={item.id} className="relative">
              <span className="absolute -left-1 -top-2 z-10 grid size-8 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground shadow-ember">{i + 1}</span>
              <SceneCard item={item} index={i} />
            </div>
          ))}
          {data && data.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Nothing trending yet — be the first to save something.</p>}
        </div>
      </AppShell>
    );
  },
});
