import { Link } from "@tanstack/react-router";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shown when nothing can be recommended. SceneAI never invents listings, so an
 * empty catalogue is explained plainly instead of being filled with samples.
 */
export function CatalogueEmptyState({ filtered = false, onChangeFilters, className }: {
  filtered?: boolean;
  onChangeFilters?: (() => void) | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("rounded-3xl border border-dashed border-border p-8 text-center md:p-10", className)}>
      <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-teal/15 text-teal"><DatabaseZap className="size-5" /></span>
      <h2 className="mt-4 text-xl font-semibold">
        {filtered ? "Nothing matches those filters yet" : "The Mumbai catalogue isn't populated yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        SceneAI only shows places, dates and prices that come from a stored, source-backed listing — we never generate
        events or prices. As the Mumbai catalogue is filled in, recommendations appear here automatically, with
        unverified entries clearly flagged.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {onChangeFilters && <Button variant="glass" size="sm" onClick={onChangeFilters}>Change filters</Button>}
        <Button asChild variant="ember" size="sm"><Link to="/concierge">Ask the concierge</Link></Button>
        <Button asChild variant="glass" size="sm"><Link to="/explore">Browse the city</Link></Button>
      </div>
    </div>
  );
}
