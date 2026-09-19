import { Link } from "@tanstack/react-router";
import { Bookmark, ExternalLink, Share2, MapPin, Clock, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tag } from "./Chip";
import { Button } from "@/components/ui/button";
import type { Recommendation, SceneItem } from "@/lib/scene-types";
import { formatPrice, formatWhen, openOutbound, resolveOutboundLink, track } from "@/lib/track";
import { itemImage } from "@/lib/scene-images";
import { useSaved } from "@/hooks/useSaved";

type Item = SceneItem | Recommendation;

export function SceneCard({ item, index = 0, compact = false }: { item: Item; index?: number; compact?: boolean }) {
  const reasons = "reasons" in item ? item.reasons : [];
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(item.type, item.id);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    setSharing(true);
    const url = `${window.location.origin}/${item.type === "venue" ? "v" : item.type === "event" ? "e" : "x"}/${item.slug}`;
    track("share", { itemType: item.type, itemId: item.id });
    try {
      if (navigator.share) await navigator.share({ title: item.name, text: `${item.name} — found on SceneAI`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    } finally {
      setSharing(false);
    }
  };

  const link = resolveOutboundLink(item);
  const book = () => openOutbound(item, { source: "card" });

  const detailProps = item.type === "venue" ? { to: "/v/$slug" as const } : item.type === "event" ? { to: "/e/$slug" as const } : { to: "/x/$slug" as const };

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-card shadow-card animate-rise",
        item.isSponsored ? "border-saffron/40" : "border-border",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      {item.isSponsored && (
        <div className="flex items-center justify-between bg-saffron/10 px-4 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-saffron">Sponsored{item.sponsorName ? ` · ${item.sponsorName}` : ""}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Ad</span>
        </div>
      )}
      <Link {...detailProps} params={{ slug: item.slug }} className="block" onClick={() => track("item_view", { itemType: item.type, itemId: item.id })}>
        <div className={cn("relative overflow-hidden", compact ? "aspect-[16/10]" : "aspect-[4/3] sm:aspect-[16/10]")}>
          <img
            src={itemImage(item)}
            alt={item.name}
            loading="lazy"
            width={1024}
            height={768}
            className="size-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
          <div className="image-fade absolute inset-0" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {item.categoryName && <Tag>{item.categoryName}</Tag>}
            <Tag tone="ember">{formatPrice(item.priceMin, item.priceMax)}</Tag>
          </div>
          <div className="absolute inset-x-4 bottom-3">
            <h3 className="font-display text-[22px] font-semibold leading-tight text-foreground drop-shadow">{item.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/80">
              {item.areaName && (
                <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{item.areaName}</span>
              )}
              <span className="inline-flex items-center gap-1"><Clock className="size-3" />{formatWhen(item)}</span>
              {item.isVerified && <span className="inline-flex items-center gap-1 text-teal"><BadgeCheck className="size-3" />Verified</span>}
            </div>
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        {item.description && <p className="line-clamp-2 text-[13.5px] text-muted-foreground">{item.description}</p>}
        {reasons.length > 0 && (
          <div className="rounded-2xl border border-primary/25 bg-primary/10 px-3.5 py-2.5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-primary-glow">Why SceneAI picked this</p>
            <p className="mt-1 text-[13px] text-foreground/90">{reasons.join(" · ")}</p>
          </div>
        )}
        {!item.isVerified && (
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-saffron">Details unverified · confirm with venue</p>
        )}
        <div className="flex gap-2">
          <Button variant="ember" className="flex-1" onClick={book}>
            {link.label} <ExternalLink className="size-3.5" />
          </Button>
          <Button variant="glass" size="icon" aria-label={saved ? "Remove from saved" : "Save"} onClick={() => toggle(item.type, item.id)}>
            <Bookmark className={cn("size-4", saved && "fill-primary-glow text-primary-glow")} />
          </Button>
          <Button variant="glass" size="icon" aria-label="Share" onClick={share} disabled={sharing}>
            <Share2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function SceneCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="aspect-[4/3] animate-pulse bg-muted sm:aspect-[16/10]" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
