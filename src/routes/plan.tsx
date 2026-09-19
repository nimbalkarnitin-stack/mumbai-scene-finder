import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { Concierge } from "@/components/scene/Concierge";
import { ScenePickerFields, type SceneSelection } from "@/components/scene/ScenePickerFields";
import { Button } from "@/components/ui/button";
import { BUDGETS, GROUPS, MOODS, TIMINGS } from "@/lib/scene-constants";

const TITLE = "Plan My Weekend — SceneAI Mumbai";
const DESC = "Generate a complete Mumbai itinerary in seconds, then edit it conversationally: make it cheaper, replace dinner, add live music, keep it near Bandra.";

export const Route = createFileRoute("/plan")({
  validateSearch: z.object({
    mood: z.string().optional(), group: z.string().optional(), budget: z.coerce.number().optional(), timing: z.string().optional(), area: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: PlanPage,
});

function buildPrompt(s: SceneSelection) {
  const bits = [
    s.timing ? TIMINGS.find((t) => t.id === s.timing)?.label : "this weekend",
    s.group ? `for ${GROUPS.find((g) => g.id === s.group)?.label.toLowerCase()}` : "",
    s.mood ? `with a ${MOODS.find((m) => m.id === s.mood)?.label.toLowerCase()} mood` : "",
    s.budget ? `keeping it under ${BUDGETS.find((b) => b.id === s.budget)?.label} per person` : "",
    s.area ? `around ${s.area.replace(/-/g, " ")}` : "anywhere in Mumbai",
  ].filter(Boolean);
  return `Plan my ${bits.join(" ")}. Give me a complete itinerary with 3–5 stops from afternoon to late night, using only listings you can find.`;
}

function PlanPage() {
  const search = Route.useSearch();
  const hasParams = Object.values(search).some(Boolean);
  const [sel, setSel] = useState<SceneSelection | null>(hasParams ? search : null);
  const [draft, setDraft] = useState<SceneSelection>({});

  return (
    <AppShell>
      <PageHeader
        eyebrow="Plan My Weekend"
        title={sel ? "Your itinerary" : "Let's build your weekend"}
        description={sel ? "Edit it like you'd text a friend — cheaper, closer, more romantic." : "Pick a vibe and SceneAI drafts a full plan you can reshape by chatting."}
        action={sel ? <Button variant="glass" size="sm" onClick={() => setSel(null)}>Start over</Button> : undefined}
      />
      <div className="px-4 md:px-6">
        {!sel ? (
          <div className="space-y-5 rounded-[1.75rem] border border-border bg-card/70 p-4 md:p-8">
            <ScenePickerFields sel={draft} setSel={(u) => setDraft(u)} />
            <Button variant="ember" size="xl" className="w-full sm:w-auto" onClick={() => setSel(draft)}>Plan My Weekend</Button>
          </div>
        ) : (
          <Concierge
            key={JSON.stringify(sel)}
            context={sel as Record<string, unknown>}
            initialPrompt={buildPrompt(sel)}
            autoStart
            placeholder="Change anything: “swap the café for a rooftop”…"
          />
        )}
      </div>
    </AppShell>
  );
}
