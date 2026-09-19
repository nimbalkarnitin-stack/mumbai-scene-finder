import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getHappeningNow, type NowEvent, type NowWindow } from "@/lib/ingestion/now.functions";
import { formatIst } from "@/lib/ingestion/timezone";

function priceLabel(item: NowEvent) {
  if (item.priceMin === null && item.priceMax === null) return null;
  if (item.priceMin !== null && item.priceMax !== null && item.priceMin !== item.priceMax) return `₹${item.priceMin}–₹${item.priceMax}`;
  return `₹${item.priceMin ?? item.priceMax}`;
}

function EventRow({ item }: { item: NowEvent }) {
  return (
    <Link to="/e/$slug" params={{ slug: item.slug }} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5 transition hover:border-primary/40">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-lg bg-secondary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatIst(item.startsAt)} IST{item.areaName ? ` · ${item.areaName}` : ""}
          {priceLabel(item) ? ` · ${priceLabel(item)}` : ""}
        </p>
      </div>
      {item.verification === "VERIFIED" ? (
        <span className="shrink-0 rounded-full border border-teal/40 bg-teal/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-teal">Verified</span>
      ) : (
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Confirm with venue</span>
      )}
    </Link>
  );
}

function WindowCard({ w }: { w: NowWindow }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{w.label}</h3>
        <span className="font-display text-2xl font-semibold">{w.count}</span>
      </div>
      {w.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing listed in this window yet.</p>
      ) : (
        <div className="space-y-2">
          {w.items.slice(0, 3).map((i) => (
            <EventRow key={`${w.key}-${i.id}`} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Live windows from the real catalogue. Counts are actual stored ACTIVE events, never estimates. */
export function HappeningNow() {
  const q = useQuery({ queryKey: ["happening-now"], queryFn: () => getHappeningNow(), staleTime: 2 * 60 * 1000 });

  return (
    <section className="px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">What's happening</p>
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Mumbai, right now</h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Asia/Kolkata</span>
        </div>

        {q.isLoading && <p className="text-sm text-muted-foreground">Checking the live listings…</p>}
        {q.error && <p className="text-sm text-muted-foreground">Live listings are unavailable right now.</p>}

        {q.data && q.data.total === 0 && (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No events are listed for these time windows yet. These counts come only from real, source-backed listings — nothing is filled in automatically.
          </p>
        )}

        {q.data && q.data.total > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {q.data.windows.map((w) => (
              <WindowCard key={w.key} w={w} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
