import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/scene/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SceneAI" }, { name: "description", content: "SceneAI operations dashboard." }, { property: "og:title", content: "Admin — SceneAI" }, { property: "og:description", content: "SceneAI operations dashboard." }, { name: "robots", content: "noindex" }] }),
  component: AdminGate,
});

/** Client-side gate for UX only — every read/write is enforced by database row-level policies. */
function AdminGate() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Checking access…</div>;
  if (!user) return (
    <AppShell hideNav><div className="px-4 py-24 text-center"><h1 className="text-3xl font-semibold">Admin sign-in</h1><Button asChild variant="ember" className="mt-6"><Link to="/auth" search={{ next: "/admin" }}>Sign in</Link></Button></div></AppShell>
  );
  if (!isAdmin) return (
    <AppShell><div className="px-4 py-24 text-center"><h1 className="text-3xl font-semibold">Admins only</h1><p className="mt-2 text-sm text-muted-foreground">Your account doesn't have the admin role.</p><Button asChild variant="glass" className="mt-6"><Link to="/">Back to SceneAI</Link></Button></div></AppShell>
  );
  return <Outlet />;
}
