import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "default" | "teal" | "saffron";
  children: ReactNode;
}

export function Chip({ active, tone = "default", className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all active:scale-95",
        active
          ? tone === "teal"
            ? "border-teal bg-teal text-teal-foreground"
            : tone === "saffron"
              ? "border-saffron bg-saffron text-saffron-foreground"
              : "border-primary bg-primary text-primary-foreground shadow-ember"
          : "border-border bg-surface text-foreground hover:border-muted-foreground/40 hover:bg-surface-elevated",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tag({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "ember" | "teal" | "saffron" | "sponsored"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
        tone === "default" && "bg-background/70 text-foreground backdrop-blur",
        tone === "ember" && "bg-primary text-primary-foreground",
        tone === "teal" && "bg-teal/15 text-teal ring-1 ring-teal/30",
        tone === "saffron" && "bg-saffron text-saffron-foreground",
        tone === "sponsored" && "bg-saffron/15 text-saffron ring-1 ring-saffron/40",
        className,
      )}
    >
      {children}
    </span>
  );
}
