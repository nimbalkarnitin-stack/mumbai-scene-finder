import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Chip } from "./Chip";
import { Button } from "@/components/ui/button";
import { BUDGETS, GROUPS, MOODS, TIMINGS } from "@/lib/scene-constants";
import { getCityMeta } from "@/lib/scene.functions";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

export interface SceneSelection {
  mood?: string;
  group?: string;
  budget?: number;
  timing?: string;
  area?: string;
}

export function ScenePicker({ initial = {}, compact = false, className }: { initial?: SceneSelection; compact?: boolean; className?: string }) {
  const navigate = useNavigate();
  const [sel, setSel] = useState<SceneSelection>(initial);
  const { data: meta } = useQuery({ queryKey: ["city-meta"], queryFn: () => getCityMeta({ data: {} }), staleTime: 5 * 60_000 });

  const set = <K extends keyof SceneSelection>(k: K, v: SceneSelection[K]) => setSel((s) => ({ ...s, [k]: s[k] === v ? undefined : v }));

  const go = () => {
    track("search", { metadata: { ...sel } });
    navigate({ to: "/scene", search: { mood: sel.mood, group: sel.group, budget: sel.budget, timing: sel.timing, area: sel.area } });
  };

  const Step = ({ n, label, children }: { n: number; label: string; children: React.ReactNode }) => (
    <div>
      <p className="eyebrow mb-2.5">
        <span className="text-primary-glow">{String(n).padStart(2, "0")}</span> · {label}
      </p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">{children}</div>
    </div>
  );

  return (
    <div className={cn("space-y-5", className)}>
      <Step n={1} label="Mood">
        {MOODS.map((m) => (
          <Chip key={m.id} active={sel.mood === m.id} onClick={() => set("mood", m.id)}>
            <span aria-hidden>{m.emoji}</span> {m.label}
          </Chip>
        ))}
      </Step>
      <Step n={2} label="Who's coming">
        {GROUPS.map((g) => (
          <Chip key={g.id} active={sel.group === g.id} tone="teal" onClick={() => set("group", g.id)}>{g.label}</Chip>
        ))}
      </Step>
      <Step n={3} label="Budget per person">
        {BUDGETS.map((b) => (
          <Chip key={b.id} active={sel.budget === b.id} tone="saffron" onClick={() => set("budget", b.id)}>{b.label}</Chip>
        ))}
      </Step>
      <Step n={4} label="When">
        {TIMINGS.map((t) => (
          <Chip key={t.id} active={sel.timing === t.id} onClick={() => set("timing", t.id)}>{t.label}</Chip>
        ))}
      </Step>
      <Step n={5} label="Where in Mumbai">
        {(meta?.areas ?? []).map((a) => (
          <Chip key={a.slug} active={sel.area === a.slug} tone="teal" onClick={() => set("area", a.slug)}>{a.name}</Chip>
        ))}
        {!meta && <span className="text-xs text-muted-foreground">Loading areas…</span>}
      </Step>
      <Button variant="ember" size={compact ? "lg" : "xl"} className="w-full sm:w-auto" onClick={go}>
        What's your scene? <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
