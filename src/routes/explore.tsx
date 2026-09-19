import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { Chip } from "@/components/scene/Chip";
import { SceneCard, SceneCardSkeleton } from "@/components/scene/SceneCard";
import { CatalogueEmptyState } from "@/components/scene/CatalogueEmptyState";
import { CATEGORY_NAV } from "@/lib/scene-constants";
import { CATEGORY_IMAGES } from "@/lib/scene-images";
import { getCityMeta, listItems } from "@/lib/scene.functions";

const TITLE = "Explore Mumbai — SceneAI";
const DESC = "Browse every venue, event and experience listed on SceneAI by neighbourhood and category — editor-verified entries are badged.";

export const Route = createFileRoute("/explore")({
  validateSearch: z.object({ area: z.string().optional(), sort: z.enum(["popular", "newest", "soonest"]).optional(), category: z.string().optional() }),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: ExplorePage,
});

function ExplorePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSearch = (patch: Partial<typeof search>) => navigate({ search: (s) => ({ ...s, ...patch }) });
  const { data: meta } = useQuery({ queryKey: ["city-meta"], queryFn: () => getCityMeta({ data: {} }), staleTime: 300_000 });
  const { data, isLoading } = useQuery({
    queryKey: ["explore", search],
    queryFn: () => listItems({ data: { ...(search.area ? { area: search.area } : {}), ...(search.category ? { category: search.category } : {}), sort: search.sort ?? "popular", limit: 60 } }),
  });

  return (
    <AppShell>
      <PageHeader eyebrow="Explore" title="The whole city, sorted" description="Every listing on SceneAI — verified entries carry a badge, unverified ones say so. Filter by neighbourhood or category." />
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-7 md:px-6">
        {CATEGORY_NAV.map((c) => (
          <Link key={c.slug} to={c.path} className="group relative aspect-square w-28 shrink-0 overflow-hidden rounded-2xl md:w-auto">
            <img src={CATEGORY_IMAGES[c.slug]} alt={c.label} loading="lazy" width={512} height={512} className="size-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="image-fade absolute inset-0" />
            <span className="absolute bottom-2 left-2.5 font-display text-sm font-semibold">{c.label}</span>
          </Link>
        ))}
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4 md:px-6">
        <Chip active={!search.area} onClick={() => setSearch({ area: undefined })}>All areas</Chip>
        {(meta?.areas ?? []).map((a) => (
          <Chip key={a.slug} tone="teal" active={search.area === a.slug} onClick={() => setSearch({ area: search.area === a.slug ? undefined : a.slug })}>{a.name}</Chip>
        ))}
      </div>
      <div className="mt-3 flex gap-2 px-4 md:px-6">
        {(["popular", "newest", "soonest"] as const).map((s) => (
          <Chip key={s} tone="saffron" active={(search.sort ?? "popular") === s} onClick={() => setSearch({ sort: s })} className="capitalize">{s}</Chip>
        ))}
      </div>
      <div className="mt-5 grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <SceneCardSkeleton key={i} />)}
        {data?.map((item, i) => <SceneCard key={item.id} item={item} index={i} />)}
        {data && data.length === 0 && <CatalogueEmptyState className="col-span-full" filtered={!!search.area || !!search.category} />}
      </div>
    </AppShell>
  );
}
