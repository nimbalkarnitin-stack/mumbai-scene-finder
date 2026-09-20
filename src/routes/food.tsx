import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/scene/AppShell";
import { SwiggyFoodSearch } from "@/components/scene/SwiggyLive";
import { SwiggyPrivacyNote } from "@/components/scene/SwiggyConnect";

export const Route = createFileRoute("/food")({
  validateSearch: z.object({ swiggy: z.string().optional(), reason: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Food delivery in Mumbai — live on Swiggy | SceneAI" },
      { name: "description", content: "Search restaurants and menus that are open for delivery in Mumbai right now, live from your own Swiggy account, alongside SceneAI's verified venue guide." },
      { property: "og:title", content: "Food delivery in Mumbai — live on Swiggy" },
      { property: "og:description", content: "Live Swiggy restaurants, menus and dish prices for Mumbai, inside SceneAI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FoodPage,
});

function FoodPage() {
  const { swiggy, reason } = Route.useSearch();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
        <header>
          <p className="eyebrow">Mumbai · Live</p>
          <h1 className="mt-1 text-4xl font-medium leading-[1.05] md:text-5xl">Food delivery, right now</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your Swiggy account to search restaurants that are actually open for delivery to your saved address,
            with live menus and prices. SceneAI's own verified venue and event guide stays separate.
          </p>
        </header>

        {swiggy === "connected" && <p className="rounded-2xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">Swiggy connected. Pick a delivery address to start.</p>}
        {swiggy === "denied" && <p className="rounded-2xl border border-saffron/30 bg-saffron/10 px-4 py-3 text-sm text-saffron">Swiggy access was not granted{reason ? ` (${reason})` : ""}. You can try again any time.</p>}
        {swiggy === "error" && <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">Swiggy connection failed{reason ? `: ${reason}` : ""}.</p>}

        <SwiggyFoodSearch />
        <SwiggyPrivacyNote className="border-t border-border pt-4" />
      </div>
    </AppShell>
  );
}
