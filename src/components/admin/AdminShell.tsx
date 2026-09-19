import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/scene/AppShell";
import { ADMIN_NAV } from "@/lib/admin-entities";
import { cn } from "@/lib/utils";

export function AdminShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-border bg-card/40 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <Logo />
          <span className="rounded-full border border-saffron/40 bg-saffron/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-saffron">Admin</span>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {ADMIN_NAV.map((n) => (
            <Link key={n.to} to={n.to} className={cn("shrink-0 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground", path === n.to && "bg-secondary text-foreground")}>{n.label}</Link>
          ))}
          <Link to="/" className="mt-2 shrink-0 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground">← Back to site</Link>
        </nav>
      </aside>
      <main className="px-4 py-6 md:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">{title}</h1>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}
