import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { ScenePickerFields, type SceneSelection } from "./ScenePickerFields";

export type { SceneSelection };

export function ScenePicker({ initial = {}, compact = false, className }: { initial?: SceneSelection; compact?: boolean; className?: string }) {
  const navigate = useNavigate();
  const [sel, setSel] = useState<SceneSelection>(initial);

  const go = () => {
    track("search", { metadata: { ...sel } });
    navigate({ to: "/scene", search: { mood: sel.mood, group: sel.group, budget: sel.budget, timing: sel.timing, area: sel.area } });
  };

  return (
    <div className={cn("space-y-5", className)}>
      <ScenePickerFields sel={sel} setSel={setSel} />
      <Button variant="ember" size={compact ? "lg" : "xl"} className="w-full sm:w-auto" onClick={go}>
        What's your scene? <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
