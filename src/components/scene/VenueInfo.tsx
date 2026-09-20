import { Clock, ExternalLink, Mail, MapPin, Phone, UtensilsCrossed } from "lucide-react";
import { DAY_KEYS, DAY_LABEL, todayStatus } from "@/lib/ingestion/venue-profile";
import type { SceneItem } from "@/lib/scene-types";
import { track } from "@/lib/track";

/**
 * Venue information, rendered strictly from stored source-backed fields.
 * A section only appears when the source actually published it — nothing is inferred,
 * and no section is padded with a placeholder.
 */
export function VenueInfo({ item }: { item: SceneItem }) {
  const v = item.venue;
  if (!v) return null;

  const hoursToday = todayStatus(v.hours ?? null);
  const goodToKnow = [
    v.serviceType && { label: "Type", value: v.serviceType },
    v.cuisines.length > 0 && { label: "Cuisine", value: v.cuisines.join(", ") },
    v.dietaryOptions.length > 0 && { label: "Dietary", value: v.dietaryOptions.join(", ") },
    v.priceBand && { label: "Price range", value: v.priceBand },
    v.coverCharge && { label: "Cover charge", value: v.coverCharge },
    v.dressCode && { label: "Dress code", value: v.dressCode },
    v.ageRestriction && { label: "Age", value: v.ageRestriction },
    v.parking && { label: "Parking", value: v.parking },
    v.accessibility && { label: "Accessibility", value: v.accessibility },
    v.petPolicy && { label: "Pets", value: v.petPolicy },
  ].filter(Boolean) as { label: string; value: string }[];

  // A reservation link is a real booking intent; a map, menu or social link is discovery.
  const outbound = (kind: string, url: string) => {
    track(kind === "reservation" ? "booking_click" : "discovery_click", {
      itemType: item.type,
      itemId: item.id,
      metadata: { linkKind: kind, placement: "venue_info" },
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const mapsUrl =
    v.mapUrl ??
    (v.lat !== null && v.lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`
      : v.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${v.address}`)}`
        : null);

  const hasAnything =
    v.address || v.phone || v.email || v.contactUrl || v.hours || v.menuUrl || v.reservationUrl || v.eventsUrl || goodToKnow.length > 0 || v.amenities.length > 0 || Object.keys(v.socialUrls).length > 0;
  if (!hasAnything) {
    return (
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h2 className="text-lg font-semibold">Venue information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We haven't found published hours, contact details or a menu for this venue yet. Check the venue's own site before you go.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {(v.address || mapsUrl || v.phone || v.email || v.contactUrl) && (
        <section className="rounded-2xl border border-border bg-card/60 p-4">
          <h2 className="text-lg font-semibold">Location &amp; contact</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {v.address && (
              <div className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <dd>
                  {v.address}
                  {v.locality && !v.address.toLowerCase().includes(v.locality.toLowerCase()) ? `, ${v.locality}` : ""}
                </dd>
              </div>
            )}
            {v.phone && (
              <div className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <dd><a href={`tel:${v.phone}`} className="hover:underline" onClick={() => track("discovery_click", { itemType: item.type, itemId: item.id, metadata: { linkKind: "phone" } })}>{v.phone}</a></dd>
              </div>
            )}
            {v.email && (
              <div className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <dd><a href={`mailto:${v.email}`} className="hover:underline">{v.email}</a></dd>
              </div>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {mapsUrl && (
              <button type="button" onClick={() => outbound("map", mapsUrl)} className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted">
                Open in Maps
              </button>
            )}
            {v.contactUrl && (
              <button type="button" onClick={() => outbound("contact", v.contactUrl!)} className="rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-muted">
                Contact page
              </button>
            )}
            {Object.entries(v.socialUrls).map(([platform, url]) => (
              <button key={platform} type="button" onClick={() => outbound(`social:${platform}`, url)} className="rounded-full border border-border px-3 py-1.5 text-xs capitalize transition hover:bg-muted">
                {platform}
              </button>
            ))}
          </div>
        </section>
      )}

      {v.hours && (
        <section className="rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Clock className="size-4" /> Opening hours</h2>
            {hoursToday.range && (
              <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${hoursToday.open ? "text-teal" : "text-muted-foreground"}`}>
                {hoursToday.open === null ? "Published hours" : hoursToday.open ? "Open now" : "Closed now"}
              </span>
            )}
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {DAY_KEYS.map((d) => (
                <tr key={d} className={d === hoursToday.day ? "font-medium" : "text-muted-foreground"}>
                  <td className="py-1">{DAY_LABEL[d]}</td>
                  <td className="py-1 text-right font-mono">{v.hours?.[d] ?? "Not published"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">Hours as published by the venue (Asia/Kolkata). Confirm before travelling.</p>
        </section>
      )}

      {(v.menuUrl || v.reservationUrl || v.eventsUrl) && (
        <section className="rounded-2xl border border-border bg-card/60 p-4">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><UtensilsCrossed className="size-4" /> Visit &amp; book</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {v.reservationUrl && (
              <button type="button" onClick={() => outbound("reservation", v.reservationUrl!)} className="inline-flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-xs">
                Reserve a table{v.bookingProvider ? ` · ${v.bookingProvider}` : ""} <ExternalLink className="size-3" />
              </button>
            )}
            {v.menuUrl && (
              <button type="button" onClick={() => outbound("menu", v.menuUrl!)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                View menu <ExternalLink className="size-3" />
              </button>
            )}
            {v.eventsUrl && (
              <button type="button" onClick={() => outbound("whats_on", v.eventsUrl!)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                What&apos;s on <ExternalLink className="size-3" />
              </button>
            )}
          </div>
        </section>
      )}

      {(goodToKnow.length > 0 || v.amenities.length > 0) && (
        <section className="rounded-2xl border border-border bg-card/60 p-4">
          <h2 className="text-lg font-semibold">Good to know</h2>
          {goodToKnow.length > 0 && (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {goodToKnow.map((g) => (
                <div key={g.label} className="text-sm">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{g.label}</dt>
                  <dd>{g.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {v.amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.amenities.map((a) => <span key={a} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{a}</span>)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
