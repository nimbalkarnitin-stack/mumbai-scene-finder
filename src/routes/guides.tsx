import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { SEO_PAGES } from "@/lib/scene-constants";
import { CATEGORY_IMAGES } from "@/lib/scene-images";
import { listGuides } from "@/lib/scene.functions";

const TITLE = "Mumbai Guides — vybz";
const DESC = "Editorial guides to Mumbai: neighbourhood walks, date ideas, late-night eats and weekend plans.";

export const Route = createFileRoute("/guides")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: GuidesLayout,
});

function GuidesLayout() {
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId === "/guides/$slug");
  if (isChild) return <Outlet />;
  return <GuidesIndex />;
}

const COVERS = ["restaurants", "nightlife", "cafes", "live-music", "experiences", "comedy", "events"];

function GuidesIndex() {
  const { data } = useQuery({ queryKey: ["guides"], queryFn: () => listGuides({ data: {} }), staleTime: 300_000 });
  const seo = Object.entries(SEO_PAGES);
  return (
    <AppShell>
      <PageHeader eyebrow="Guides" title="Mumbai, curated" description="Editorial guides and living lists — refreshed as listings are verified." />
      {data && data.length > 0 && (
        <div className="grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
          {data.map((g, i) => (
            <Link key={g.id} to="/guides/$slug" params={{ slug: g.slug }} className="group relative aspect-[4/3] overflow-hidden rounded-3xl">
              <img src={g.cover_image_url ?? CATEGORY_IMAGES[COVERS[i % COVERS.length]!]} alt={g.title} loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="image-fade absolute inset-0" />
              <div className="absolute inset-x-4 bottom-4">
                <h2 className="font-display text-2xl font-semibold">{g.title}</h2>
                {g.excerpt && <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{g.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <section className="px-4 pt-8 md:px-6">
        <p className="eyebrow mb-3">Living lists</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seo.map(([slug, p], i) => (
            <Link key={slug} to="/mumbai/$slug" params={{ slug }} className="group relative flex aspect-[16/9] items-end overflow-hidden rounded-2xl">
              <img src={CATEGORY_IMAGES[COVERS[i % COVERS.length]!]} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-70 transition duration-700 group-hover:scale-105" />
              <div className="image-fade absolute inset-0" />
              <span className="relative px-4 pb-3 font-display text-lg font-semibold">{p.title}</span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
