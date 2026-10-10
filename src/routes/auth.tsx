import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell, Logo } from "@/components/scene/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

const TITLE = "Sign in — vybz";
const DESC = "Sign in to vybz to sync saved places, keep itineraries across devices and unlock vybz+.";

export const Route = createFileRoute("/auth")({ staticData: { sitemap: false },
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: AuthPage,
});

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const done = () => navigate({ to: safeNext(next) as "/" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        done();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) done();
        else toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    done();
  };

  return (
    <AppShell hideNav>
      <div className="mx-auto max-w-sm px-4 pt-16 pb-24">
        <Logo className="justify-center" />
        {user ? (
          <div className="mt-10 rounded-3xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="mt-1 font-medium">{user.email}</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button asChild variant="ember"><Link to="/">Back to Mumbai</Link></Button>
              <Button variant="glass" onClick={() => signOut()}>Sign out</Button>
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-border bg-card p-6">
            <h1 className="text-2xl font-semibold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sync saves, keep itineraries, unlock vybz+.</p>
            <Button variant="glass" className="mt-5 w-full" onClick={google}>
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.25 1.4-1.6 4.1-5.35 4.1-3.2 0-5.85-2.65-5.85-5.9s2.65-5.9 5.85-5.9c1.85 0 3.1.8 3.8 1.45l2.6-2.5C16.75 3.75 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.85-3.75 8.85-9 0-.6-.05-1.05-.15-1.5z" /></svg>
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            <form onSubmit={submit} className="space-y-3">
              <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl bg-background/60" />
              <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl bg-background/60" />
              <Button type="submit" variant="ember" className="w-full" size="lg" disabled={busy}>
                {mode === "in" ? "Sign in" : "Sign up"}
              </Button>
            </form>
            <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground">
              {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
