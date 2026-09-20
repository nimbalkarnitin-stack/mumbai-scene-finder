import { Link } from "@tanstack/react-router";
import { Calendar, Clock, ExternalLink, MapPin, Ticket, User } from "lucide-react";
import type { SceneItem } from "@/lib/scene-types";
import { formatPrice, track } from "@/lib/track";

const IST = "Asia/Kolkata";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
}

/** Status relative to now, computed in Mumbai time. */
function eventStatus(item: SceneItem): { label: string; tone: "live" | "soon" | "past" } | null {
  if (!item.startsAt) return null;
  const now = Date.now();
  const start = new Date(item.startsAt).getTime();
  const end = item.endsAt ? new Date(item.endsAt).getTime() : null;
  if (end !== null && now > end) return { label: "This event has ended", tone: "past" };
  if (now >= start && (end === null || now <= end)) return { label: "Happening now", tone: "live" };
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IST, dateStyle: "short" });
  const today = dayFmt.format(new Date(now));
  if (dayFmt.format(new Date(start)) === today) return { label: `Today · starts ${fmtTime(item.startsAt)}`, tone: "live" };
  const tomorrow = dayFmt.format(new Date(now + 86400000));
  if (dayFmt.format(new Date(start)) === tomorrow) return { label: `Tomorrow · starts ${fmtTime(item.startsAt)}`, tone: "soon" };
  return { label: `Coming up · ${fmtDate(item.startsAt)}`, tone: "soon" };
}

/**
 * Event information rendered strictly from stored source-backed fields.
 * A row only appears when the source actually published it — nothing is inferred.
 */
export function EventInfo({ item }: { item: SceneItem }) {
  const e = item.event;
  if (!e) return null;

  const status = eventStatus(item);
  const mapsUrl =
    e.venueMapUrl ??
    (e.venueLat !== null && e.venueLng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${e.venueLat},${e.venueLng}`
      : e.venueAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venueName ?? item.name} ${e.venueAddress} Mumbai`)}`
        : null);
  const embedUrl =
    e.venueLat !== null && e.venueLng !== null
      ? `https://www.google.com/maps?q=${e.venueLat},${e.venueLng}&z=15&output=embed`
      : e.venueAddress
        ? `https://www.google.com/maps?q=${encodeURIComponent(`${e.venueName ?? item.name} ${e.venueAddress} Mumbai`)}&z=15&output=embed`
        : null;

  const outbound = (kind: string, url: string) => {
    track(kind === "booking" ? "booking_click" : "discovery_click", {
      itemType: item.type,
      itemId: item.id,
      metadata: { linkKind: kind, placement: "event_info" },
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Event details</h2>
          {status && (
            <span
              className={
                status.tone === "live"
                  ? "rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-xs font-medium text-teal"
                  : status.tone === "soon"
                    ? "rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-glow"
                    : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              }
            >
              {status.tone === "live" && <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-teal align-middle" />}
              {status.label}
            </span>
          )}
        </div>
        <dl className="mt-3 space-y-2.5 text-sm">
          {item.startsAt && (
            <div className="flex gap-2">
              <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <dd>{fmtDate(item.startsAt)}</dd>
            </div>
          )}
          {item.startsAt && (
            <div className="flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <dd>
                {fmtTime(item.startsAt)}
                {item.endsAt ? ` – ${fmtTime(item.endsAt)}` : ""} IST
              </dd>
            </div>
          )}
          {(e.venueName || e.venueAddress) && (
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <dd>
                {e.venueSlug ? (
                  <Link to="/v/$slug" params={{ slug: e.venueSlug }} className="font-medium text-teal hover:underline">
                    {e.venueName}
                  </Link>
                ) : (
                  e.venueName && <span className="font-medium">{e.venueName}</span>
                )}
                {e.venueAddress && <span className="block text-muted-foreground">{e.venueAddress}</span>}
              </dd>
            </div>
          )}
          {e.organiser && (
            <div className="flex gap-2">
              <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <dd>Organised by {e.organiser}</dd>
            </div>
          )}
          {(item.priceMin !== null || item.priceMax !== null) && (
            <div className="flex gap-2">
              <Ticket className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <dd>{formatPrice(item.priceMin, item.priceMax)}</dd>
            </div>
          )}
        </dl>
        {(item.bookingUrl || item.websiteUrl || e.venueWebsiteUrl || mapsUrl) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.bookingUrl && (
              <button
                onClick={() => outbound("booking", item.bookingUrl!)}
                className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
              >
                Book / tickets <ExternalLink className="ml-1 inline size-3" />
              </button>
            )}
            {(item.websiteUrl ?? e.venueWebsiteUrl) && (
              <button
                onClick={() => outbound("website", (item.websiteUrl ?? e.venueWebsiteUrl)!)}
                className="rounded-full border border-border px-4 py-2 text-xs text-foreground transition hover:bg-secondary"
              >
                Official website <ExternalLink className="ml-1 inline size-3" />
              </button>
            )}
            {mapsUrl && (
              <button
                onClick={() => outbound("map", mapsUrl)}
                className="rounded-full border border-border px-4 py-2 text-xs text-foreground transition hover:bg-secondary"
              >
                Open in Maps <ExternalLink className="ml-1 inline size-3" />
              </button>
            )}
          </div>
        )}
        {e.sourceName && (
          <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
            Details from {e.sourceName.replace(/-/g, " ")}
            {item.sourceUrl && (
              <>
                {" · "}
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">
                  view source <ExternalLink className="inline size-3" />
                </a>
              </>
            )}
          </p>
        )}
      </section>

      {embedUrl && (
        <section className="overflow-hidden rounded-2xl border border-border">
          <iframe
            title={`Map of ${e.venueName ?? item.name}, Mumbai`}
            src={embedUrl}
            className="h-64 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>
      )}
    </div>
  );
}
