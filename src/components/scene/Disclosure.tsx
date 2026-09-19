import { Info } from "lucide-react";
import { DEFAULT_DISCLOSURE } from "@/lib/monetisation/types";
import { cn } from "@/lib/utils";

/**
 * Affiliate / sponsored disclosures. Always visible wherever SceneAI may earn money
 * from a click, and never mixed into the "why we picked this" reasoning.
 */
export function AffiliateDisclosure({ text, className, compact = false }: { text?: string | undefined; className?: string; compact?: boolean }) {
  const copy = text ?? DEFAULT_DISCLOSURE.affiliate;
  if (compact) return <p className={cn("font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground", className)}>Affiliate link · SceneAI may earn a commission</p>;
  return (
    <p className={cn("flex items-start gap-2 rounded-2xl border border-border bg-card/60 px-3.5 py-2.5 text-[12.5px] text-muted-foreground", className)}>
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{copy}</span>
    </p>
  );
}

export function SponsoredDisclosure({ text, label = "Sponsored", className }: { text?: string | undefined; label?: string; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-2xl border border-saffron/30 bg-saffron/10 px-3.5 py-2.5 text-[12.5px] text-saffron", className)}>
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <strong className="font-semibold">{label}.</strong> {text ?? DEFAULT_DISCLOSURE.sponsored}
      </span>
    </p>
  );
}
