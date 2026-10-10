import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { Concierge } from "@/components/scene/Concierge";

const TITLE = "AI Concierge — vybz Mumbai";
const DESC = "Chat with vybz's Mumbai concierge: ask for tonight's plan, a date spot, live music near you, or tweak your itinerary in plain English.";

export const Route = createFileRoute("/concierge")({ staticData: { sitemap: true },
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: ConciergePage,
});

function ConciergePage() {
  const { q } = Route.useSearch();
  return (
    <AppShell>
      <PageHeader eyebrow="AI Concierge" title="Ask Mumbai anything" description="Plans, places, swaps — grounded only in listings stored on vybz, with unverified ones flagged." />
      <div className="px-4 md:px-6">
        <Concierge initialPrompt={q} autoStart={!!q} />
      </div>
    </AppShell>
  );
}
