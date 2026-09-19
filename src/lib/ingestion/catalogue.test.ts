import { describe, expect, it } from "vitest";
import { extractJsonLd, jsonLdType } from "./adapters/shared";
import { officialSiteAdapter } from "./adapters/official-site.server";
import { crossSourceState, detectFieldConflicts, isPubliclyListable, PUBLIC_VISIBLE_STATES } from "./provenance";
import { DEFAULT_GATE } from "./types";
import { isSafeExternalUrl } from "./url-guard";

const eventHtml = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicEvent","name":"Indie Night","startDate":"2026-10-02T20:30:00+05:30","location":{"@type":"MusicVenue","name":"antiSOCIAL","address":{"streetAddress":"Khar West","addressLocality":"Mumbai"}},"offers":{"@type":"Offer","price":"500","priceCurrency":"INR","url":"https://venue.example.com/tickets"}}</script>
</head><body></body></html>`;

const venueHtml = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"CafeOrCoffeeShop","name":"Cat Cafe Studio","address":{"streetAddress":"Versova","addressLocality":"Mumbai"},"url":"https://catcafe.example.com"}</script>
</head><body></body></html>`;

function parseAndNormalise(html: string, pageUrl: string) {
  const node = extractJsonLd(html)[0]!;
  const parsed = officialSiteAdapter.parse!({ raw: { ...node, __page: pageUrl }, sourceUrl: pageUrl })!;
  return officialSiteAdapter.normalise(parsed, { raw: parsed, sourceUrl: pageUrl });
}

describe("JSON-LD extraction from official pages", () => {
  it("reads an Event node and keeps only sourced facts", () => {
    const rec = parseAndNormalise(eventHtml, "https://venue.example.com/whats-on");
    expect(rec.kind).toBe("event");
    expect(rec.name).toBe("Indie Night");
    expect(rec.startsAt).toBe("2026-10-02T15:00:00.000Z");
    expect(rec.venueName).toBe("antiSOCIAL");
    expect(rec.priceMin).toBe(500);
    expect(rec.bookingUrl).toBe("https://venue.example.com/tickets");
    expect(rec.confirmed.date).toBe(true);
    expect(rec.confirmed.venue).toBe(true);
  });

  it("classifies a business node as a venue and reads its own address", () => {
    const rec = parseAndNormalise(venueHtml, "https://catcafe.example.com");
    expect(rec.kind).toBe("venue");
    expect(rec.venueName).toBe("Cat Cafe Studio");
    expect(rec.address).toBe("Versova");
    expect(rec.startsAt).toBeNull();
  });

  it("leaves unsourced fields empty instead of inventing them", () => {
    const rec = parseAndNormalise(venueHtml, "https://catcafe.example.com");
    expect(rec.priceMin).toBeNull();
    expect(rec.priceMax).toBeNull();
    expect(rec.bookingUrl).toBeNull();
    expect(rec.imageUrl).toBeNull();
    expect(rec.description).toBeNull();
  });

  it("survives malformed and empty structured data without throwing", () => {
    expect(extractJsonLd(`<script type="application/ld+json">{ not json </script>`)).toEqual([]);
    expect(extractJsonLd("<html><body>no structured data</body></html>")).toEqual([]);
    expect(jsonLdType({})).toBe("");
  });

  it("skips a node with no name", () => {
    const raw = { "@type": "Event", startDate: "2026-10-02" };
    const parsed = officialSiteAdapter.parse!({ raw, sourceUrl: "https://x.example.com" });
    expect(parsed).toBeNull();
  });

  it("only accepts safe public page URLs", () => {
    expect(isSafeExternalUrl("https://venue.example.com/whats-on")).toBe(true);
    expect(isSafeExternalUrl("http://127.0.0.1/whats-on")).toBe(false);
    expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
  });
});

