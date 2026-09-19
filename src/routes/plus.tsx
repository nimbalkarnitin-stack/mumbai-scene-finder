import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/scene/AppShell";
import { Button } from "@/components/ui/button";
import { HERO_IMAGE } from "@/lib/scene-images";
import { listProducts } from "@/lib/scene.functions";
import { track } from "@/lib/track";

const TITLE = "SceneAI+ — Mumbai's concierge, upgraded";
const DESC = "Unlimited AI itineraries, members-only deals, early access to events and curated city guides.";

export const Route = createFileRoute("/plus")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: PlusPage,
});

const PERKS = [
  "Unlimited AI itineraries and concierge conversations",
  "Members-only deals and promo codes across Mumbai",
  "Early access and priority alerts for gigs and comedy nights",
  "Curated neighbourhood guides, refreshed weekly",
  "Saved scenes synced across devices",
  "No sponsored listings in your recommendations",
];

function PlusPage() {
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), staleTime: 300_000 });
  return (
    <AppShell>
      <section className="relative overflow-hidden md:mx-6 md:mt-6 md:rounded-[2rem]">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 size-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="relative mx-auto max-w-2xl px-4 pb-10 pt-24 text-center md:pt-32">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-saffron/40 bg-saffron/10 px-3 py-1 text-xs font-medium text-saffron"><Crown className="size-3.5" /> SceneAI+</span>
          <h1 className="mt-4 text-5xl font-medium leading-[0.98] md:text-7xl">Your city,<br /><em className="text-gradient-ember not-italic">on retainer.</em></h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">One membership. Every weekend planned, every deal unlocked, every list curated for how you actually go out.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-6 px-4 pt-6 md:grid-cols-[1fr_320px]">
        <ul className="space-y-3">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-teal" />{p}</li>
          ))}
        </ul>
        <aside className="h-fit rounded-3xl border border-saffron/30 bg-gradient-to-b from-saffron/10 to-card p-6 md:sticky md:top-20">
          <p className="eyebrow text-saffron">Membership</p>
          <p className="mt-2 text-sm text-muted-foreground">Pricing and checkout for SceneAI+ open soon. Join the list and we'll tell you first.</p>
          <Button asChild variant="ember" size="lg" className="mt-5 w-full"><Link to="/auth" search={{ next: "/plus" }} onClick={() => track("conversion", { metadata: { intent: "plus_waitlist" } })}>Join the waitlist</Link></Button>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">No charge until launch</p>
        </aside>
      </div>

      {products && products.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pt-14">
          <p className="eyebrow mb-3">Digital products</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((p) => (
              <div key={p.id} className="flex gap-4 rounded-3xl border border-border bg-card p-4">
                {p.image_url && <img src={p.image_url} alt="" className="size-24 rounded-2xl object-cover" />}
                <div className="flex-1">
                  <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                  {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-sm">₹{Number(p.price).toLocaleString("en-IN")}</span>
                    {p.purchase_url && <Button size="sm" variant="glass" onClick={() => { track("conversion", { metadata: { productId: p.id } }); window.open(p.purchase_url!, "_blank", "noopener,noreferrer"); }}>Get it <ExternalLink className="size-3.5" /></Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
