import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { SceneCard } from "@/components/scene/SceneCard";
import { CatalogueEmptyState } from "@/components/scene/CatalogueEmptyState";
import { BUDGETS, SEO_PAGES } from "@/lib/scene-constants";
import { getCityMeta, getRecommendations } from "@/lib/scene.functions";
import type { ItemType } from "@/lib/scene-types";

interface PageDef { title: string; h1: string; description: string; filters: Record<string, string> }

async function resolvePage(slug: string): Promise<PageDef | null> {
  const fixed = SEO_PAGES[slug];
  if (fixed) return fixed;
  const m = slug.match(/^things-to-do-in-([a-z0-9-]+?)(?:-under-(\d+))?$/);
  if (!m) return null;
  const meta = await getCityMeta({ data: {} });
  const area = meta.areas.find((a) => a.slug === m[1]);
  if (!area) return null;
  const budget = m[2] ? Number(m[2]) : undefined;
  const title = `Things to do in ${area.name}${budget ? ` under ₹${budget.toLocaleString("en-IN")}` : ""}`;
  return {
    title, h1: title,
    description: `${title}, Mumbai — bars, cafés, gigs and experiences in ${area.name}${budget ? ` that fit a ₹${budget.toLocaleString("en-IN")} budget` : ""}, ranked by SceneAI.`,
    filters: { area: area.slug, ...(budget ? { budget: String(budget) } : {}) },
  };
}

const pageQuery = (slug: string) =>
  queryOptions({
    queryKey: ["seo", slug],
    queryFn: async () => {
      const page = await resolvePage(slug);
      if (!page) return null;
      const f = page.filters;
      const res = await getRecommendations({
        data: {
          ...(f["mood"] ? { mood: f["mood"] } : {}), ...(f["group"] ? { group: f["group"] } : {}), ...(f["timing"] ? { timing: f["timing"] } : {}),
          ...(f["area"] ? { area: f["area"] } : {}), ...(f["category"] ? { category: f["category"] } : {}), ...(f["budget"] ? { budget: Number(f["budget"]) } : {}),
          ...(f["type"] ? { type: f["type"] as ItemType } : {}), limit: 12,
        },
      });
      const meta = await getCityMeta({ data: {} });
      return { page, items: res.items, areas: meta.areas };
    },
    staleTime: 120_000,
  });

export const Route = createFileRoute("/mumbai/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(pageQuery(params.slug));
    if (!data) throw notFound();
    return { title: data.page.title, description: data.page.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found — SceneAI" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.title} — SceneAI`;
    return { meta: [{ title: t }, { name: "description", content: loaderData.description }, { property: "og:title", content: t }, { property: "og:description", content: loaderData.description }] };
  },
  notFoundComponent: () => (
    <AppShell><div className="px-4 py-24 text-center"><h1 className="text-3xl font-semibold">No such guide</h1><Link to="/explore" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">Explore Mumbai</Link></div></AppShell>
  ),
  errorComponent: () => (
    <AppShell><div className="px-4 py-24 text-center"><h1 className="text-3xl font-semibold">Couldn't load this page</h1></div></AppShell>
  ),
  component: SeoPage,
});

function SeoPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(pageQuery(slug));
  if (!data) return null;
  const { page, items, areas } = data;
  return (
    <AppShell>
      <PageHeader eyebrow="Mumbai guide" title={page.h1} description={page.description} />
      <div className="grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {items.map((item, i) => <SceneCard key={item.id} item={item} index={i} />)}
        {items.length === 0 && <CatalogueEmptyState className="col-span-full" filtered />}
      </div>
      <section className="px-4 pt-14 md:px-6">
        <p className="eyebrow mb-3">More Mumbai guides</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SEO_PAGES).filter(([k]) => k !== slug).map(([k, v]) => (
            <Link key={k} to="/mumbai/$slug" params={{ slug: k }} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">{v.title}</Link>
          ))}
        </div>
        <p className="eyebrow mt-8 mb-3">By neighbourhood &amp; budget</p>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <div key={a.slug} className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <Link to="/mumbai/$slug" params={{ slug: `things-to-do-in-${a.slug}` }} className="text-sm text-foreground hover:text-primary-glow">{a.name}</Link>
              {BUDGETS.slice(0, 3).map((b) => (
                <Link key={b.id} to="/mumbai/$slug" params={{ slug: `things-to-do-in-${a.slug}-under-${b.id}` }} className="text-muted-foreground hover:text-foreground">under {b.label}</Link>
              ))}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
