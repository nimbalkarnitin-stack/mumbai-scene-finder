import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Home, MessageCircle, CalendarDays, Bookmark, Sparkles, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_NAV } from "@/lib/scene-constants";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const BOTTOM = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/plan", label: "Plan", icon: CalendarDays },
  { to: "/concierge", label: "Concierge", icon: MessageCircle },
  { to: "/saved", label: "Saved", icon: Bookmark },
] as const;

const MORE = [
  { to: "/food", label: "Food delivery" },
  { to: "/trending", label: "Trending" },
  { to: "/guides", label: "Guides" },
  { to: "/deals", label: "Deals" },
  { to: "/plus", label: "vybz+" },
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <span className="relative grid size-7 place-items-center rounded-lg bg-ember-gradient shadow-ember">
        <Sparkles className="size-3.5 text-primary-foreground" />
      </span>
      <span className="font-display text-[19px] font-semibold tracking-tight">
        Scene<span className="text-primary-glow">AI</span>
      </span>
    </Link>
  );
}

export function AppShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin } = useAuth();

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {[{ to: "/explore", label: "Explore" }, { to: "/plan", label: "Plan My Weekend" }, { to: "/concierge", label: "Concierge" }, ...MORE].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "text-foreground bg-accent" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:inline-flex">
              <span className="size-1.5 rounded-full bg-primary animate-pulse-soft" /> Mumbai
            </span>
            {user ? (
              <Link to={isAdmin ? "/admin" : "/saved"} className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase">
                {(user.email ?? "u").slice(0, 1)}
              </Link>
            ) : (
              <Button asChild size="sm" variant="glass" className="hidden sm:inline-flex">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
            <button aria-label="Menu" onClick={() => setOpen((o) => !o)} className="grid size-9 place-items-center rounded-full border border-border md:hidden">
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border bg-background/95 px-4 py-4 md:hidden animate-fade">
            <p className="eyebrow mb-2">Browse</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_NAV.map((c) => (
                <Link key={c.slug} to={c.path} onClick={() => setOpen(false)} className="rounded-full border border-border px-3 py-1.5 text-sm">
                  {c.label}
                </Link>
              ))}
            </div>
            <p className="eyebrow mt-4 mb-2">More</p>
            <div className="flex flex-wrap gap-2">
              {MORE.map((c) => (
                <Link key={c.to} to={c.to} onClick={() => setOpen(false)} className="rounded-full border border-border px-3 py-1.5 text-sm">
                  {c.label}
                </Link>
              ))}
              {user ? (
                isAdmin ? (
                  <Link to="/admin" onClick={() => setOpen(false)} className="rounded-full border border-primary/50 px-3 py-1.5 text-sm text-primary-glow">
                    Admin
                  </Link>
                ) : null
              ) : (
                <Link to="/auth" onClick={() => setOpen(false)} className="rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl">{children}</main>

      <footer className="mx-auto mt-16 hidden max-w-6xl px-6 pb-10 text-xs text-muted-foreground md:block">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <span>© {new Date().getFullYear()} vybz · Mumbai first, more cities soon.</span>
          <div className="flex gap-4">
            <Link to="/mumbai/$slug" params={{ slug: "things-to-do-in-mumbai" }}>Things to do in Mumbai</Link>
            <Link to="/mumbai/$slug" params={{ slug: "mumbai-events-this-weekend" }}>This weekend</Link>
            <Link to="/mumbai/$slug" params={{ slug: "mumbai-date-ideas" }}>Date ideas</Link>
          </div>
        </div>
      </footer>

      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden" aria-label="Primary">
          <div className="glass mx-3 mb-3 flex items-center justify-between rounded-2xl border border-border px-1 py-1.5 shadow-card">
            {BOTTOM.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition", active ? "text-primary-glow" : "text-muted-foreground")}>
                  <Icon className={cn("size-[18px]", active && "drop-shadow-[0_0_8px_var(--primary)]")} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-8 pb-5 md:px-6 md:pt-12">
      <div className="max-w-xl">
        {eyebrow && <p className="eyebrow mb-2 text-primary-glow">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold leading-[1.05] md:text-5xl">{title}</h1>
        {description && <p className="mt-3 text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
