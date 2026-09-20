import { describe, expect, it } from "vitest";
import { domainMatchesVenueName, inMumbaiBounds, validateMumbaiVenue } from "./mumbai-geo";
import { parseOpeningHours, scoreVenueCompleteness, todayStatus } from "./venue-profile";
import { extractPageContacts, venueProfileFrom } from "./adapters/official-site.server";
import { sanitiseVenueProfile } from "./adapters/shared";
import { canonicalise, detectFieldConflicts, fieldValuesFrom } from "./provenance";
import { buildNormalised } from "./adapters/shared";

describe("Mumbai geography validation", () => {
  it("accepts a venue whose address names a Mumbai locality", () => {
    const v = validateMumbaiVenue({ name: "Some Bar", address: "Linking Road, Bandra West, Mumbai 400050", lat: 19.06, lng: 72.83 });
    expect(v.status).toBe("VALID");
  });

  it("rejects the Dubai record that leaked into the catalogue", () => {
    const v = validateMumbaiVenue({ name: "Trèsind Dubai", address: "Voco Hotel, Sheikh Zayed Road", lat: null, lng: null });
    expect(v.status).toBe("OUT_OF_REGION");
    expect(v.reasons.join(" ")).toMatch(/dubai|sheikh zayed/i);
  });

  it("rejects New York coordinates", () => {
    const v = validateMumbaiVenue({ name: "Prasad Food Divine", address: "123 Culinary Street", lat: 40.7128, lng: -74.006 });
    expect(v.status).toBe("OUT_OF_REGION");
  });

  it("flags an address/coordinate mismatch for review instead of publishing it", () => {
    const v = validateMumbaiVenue({ name: "X", address: "Colaba, Mumbai", lat: 12.97, lng: 77.59 });
    expect(v.status).toBe("UNVERIFIED");
  });

  it("stays UNVERIFIED when nothing confirms a location", () => {
    expect(validateMumbaiVenue({ name: "Nameless", address: null, lat: null, lng: null }).status).toBe("UNVERIFIED");
  });

  it("knows the Mumbai bounding envelope", () => {
    expect(inMumbaiBounds(19.076, 72.8777)).toBe(true);
    expect(inMumbaiBounds(28.61, 77.2)).toBe(false);
    expect(inMumbaiBounds(null, null)).toBe(false);
  });

  it("checks an official domain against the venue name", () => {
    expect(domainMatchesVenueName("Antisocial", "https://antisocial.in/mumbai")).toBe(true);
    expect(domainMatchesVenueName("Antisocial", "https://randomblog.example.com")).toBe(false);
  });
});

describe("opening hours", () => {
  it("parses schema.org openingHoursSpecification", () => {
    const hours = parseOpeningHours([
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday"], opens: "12:00", closes: "23:30" },
    ]);
    expect(hours).toEqual({ mon: "12:00–23:30", tue: "12:00–23:30" });
  });

  it("parses the compact string form with a day range", () => {
    expect(parseOpeningHours("Mo-We 18:00-01:00")).toEqual({ mon: "18:00–01:00", tue: "18:00–01:00", wed: "18:00–01:00" });
  });

  it("drops unparseable hours rather than guessing", () => {
    expect(parseOpeningHours("open till late")).toBeNull();
    expect(parseOpeningHours(null)).toBeNull();
  });

  it("reports open/closed for past-midnight closing times", () => {
    const hours = { fri: "18:00–02:00" } as const;
    const friday2330 = new Date("2026-01-02T18:00:00Z"); // 23:30 IST Friday
    expect(todayStatus(hours, friday2330).open).toBe(true);
    const friday1000 = new Date("2026-01-02T04:30:00Z"); // 10:00 IST Friday
    expect(todayStatus(hours, friday1000).open).toBe(false);
  });

  it("returns open: null when no hours are stored", () => {
    expect(todayStatus(null).open).toBeNull();
  });
});

