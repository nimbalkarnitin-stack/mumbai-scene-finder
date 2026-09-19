import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { SceneCard } from "./SceneCard";
import { SponsoredDisclosure } from "./Disclosure";
import { listSponsoredCards } from "@/lib/scene.functions";
import { track } from "@/lib/track";

/**
 * Paid placements, kept completely separate from organic recommendations and always
 * labelled. Nothing renders unless an admin has a live campaign pointing at a real listing.
 */
export function SponsoredRail({ placement = "discovery", className }: { placement?: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["sponsored-rail", placement],
    queryFn: () => listSponsoredCards({ data: { placement } }),
    staleTime: 300_000,
  });

  const cards = data?.cards ?? [];

  useEffect(() => {
    for (const c of cards) {
      track("sponsored_impression", { itemType: c.item.type, itemId: c.item.id, metadata: { placementId: c.placementId, campaign: c.campaignName, placement } });
    }
  }, [cards, placement]);

  if (cards.length === 0) return null;

  return (
    <section className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6">
        <p className="eyebrow text-saffron">Sponsored · paid placement</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Not ranked with organic picks</p>
      </div>
      <div className="mt-3 grid gap-4 px-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
        {cards.map((c, i) => (
          <div key={c.placementId}>
            <SceneCard
              item={{ ...c.item, isSponsored: true, sponsorName: c.item.sponsorName }}
              index={i}
              monetisation={{ sponsoredListingId: c.placementId, campaign: c.campaignName, placement, isSponsored: true }}
            />
          </div>
        ))}
      </div>
      <SponsoredDisclosure text={data?.disclosure} className="mx-4 mt-3 md:mx-6" />
    </section>
  );
}
