import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "./AppShell";
import { Chip } from "./Chip";
import { SceneCard, SceneCardSkeleton } from "./SceneCard";
import { CatalogueEmptyState } from "./CatalogueEmptyState";
import { CATEGORY_IMAGES } from "@/lib/scene-images";
import { getCityMeta, listItems } from "@/lib/scene.functions";
import type { ItemType } from "@/lib/scene-types";

export function CategoryPage({ slug, title, description, category, type, sort = "popular" }: {
  slug: string; title: string; description: string; category?: string; type?: ItemType; sort?: "popular" | "newest" | "soonest";
}) {
  const [area, setArea] = useState<string | undefined>();
  const { data: meta } = useQuery({ queryKey: ["city-meta"], queryFn: () => getCityMeta({ data: {} }), staleTime: 300_000 });
  const { data, isLoading } = useQuery({
    queryKey: ["list", slug, area, sort],
    queryFn: () => listItems({ data: { ...(category ? { category } : {}), ...(type ? { type } : {}), ...(area ? { area } : {}), sort, limit: 40 } }),
  });

  return (
    <AppShell>
      <section className="relative overflow-hidden md:mx-6 md:mt-6 md:rounded-[2rem]">
        <img src={CATEGORY_IMAGES[slug]} alt={title} width={1024} height={768} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        <div className="relative px-4 pb-6 pt-40 md:px-10 md:pt-52">
          <p className="eyebrow text-saffron">Mumbai</p>
          <h1 className="mt-1 text-4xl font-medium md:text-6xl">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-foreground/80">{description}</p>
        </div>
      </section>

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-4 md:px-6">
        <Chip active={!area} onClick={() => setArea(undefined)}>All areas</Chip>
        {(meta?.areas ?? []).map((a) => (
          <Chip key={a.slug} tone="teal" active={area === a.slug} onClick={() => setArea(area === a.slug ? undefined : a.slug)}>{a.name}</Chip>
        ))}
      </div>

      <div className="mt-5 grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <SceneCardSkeleton key={i} />)}
        {data?.map((item, i) => <SceneCard key={item.id} item={item} index={i} />)}
        {data && data.length === 0 && <CatalogueEmptyState className="col-span-full" filtered={!!area} />}
      </div>
    </AppShell>
  );
}

export function categoryHead(title: string, desc: string) {
  return () => ({ meta: [{ title: `${title} — SceneAI` }, { name: "description", content: desc }, { property: "og:title", content: `${title} — SceneAI` }, { property: "og:description", content: desc }] });
}
