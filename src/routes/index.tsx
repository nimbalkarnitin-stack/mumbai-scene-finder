import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/scene/AppShell";
import { ScenePicker } from "@/components/scene/ScenePicker";
import { SceneCard, SceneCardSkeleton } from "@/components/scene/SceneCard";
import { Button } from "@/components/ui/button";
import { CATEGORY_NAV, CONCIERGE_SUGGESTIONS } from "@/lib/scene-constants";
import { CATEGORY_IMAGES, HERO_IMAGE } from "@/lib/scene-images";
import { getTrending } from "@/lib/scene.functions";

const TITLE = "SceneAI — What's your scene tonight in Mumbai?";
const DESC = "AI-powered discovery for Mumbai. Tell SceneAI your mood, crew, budget and timing — get personalised picks and a full weekend plan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: trending, isLoading } = useQuery({ queryKey: ["trending"], queryFn: () => getTrending({ data: {} }) });

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden md:mx-6 md:mt-6 md:rounded-[2rem]">
        <img src={HERO_IMAGE} alt="Rooftop bar in Bandra at dusk with the sea link behind" width={1280} height={1600} className="absolute inset-0 size-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        <div className="relative px-4 pb-8 pt-[38vh] md:px-10 md:pb-12 md:pt-[30vh]">
          <p className="eyebrow mb-3 text-saffron">Mumbai · Tonight &amp; this weekend</p>
          <h1 className="max-w-[12ch] text-[44px] font-medium leading-[0.98] md:text-7xl">
            What's your <em className="text-gradient-ember not-italic">scene?</em>
          </h1>
          <p className="mt-4 max-w-md text-[15px] text-foreground/80">
            Tell us the mood. SceneAI reads the city back to you — bars, gigs, comedy, dinners and things you've never tried.
          </p>
        </div>
      </section>

      {/* Picker */}
      <section className="px-4 pt-6 md:px-6 md:pt-10">
        <div className="rounded-[1.75rem] border border-border bg-card/70 p-4 shadow-card md:p-8">
          <ScenePicker />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link to="/plan" className="group flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 transition hover:border-primary/40">
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary-glow"><CalendarDays className="size-5" /></span>
              <span>
                <span className="block font-display text-lg font-semibold">Plan My Weekend</span>
                <span className="block text-xs text-muted-foreground">A full itinerary you can edit by chatting</span>
              </span>
            </span>
            <ArrowUpRight className="size-5 text-muted-foreground transition group-hover:text-foreground" />
          </Link>
          <Link to="/concierge" className="group flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 transition hover:border-teal/40">
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-teal/15 text-teal"><MessageCircle className="size-5" /></span>
              <span>
                <span className="block font-display text-lg font-semibold">AI Concierge</span>
                <span className="block text-xs text-muted-foreground">Ask anything about going out in Mumbai</span>
              </span>
            </span>
            <ArrowUpRight className="size-5 text-muted-foreground transition group-hover:text-foreground" />
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="pt-10 md:pt-14">
        <div className="flex items-end justify-between px-4 md:px-6">
          <h2 className="text-2xl font-semibold md:text-3xl">Browse the city</h2>
          <Link to="/explore" className="text-sm text-primary-glow">Explore all</Link>
        </div>
        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto px-4 pb-2 md:grid md:grid-cols-4 md:px-6 lg:grid-cols-7">
          {CATEGORY_NAV.map((c) => (
            <Link key={c.slug} to={c.path} className="group relative aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-2xl md:w-auto">
              <img src={CATEGORY_IMAGES[c.slug]} alt={c.label} loading="lazy" width={1024} height={768} className="size-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="image-fade absolute inset-0" />
              <span className="absolute bottom-3 left-3 font-display text-lg font-semibold">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Conversational hint */}
      <section className="px-4 pt-10 md:px-6 md:pt-14">
        <div className="rounded-[1.75rem] border border-teal/25 bg-teal/5 p-5 md:p-8">
          <p className="eyebrow text-teal">Talk to it like a friend</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">Change the plan in one line</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {CONCIERGE_SUGGESTIONS.map((s) => (
              <Link key={s} to="/concierge" search={{ q: s }} className="rounded-full border border-teal/30 bg-background/40 px-3.5 py-2 text-[13px] text-teal transition hover:bg-teal/10">
                “{s}”
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="pt-10 md:pt-14">
        <div className="flex items-end justify-between px-4 md:px-6">
          <div>
            <p className="eyebrow text-primary-glow">Right now</p>
            <h2 className="text-2xl font-semibold md:text-3xl">Trending in Mumbai</h2>
          </div>
          <Link to="/trending" className="text-sm text-primary-glow">See all</Link>
        </div>
        <div className="mt-4 grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <SceneCardSkeleton key={i} />)}
          {trending?.slice(0, 6).map((item, i) => <SceneCard key={item.id} item={item} index={i} />)}
          {!isLoading && !trending?.length && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No listings yet. Add venues, events and experiences from the admin dashboard to light this up.
            </div>
          )}
        </div>
      </section>

      {/* SEO links */}
      <section className="px-4 pt-12 md:px-6">
        <p className="eyebrow mb-3">Popular searches</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["things-to-do-in-mumbai", "Things to do in Mumbai"],
            ["mumbai-events-this-weekend", "Mumbai events this weekend"],
            ["things-to-do-tonight", "Things to do tonight"],
            ["live-music-mumbai", "Live music Mumbai"],
            ["comedy-mumbai", "Comedy Mumbai"],
            ["mumbai-date-ideas", "Mumbai date ideas"],
            ["mumbai-nightlife", "Mumbai nightlife"],
            ["mumbai-cafes", "Mumbai cafés"],
            ["mumbai-weekend-experiences", "Weekend experiences"],
          ].map(([slug, label]) => (
            <Link key={slug} to="/mumbai/$slug" params={{ slug: slug! }} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground">
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Button asChild variant="glass" size="sm"><Link to="/plus">Join SceneAI+ →</Link></Button>
        </div>
      </section>
    </AppShell>
  );
}
