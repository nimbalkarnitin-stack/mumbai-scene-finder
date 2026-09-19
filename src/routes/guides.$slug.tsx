import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/scene/AppShell";
import { listGuides } from "@/lib/scene.functions";

const guideQuery = (slug: string) =>
  queryOptions({ queryKey: ["guide", slug], queryFn: async () => (await listGuides({ data: { slug } }))[0] ?? null, staleTime: 300_000 });

export const Route = createFileRoute("/guides/$slug")({
  loader: async ({ params, context }) => {
    const g = await context.queryClient.ensureQueryData(guideQuery(params.slug));
    if (!g) throw notFound();
    return { title: g.title, excerpt: g.excerpt, cover: g.cover_image_url };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Guide not found — SceneAI" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.title} — SceneAI Mumbai Guide`;
    const d = loaderData.excerpt ?? `${loaderData.title}: a SceneAI guide to Mumbai.`;
    const img = loaderData.cover?.startsWith("https://") ? loaderData.cover : null;
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : [])] };
  },
  notFoundComponent: () => (
    <AppShell><div className="px-4 py-24 text-center"><h1 className="text-3xl font-semibold">Guide not found</h1><Link to="/guides" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">All guides</Link></div></AppShell>
  ),
  component: GuidePage,
});

function GuidePage() {
  const { slug } = Route.useParams();
  const { data: g } = useSuspenseQuery(guideQuery(slug));
  if (!g) return null;
  return (
    <AppShell>
      {g.cover_image_url && (
        <div className="relative md:mx-6 md:mt-6 md:overflow-hidden md:rounded-[2rem]">
          <img src={g.cover_image_url} alt={g.title} className="aspect-[16/9] w-full object-cover md:aspect-[21/9]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}
      <article className="mx-auto max-w-2xl px-4 pt-8">
        <p className="eyebrow text-saffron">Guide</p>
        <h1 className="mt-1 text-4xl font-medium md:text-5xl">{g.title}</h1>
        {g.excerpt && <p className="mt-3 text-lg text-muted-foreground">{g.excerpt}</p>}
        <div className="prose prose-invert mt-8 max-w-none prose-headings:font-display prose-a:text-primary-glow">
          <ReactMarkdown>{g.body ?? ""}</ReactMarkdown>
        </div>
      </article>
    </AppShell>
  );
}
