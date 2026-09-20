import { useMutation, useQuery } from "@tanstack/react-query";
import { Bike, Clock, ExternalLink, Loader2, MapPin, Search, Utensils } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { swiggyErrorMessage, useSwiggyAddressId, useSwiggyAddresses, useSwiggyConnection } from "@/hooks/useSwiggy";
import { findSwiggyMatchForVenue, getSwiggyMenu, searchSwiggyDishes, searchSwiggyRestaurants } from "@/lib/swiggy/swiggy.functions";
import type { SwiggyRestaurant } from "@/lib/swiggy/protocol";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { SwiggyConnect } from "./SwiggyConnect";

const inr = (n: number | null) => (typeof n === "number" ? `₹${Math.round(n)}` : "—");

export function LiveFromSwiggyBadge({ fetchedAt }: { fetchedAt?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-primary-glow">
      <Bike className="size-3" /> Live from Swiggy
      {fetchedAt && <span className="text-muted-foreground">· {new Date(fetchedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</span>}
    </span>
  );
}

/** Address chooser. Only the chosen id is kept, for this session. */
export function SwiggyAddressPicker({ enabled }: { enabled: boolean }) {
  const { addressId, select } = useSwiggyAddressId();
  const addresses = useSwiggyAddresses(enabled);

  if (!enabled) return null;
  if (addresses.isLoading) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Reading your Swiggy addresses…</p>;
  if (addresses.error) {
    const { message } = swiggyErrorMessage(addresses.error);
    return <p className="text-xs text-saffron">{message}</p>;
  }
  const rows = addresses.data?.addresses ?? [];
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No saved delivery address found on your Swiggy account. Add one in Swiggy, then reload.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> Deliver to</span>
      {rows.map((a) => (
        <button
          key={a.id}
          onClick={() => select(a.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition",
            addressId === a.id ? "border-primary/50 bg-primary/15 text-primary-glow" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {a.label ?? "Saved address"}{a.area ? ` · ${a.area}` : ""}
        </button>
      ))}
    </div>
  );
}

function RestaurantCard({ r, addressId }: { r: SwiggyRestaurant; addressId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold leading-tight">{r.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[r.cuisines.join(", ") || null, r.area, r.costForTwo].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-teal">Open now</span>
            {r.deliveryTime && <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5"><Clock className="size-3" />{r.deliveryTime}</span>}
            {r.distance && <span className="rounded-full border border-border px-2 py-0.5">{r.distance}</span>}
          </div>
        </div>
        {r.url && (
          <Button
            size="sm"
            variant="ember"
            onClick={() => {
              track("booking_click", { metadata: { linkKind: "swiggy_order", placement: "swiggy_live", restaurant: r.id } });
              window.open(r.url!, "_blank", "noopener,noreferrer");
            }}
          >
            Order on Swiggy <ExternalLink className="size-3.5" />
          </Button>
        )}
      </div>
      <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-teal hover:underline">
        <Utensils className="size-3.5" /> {open ? "Hide menu" : "View live menu"}
      </button>
      {open && <MenuBrowser addressId={addressId} restaurantId={r.id} />}
    </div>
  );
}

function MenuBrowser({ addressId, restaurantId }: { addressId: string; restaurantId: string }) {
  const [page, setPage] = useState(1);
  const menu = useQuery({
    queryKey: ["swiggy-menu", restaurantId, addressId, page],
    queryFn: () => getSwiggyMenu({ data: { addressId, restaurantId, page, pageSize: 8 } }),
    retry: false,
  });

  if (menu.isLoading) return <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Loading the live menu…</p>;
  if (menu.error) return <p className="mt-3 text-xs text-saffron">{swiggyErrorMessage(menu.error).message}</p>;
  const d = menu.data;
  if (!d || d.categories.length === 0) return <p className="mt-3 text-xs text-muted-foreground">Swiggy returned no menu categories for this restaurant.</p>;

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <LiveFromSwiggyBadge fetchedAt={d.fetchedAt} />
      {d.categories.map((c, i) => (
        <div key={`${c.name ?? "items"}-${i}`}>
          {c.name && <p className="eyebrow">{c.name}</p>}
          <ul className="mt-1 divide-y divide-border">
            {c.items.map((item, j) => (
              <li key={item.id ?? `${item.name}-${j}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span>
                  {item.name}
                  {item.isVeg === true && <span className="ml-1.5 text-[10px] text-teal">VEG</span>}
                  {(item.hasVariants || item.hasAddons) && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{item.hasVariants ? "choices" : "add-ons"} available</span>
                  )}
                  {item.description && <span className="block text-xs text-muted-foreground">{item.description}</span>}
                </span>
                <span className="shrink-0 font-mono text-xs">{inr(item.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex items-center gap-2">
        {page > 1 && <Button size="sm" variant="glass" onClick={() => setPage((p) => p - 1)}>Previous</Button>}
        {d.nextPage && <Button size="sm" variant="glass" onClick={() => setPage(d.nextPage!)}>More categories</Button>}
        {d.totalPages && <span className="text-[11px] text-muted-foreground">Page {d.page} of {d.totalPages}</span>}
      </div>
    </div>
  );
}

/** Full live delivery search: address → restaurants → menu → dish search. */
export function SwiggyFoodSearch() {
  const { status } = useSwiggyConnection();
  const connected = !!status.data?.connected;
  const { addressId } = useSwiggyAddressId();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [offset, setOffset] = useState<number | null>(null);
  const [dishMode, setDishMode] = useState(false);

  const restaurants = useQuery({
    queryKey: ["swiggy-restaurants", addressId, submitted, offset],
    queryFn: () => searchSwiggyRestaurants({ data: { addressId: addressId!, query: submitted, offset } }),
    enabled: connected && !!addressId && submitted.length > 0 && !dishMode,
    retry: false,
  });

  const dishes = useMutation({
    mutationFn: (q: string) => searchSwiggyDishes({ data: { addressId: addressId!, query: q } }),
  });

  const run = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || !addressId) return;
    setOffset(null);
    track("search", { metadata: { source: "swiggy_live", mode: dishMode ? "dish" : "restaurant" } });
    if (dishMode) dishes.mutate(q);
    else setSubmitted(q);
  };

  return (
    <div className="space-y-4">
      <SwiggyConnect returnPath="/food" />
      {connected && (
        <>
          <SwiggyAddressPicker enabled />
          <form onSubmit={run} className="flex items-center gap-2 rounded-2xl border border-input bg-background/60 p-1.5 pl-4">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dishMode ? "Search a dish, e.g. butter chicken" : "Search restaurants, e.g. biryani, pizza, South Indian"}
              className="flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="sm" variant="ember" disabled={!addressId || !query.trim()}>Search</Button>
          </form>
          <div className="flex gap-2">
            {[{ label: "Restaurants", dish: false }, { label: "Dishes", dish: true }].map((t) => (
              <button
                key={t.label}
                onClick={() => setDishMode(t.dish)}
                className={cn("rounded-full border px-3 py-1 text-xs transition", dishMode === t.dish ? "border-primary/50 bg-primary/15 text-primary-glow" : "border-border text-muted-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>
          {!addressId && <p className="text-xs text-muted-foreground">Choose a delivery address above to search.</p>}

          {!dishMode && restaurants.isFetching && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Asking Swiggy…</p>}
          {!dishMode && restaurants.error && <p className="text-sm text-saffron">{swiggyErrorMessage(restaurants.error).message}</p>}
          {!dishMode && restaurants.data && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <LiveFromSwiggyBadge fetchedAt={restaurants.data.fetchedAt} />
                {restaurants.data.closedCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">{restaurants.data.closedCount} closed right now, hidden</span>
                )}
              </div>
              {restaurants.data.restaurants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No restaurants are open for delivery for that search right now.</p>
              ) : (
                restaurants.data.restaurants.map((r) => <RestaurantCard key={r.id} r={r} addressId={addressId!} />)
              )}
              {restaurants.data.nextOffset !== null && (
                <Button variant="glass" onClick={() => setOffset(restaurants.data!.nextOffset)}>Load more</Button>
              )}
            </div>
          )}

          {dishMode && dishes.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching dishes…</p>}
          {dishMode && dishes.error && <p className="text-sm text-saffron">{swiggyErrorMessage(dishes.error).message}</p>}
          {dishMode && dishes.data && (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <LiveFromSwiggyBadge fetchedAt={dishes.data.fetchedAt} />
              {dishes.data.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Swiggy returned no matching dishes.</p>
              ) : (
                dishes.data.categories.map((c, i) => (
                  <div key={i}>
                    {c.name && <p className="eyebrow">{c.name}</p>}
                    <ul className="mt-1 divide-y divide-border">
                      {c.items.map((item, j) => (
                        <li key={item.id ?? `${item.name}-${j}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span>{item.name}{item.isVeg === true && <span className="ml-1.5 text-[10px] text-teal">VEG</span>}</span>
                          <span className="font-mono text-xs">{inr(item.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Live Swiggy delivery for a venue already in My Mood's catalogue.
 * My Mood's verified facts stay canonical above; this section is clearly labelled as live Swiggy data.
 */
export function SwiggyVenueLive({ venueName }: { venueName: string }) {
  const { signedIn, status } = useSwiggyConnection();
  const connected = !!status.data?.connected;
  const { addressId } = useSwiggyAddressId();

  const match = useQuery({
    queryKey: ["swiggy-venue-match", venueName, addressId],
    queryFn: () => findSwiggyMatchForVenue({ data: { addressId: addressId!, venueName } }),
    enabled: connected && !!addressId,
    retry: false,
  });

  if (!signedIn) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-semibold"><Bike className="size-4 text-primary-glow" /> Food delivery</h2>
        {match.data?.fetchedAt && <LiveFromSwiggyBadge fetchedAt={match.data.fetchedAt} />}
      </div>
      {!connected ? (
        <SwiggyConnect returnPath={window.location.pathname} compact />
      ) : !addressId ? (
        <SwiggyAddressPicker enabled />
      ) : match.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Checking Swiggy…</p>
      ) : match.error ? (
        <p className="text-xs text-saffron">{swiggyErrorMessage(match.error).message}</p>
      ) : match.data?.match ? (
        <>
          {!match.data.match.isOpen && <p className="text-xs text-muted-foreground">Currently closed for delivery on Swiggy.</p>}
          <RestaurantCard r={match.data.match} addressId={addressId} />
          <p className="text-[11px] text-muted-foreground">Delivery details, menu and prices come live from Swiggy. My Mood's verified venue information above is unchanged.</p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No matching Swiggy restaurant found for this venue.</p>
      )}
    </section>
  );
}
