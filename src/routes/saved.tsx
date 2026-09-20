import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { SceneCard, SceneCardSkeleton } from "@/components/scene/SceneCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSaved } from "@/hooks/useSaved";
import { getItemsByKeys } from "@/lib/scene.functions";

const TITLE = "Saved scenes — vybz";
const DESC = "Your saved venues, events and experiences in Mumbai.";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { name: "robots", content: "noindex" }] }),
  component: SavedPage,
});

function SavedPage() {
  const { keys } = useSaved();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["saved-items", keys], queryFn: () => getItemsByKeys({ data: { keys } }), enabled: keys.length > 0 });
  return (
    <AppShell>
      <PageHeader eyebrow="Saved" title="Your scenes" description={user ? "Synced to your account." : "Saved on this device — sign in to keep them everywhere."}
        action={!user ? <Button asChild variant="glass" size="sm"><Link to="/auth" search={{ next: "/saved" }}>Sign in</Link></Button> : undefined} />
      <div className="grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <SceneCardSkeleton key={i} />)}
        {data?.map((item, i) => <SceneCard key={item.id} item={item} index={i} />)}
        {keys.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing saved yet. Tap the bookmark on any card.</p>
            <Button asChild className="mt-4" variant="ember"><Link to="/">What's your scene?</Link></Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
