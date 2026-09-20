import { Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ItemDetail } from "@/components/scene/ItemDetail";
import { AppShell } from "@/components/scene/AppShell";
import { getItem } from "@/lib/scene.functions";
import type { ItemType } from "@/lib/scene-types";

export const itemQuery = (type: ItemType, slug: string) =>
  queryOptions({ queryKey: ["item", type, slug], queryFn: () => getItem({ data: { type, slug } }), staleTime: 60_000 });

export function makeItemRoute(type: ItemType) {
  const label = type === "venue" ? "Venue" : type === "event" ? "Event" : "Experience";
  return {
    loader: async ({ params, context }: { params: { slug: string }; context: { queryClient: import("@tanstack/react-query").QueryClient } }) => {
      const data = await context.queryClient.ensureQueryData(itemQuery(type, params.slug));
      if (!data) throw notFound();
      return { name: data.item.name, description: data.item.description, area: data.item.areaName, image: data.item.imageUrl };
    },
    head: ({ loaderData }: { loaderData?: { name: string; description: string | null; area: string | null; image: string | null } | undefined }) => {
      if (!loaderData) return { meta: [{ title: `${label} not found — vybz` }, { name: "robots", content: "noindex" }] };
      const title = `${loaderData.name}${loaderData.area ? `, ${loaderData.area}` : ""} — vybz Mumbai`;
      const desc = loaderData.description?.slice(0, 155) ?? `${loaderData.name} on vybz — Mumbai's AI-powered city guide.`;
      const img = loaderData.image?.startsWith("https://") ? loaderData.image : null;
      return {
        meta: [
          { title }, { name: "description", content: desc },
          { property: "og:title", content: title }, { property: "og:description", content: desc },
          ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
        ],
      };
    },
    notFoundComponent: () => (
      <AppShell>
        <div className="px-4 py-24 text-center">
          <h1 className="text-3xl font-semibold">{label} not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">It may have been removed or never verified.</p>
          <Link to="/explore" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">Explore Mumbai</Link>
        </div>
      </AppShell>
    ),
    errorComponent: () => (
      <AppShell>
        <div className="px-4 py-24 text-center">
          <h1 className="text-3xl font-semibold">Couldn't load this {label.toLowerCase()}</h1>
          <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">Go home</Link>
        </div>
      </AppShell>
    ),
  };
}

export function ItemPage({ type, slug }: { type: ItemType; slug: string }) {
  const { data } = useSuspenseQuery(itemQuery(type, slug));
  if (!data) return null;
  return <ItemDetail item={data.item} related={data.related} />;
}