describe("official-site venue extraction", () => {
  const html = `
    <a href="tel:+91 22 2202 0000">Call us</a>
    <a href="mailto:hello@example.in">Email</a>
    <a href="/book-a-table">Reserve</a>
    <a href="/our-menu">Menu</a>
    <a href="/whats-on">What's on</a>
    <a href="/contact">Contact</a>
    <a href="https://www.instagram.com/example">Instagram</a>
    <a href="javascript:void(0)">Nope</a>`;

  it("reads only the contact links the page itself publishes", () => {
    const c = extractPageContacts(html, "https://example.in/venue");
    expect(c.phone).toBe("+912222020000");
    expect(c.email).toBe("hello@example.in");
    expect(c.reservationUrl).toBe("https://example.in/book-a-table");
    expect(c.menuUrl).toBe("https://example.in/our-menu");
    expect(c.eventsUrl).toBe("https://example.in/whats-on");
    expect(c.contactUrl).toBe("https://example.in/contact");
    expect(c.socialUrls["instagram"]).toBe("https://www.instagram.com/example");
  });

  it("invents nothing when the page publishes nothing", () => {
    const c = extractPageContacts("<p>Welcome</p>", "https://example.in/");
    expect(c).toMatchObject({ phone: null, email: null, reservationUrl: null, menuUrl: null, eventsUrl: null });
  });

  it("builds a venue profile from published structured data only", () => {
    const profile = venueProfileFrom(
      {
        name: "Test Restaurant",
        telephone: "+91 22 1234 5678",
        servesCuisine: ["North Indian", "Continental"],
        priceRange: "₹₹₹",
        address: { addressLocality: "Bandra West" },
        openingHoursSpecification: [{ dayOfWeek: "Saturday", opens: "12:00", closes: "23:00" }],
        acceptsReservations: "True",
        amenityFeature: [{ name: "Outdoor seating" }],
        sameAs: ["https://www.facebook.com/test"],
        __contacts: {},
      },
      "Restaurant",
    );
    expect(profile?.phone).toBe("+91 22 1234 5678");
    expect(profile?.cuisines).toEqual(["North Indian", "Continental"]);
    expect(profile?.openingHours).toEqual({ sat: "12:00–23:00" });
    expect(profile?.reservationsAvailable).toBe(true);
    expect(profile?.serviceType).toBe("Restaurant");
    expect(profile?.amenities).toEqual(["Outdoor seating"]);
    expect(profile?.socialUrls?.["facebook"]).toBe("https://www.facebook.com/test");
    expect(profile?.dressCode ?? null).toBeNull();
  });

  it("sanitises a profile and rejects unsafe values", () => {
    const p = sanitiseVenueProfile({ phone: "+91 22 1234 5678", email: "not-an-email", menuUrl: "javascript:alert(1)", cuisines: ["Thai"] });
    expect(p?.email).toBeNull();
    expect(p?.menuUrl).toBeNull();
    expect(p?.cuisines).toEqual(["Thai"]);
  });

  it("returns null for an entirely empty profile", () => {
    expect(sanitiseVenueProfile({})).toBeNull();
    expect(sanitiseVenueProfile(null)).toBeNull();
  });
});

describe("venue completeness", () => {
  it("scores an empty venue low and names the missing fields", () => {
    const r = scoreVenueCompleteness({ name: "Bare venue" });
    expect(r.score).toBeLessThan(20);
    expect(r.missing).toContain("opening_hours");
    expect(r.missing).toContain("phone");
  });

  it("scores a fully published venue near 100", () => {
    const r = scoreVenueCompleteness({
      name: "Full venue", address: "Bandra West, Mumbai", lat: 19.06, lng: 72.83, locality: "Bandra West",
      website_url: "https://x.in", source_url: "https://x.in", phone: "+912200", email: "a@x.in",
      opening_hours: { mon: "12:00–23:00" }, reservation_url: "https://x.in/book", menu_url: "https://x.in/menu",
      price_min: 800, description: "A place", category_id: "cat", service_type: "Bar", cuisines: ["Indian"],
      moods: ["party"], group_types: ["friends"], tags: ["rooftop"], image_url: "https://x.in/i.jpg",
      source_last_checked_at: new Date().toISOString(), verification_status: "VERIFIED",
    });
    expect(r.score).toBeGreaterThan(95);
    expect(r.missing).toEqual([]);
  });

  it("is deterministic and idempotent", () => {
    const row = { name: "A", address: "Mumbai", phone: "+912200" };
    expect(scoreVenueCompleteness(row)).toEqual(scoreVenueCompleteness(row));
  });
});

describe("venue provenance", () => {
  const record = buildNormalised({
    kind: "venue",
    name: "Venue A",
    address: "Bandra West, Mumbai",
    lat: 19.06,
    lng: 72.83,
    websiteUrl: "https://a.in",
    venue: { phone: "+91 22 1234 5678", openingHours: { mon: "12:00–23:00" }, menuUrl: "https://a.in/menu" },
  });

  it("records the venue fields the source stated", () => {
    const values = fieldValuesFrom(record);
    expect(values.address).toBe("Bandra West, Mumbai");
    expect(values.coordinates).toBe("19.06,72.83");
    expect(values.phone).toBe("+91 22 1234 5678");
    expect(values.opening_hours).toContain("12:00");
    expect(values.reservation_url).toBeNull();
  });

  it("treats formatting-only phone differences as agreement", () => {
    expect(canonicalise("phone", "+91 22 1234 5678")).toBe(canonicalise("phone", "022-1234 5678"));
  });

  it("flags two different published addresses as a conflict", () => {
    const conflicts = detectFieldConflicts([
      { field: "address", value: "1 Hill Road, Bandra", sourceName: "official", sourceType: "official_site", sourceUrl: null, authorityLevel: 5, sourceRecordId: null, observedAt: new Date().toISOString() },
      { field: "address", value: "9 Turner Road, Bandra", sourceName: "partner", sourceType: "partner_feed", sourceUrl: null, authorityLevel: 3, sourceRecordId: null, observedAt: new Date().toISOString() },
    ]);
    expect(conflicts.map((c) => c.field)).toContain("address");
  });

  it("never treats a silent source as a conflict", () => {
    const conflicts = detectFieldConflicts([
      { field: "phone", value: "+912212345678", sourceName: "official", sourceType: "official_site", sourceUrl: null, authorityLevel: 5, sourceRecordId: null, observedAt: new Date().toISOString() },
      { field: "phone", value: null, sourceName: "partner", sourceType: "partner_feed", sourceUrl: null, authorityLevel: 3, sourceRecordId: null, observedAt: new Date().toISOString() },
    ]);
    expect(conflicts).toEqual([]);
  });
});
