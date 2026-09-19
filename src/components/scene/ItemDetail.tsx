import { Link } from "@tanstack/react-router";
import { Bookmark, ExternalLink, Share2, MapPin, Clock, BadgeCheck, MessageCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "./AppShell";
import { Tag } from "./Chip";
import { SceneCard } from "./SceneCard";
import { Button } from "@/components/ui/button";
import { useSaved } from "@/hooks/useSaved";
import { itemImage } from "@/lib/scene-images";
import type { SceneItem } from "@/lib/scene-types";
import { formatPrice, formatWhen, openOutboundMonetised, resolveOutboundLink, track } from "@/lib/track";
import { AffiliateDisclosure } from "./Disclosure";
import { cn } from "@/lib/utils";

export function ItemDetail({ item, related }: { item: SceneItem; related: SceneItem[] }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(item.type, item.id);

  const link = resolveOutboundLink(item);
  const book = () => { void openOutboundMonetised(item, { placement: "detail" }); };
  const share = async () => {
    track("share", { itemType: item.type, itemId: item.id });
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: item.name, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* dismissed */ }
  };

  return (
    <AppShell>
      <div className="relative overflow-hidden md:mx-6 md:mt-6 md:rounded-[2rem]">
        <img src={itemImage(item)} alt={item.name} width={1024} height={768} className="aspect-[4/3] w-full object-cover md:aspect-[21/9]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Link to="/explore" className="glass absolute left-4 top-4 grid size-9 place-items-center rounded-full border border-border"><ArrowLeft className="size-4" /></Link>
        {item.isSponsored && (
          <div className="absolute right-4 top-4"><Tag tone="sponsored">Sponsored{item.sponsorName ? ` · ${item.sponsorName}` : ""}</Tag></div>
        )}
        <div className="absolute inset-x-4 bottom-4 md:inset-x-10">
          <div className="flex flex-wrap gap-1.5">
            {item.categoryName && <Tag>{item.categoryName}</Tag>}
            <Tag tone="ember">{formatPrice(item.priceMin, item.priceMax)}</Tag>
            {item.isVerified && <Tag tone="teal"><BadgeCheck className="mr-1 size-3" />Verified</Tag>}
          </div>
          <h1 className="mt-2 text-4xl font-medium leading-[1.02] md:text-6xl">{item.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/85">
            {item.areaName && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{item.areaName}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{formatWhen(item)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 px-4 pt-6 md:grid-cols-[1fr_320px] md:px-6">
        <div className="space-y-6">
          {!item.isVerified && (
            <p className="rounded-2xl border border-saffron/30 bg-saffron/10 px-4 py-3 text-sm text-saffron">
              Details unverified — SceneAI hasn't confirmed hours, prices or availability with this venue yet. Please check before you go.
            </p>
          )}
          {item.description && <p className="text-[15.5px] leading-relaxed text-foreground/90">{item.description}</p>}
          <div className="flex flex-wrap gap-2">
            {item.moods.map((m) => <span key={m} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs capitalize text-primary-glow">{m.replace(/-/g, " ")}</span>)}
            {item.groupTypes.map((g) => <span key={g} className="rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs capitalize text-teal">{g}</span>)}
            {item.tags.map((t) => <span key={t} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{t}</span>)}
          </div>
          <Link to="/concierge" search={{ q: `Tell me about ${item.name}${item.areaName ? ` in ${item.areaName}` : ""} and what to pair it with for a full evening.` }} className="flex items-center justify-between rounded-2xl border border-teal/25 bg-teal/5 px-4 py-3 text-sm transition hover:bg-teal/10">
            <span className="inline-flex items-center gap-2 text-teal"><MessageCircle className="size-4" /> Ask the concierge about this</span>
            <span className="text-muted-foreground">→</span>
          </Link>
        </div>
        <aside className="h-fit space-y-2 rounded-3xl border border-border bg-card p-4 md:sticky md:top-20">
          <p className="eyebrow">From</p>
          <p className="font-display text-3xl font-semibold">{formatPrice(item.priceMin, item.priceMax)}</p>
          <Button variant="ember" size="lg" className="mt-2 w-full" onClick={book}>{link.kind === "booking" ? "Book now" : link.label} <ExternalLink className="size-4" /></Button>
          {link.kind !== "booking" && (
            <p className="text-[11px] text-muted-foreground">No booking link on file — this opens {link.kind === "website" ? "the venue's own site" : "a map search"}.</p>
          )}
          <div className="flex gap-2">
            <Button variant="glass" className="flex-1" onClick={() => toggle(item.type, item.id)}><Bookmark className={cn("size-4", saved && "fill-primary-glow text-primary-glow")} />{saved ? "Saved" : "Save"}</Button>
            <Button variant="glass" className="flex-1" onClick={share}><Share2 className="size-4" />Share</Button>
          </div>
          {link.kind !== "map" && <AffiliateDisclosure className="mt-2" />}
          <div className="space-y-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
            <p>{item.isVerified ? "Checked by a SceneAI editor" : "Not yet checked by a SceneAI editor"}</p>
            {item.updatedAt && <p>Record last updated {new Date(item.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}</p>}
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal hover:underline">Source <ExternalLink className="size-3" /></a>
            )}
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="pt-12">
          <h2 className="px-4 text-2xl font-semibold md:px-6">Pairs well with</h2>
          <div className="mt-4 grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-4">
            {related.map((r, i) => <SceneCard key={r.id} item={r} index={i} compact />)}
          </div>
        </section>
      )}
    </AppShell>
  );
}