describe("cross-source verification and conflicts", () => {
  const observation = (source: string, field: "starts_at" | "price_min", value: string, authority: number) => ({
    field,
    sourceRecordId: `${source}-record`,
    value,
    sourceName: source,
    sourceUrl: `https://${source}.example.com`,
    sourceType: "official_site" as const,
    authorityLevel: authority,
    confidence: 1,
    observedAt: new Date().toISOString(),
  });

  it("flags a field where two official sources disagree", () => {
    const conflicts = detectFieldConflicts([
      observation("venue-a", "starts_at", "2026-10-02T20:30:00.000Z", 5),
      observation("venue-b", "starts_at", "2026-10-03T20:30:00.000Z", 5),
    ]);
    expect(conflicts.map((c) => c.field)).toContain("starts_at");
  });

  it("does not flag agreeing sources", () => {
    const conflicts = detectFieldConflicts([
      observation("venue-a", "starts_at", "2026-10-02T20:30:00.000Z", 5),
      observation("venue-b", "starts_at", "2026-10-02T20:30:00.000Z", 4),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("holds a conflicting record at REVIEW_REQUIRED rather than picking a value", () => {
    const obs = [
      observation("venue-a", "starts_at", "2026-10-02T20:30:00.000Z", 5),
      observation("venue-b", "starts_at", "2026-10-03T20:30:00.000Z", 5),
    ];
    const verdict = crossSourceState({
      observations: obs,
      conflicts: detectFieldConflicts(obs),
      ageHours: 1,
      staleAfterHours: DEFAULT_GATE.stale_after_hours,
    });
    expect(verdict.state).toBe("REVIEW_REQUIRED");
  });

  it("marks a record stale once its source check is older than the window", () => {
    const obs = [observation("venue-a", "starts_at", "2026-10-02T20:30:00.000Z", 5)];
    const verdict = crossSourceState({ observations: obs, conflicts: [], ageHours: 200, staleAfterHours: 72 });
    expect(verdict.state).toBe("STALE");
  });
});

describe("recommendation surface filtering", () => {
  it("never lists stale or unverified records publicly", () => {
    expect(isPubliclyListable("VERIFIED")).toBe(true);
    expect(isPubliclyListable("PARTIALLY_VERIFIED")).toBe(true);
    expect(isPubliclyListable("STALE")).toBe(false);
    expect(isPubliclyListable("UNVERIFIED")).toBe(false);
    expect(isPubliclyListable(null)).toBe(false);
  });

  it("keeps the public state list free of stale/unverified values", () => {
    expect(PUBLIC_VISIBLE_STATES).not.toContain("STALE");
    expect(PUBLIC_VISIBLE_STATES).not.toContain("UNVERIFIED");
  });

  const rows = [
    { id: "a", is_active: true, lifecycle_status: "ACTIVE", verification_status: "VERIFIED", starts_at: "2026-09-20T18:00:00.000Z" },
    { id: "b", is_active: false, lifecycle_status: "ACTIVE", verification_status: "VERIFIED", starts_at: "2026-09-20T18:00:00.000Z" },
    { id: "c", is_active: true, lifecycle_status: "PENDING_REVIEW", verification_status: "VERIFIED", starts_at: "2026-09-20T18:00:00.000Z" },
    { id: "d", is_active: true, lifecycle_status: "ACTIVE", verification_status: "STALE", starts_at: "2026-09-20T18:00:00.000Z" },
    { id: "e", is_active: true, lifecycle_status: "EXPIRED", verification_status: "VERIFIED", starts_at: "2026-09-18T18:00:00.000Z" },
  ];

  // Mirrors the live-window query: active + ACTIVE lifecycle + publicly listable state.
  const visible = rows.filter((r) => r.is_active && r.lifecycle_status === "ACTIVE" && isPubliclyListable(r.verification_status));

  it("shows only the active, current, publicly listable event", () => {
    expect(visible.map((r) => r.id)).toEqual(["a"]);
  });
});
