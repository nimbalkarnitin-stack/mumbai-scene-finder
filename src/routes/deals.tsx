import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Lock } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/scene/AppShell";
import { Tag } from "@/components/scene/Chip";
import { Button } from "@/components/ui/button";
import { listOffers } from "@/lib/scene.functions";
import { track } from "@/lib/track";

const TITLE = "Mumbai Deals & Offers — vybz";
const DESC = "Verified offers, promo codes and members-only perks at Mumbai venues and events.";

export const Route = createFileRoute("/deals")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: DealsPage,
});

function DealsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["offers"], queryFn: () => listOffers({ data: {} }), staleTime: 120_000 });
  const copy = async (code: string) => { await navigator.clipboard.writeText(code); toast.success(`Copied ${code}`); };
  return (
    <AppShell>
      <PageHeader eyebrow="Deals" title="Offers worth the detour" description="Every deal here is submitted by the venue or partner and reviewed by vybz. Sponsored offers are labelled." />
      <div className="grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-card" />)}
        {data?.map((o) => (
          <div key={o.id} className="flex flex-col rounded-3xl border border-border bg-card p-5">
            <div className="flex flex-wrap gap-1.5">
              {o.discount_text && <Tag tone="ember">{o.discount_text}</Tag>}
              {o.is_members_only && <Tag tone="saffron"><Lock className="mr-1 size-3" />vybz+</Tag>}
              {o.is_sponsored && <Tag tone="sponsored">Sponsored{o.sponsors?.name ? ` · ${o.sponsors.name}` : ""}</Tag>}
            </div>
            <h2 className="mt-3 font-display text-xl font-semibold">{o.title}</h2>
            {o.description && <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>}
            {o.valid_until && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Valid until {new Date(o.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
            <div className="mt-auto flex gap-2 pt-4">
              {o.promo_code && !o.is_members_only && <Button variant="glass" size="sm" onClick={() => copy(o.promo_code!)}><Copy className="size-3.5" />{o.promo_code}</Button>}
              {o.is_members_only && <Button asChild variant="glass" size="sm"><Link to="/plus">Unlock with vybz+</Link></Button>}
              {o.url && <Button size="sm" variant="ember" onClick={() => { track("booking_click", { metadata: { offerId: o.id } }); window.open(o.url!, "_blank", "noopener,noreferrer"); }}>Redeem <ExternalLink className="size-3.5" /></Button>}
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No live offers right now. vybz only lists offers confirmed by the venue or partner.</div>
        )}
      </div>
    </AppShell>
  );
}
