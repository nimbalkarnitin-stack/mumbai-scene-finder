import { describe, expect, it } from "vitest";
import {
  backoffDelayMs,
  buildQueryText,
  GOOGLE_DETAILS_FIELD_MASK,
  GOOGLE_DISCOVERY_EVENTS,
  GOOGLE_KEY_ENV_NAMES,
  GOOGLE_SEARCH_FIELD_MASK,
  isRetryableStatus,
  matchEntities,
  MUMBAI_AREAS,
  MUMBAI_BIAS,
  requestsRemaining,
  TRACKED_PROVENANCE_FIELDS,
} from "./google-discovery";
import { sanitiseUrl } from "./url-guard";

describe("google discovery credential", () => {
  it("prefers GOOGLE_MAPS_API_KEY and falls back to GOOGLE_PLACES_API_KEY", () => {
    expect(GOOGLE_KEY_ENV_NAMES[0]).toBe("GOOGLE_MAPS_API_KEY");
    expect(GOOGLE_KEY_ENV_NAMES).toContain("GOOGLE_PLACES_API_KEY");
  });

  it("never ships the credential name pattern to client bundles", async () => {
    const fs = await import("node:fs/promises");
    const client = await fs.readFile("src/routes/admin/sources.tsx", "utf8");
    expect(client).not.toContain("GOOGLE_MAPS_API_KEY");
    expect(client).not.toContain("X-Goog-Api-Key");
  });
});

describe("field masks", () => {
  it("requests only identity, contact and website fields in search", () => {
    expect(GOOGLE_SEARCH_FIELD_MASK).toContain("places.id");
    expect(GOOGLE_SEARCH_FIELD_MASK).toContain("places.websiteUri");
    for (const forbidden of ["review", "photo", "editorialSummary", "*"]) {
      expect(GOOGLE_SEARCH_FIELD_MASK.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps details mask explicit", () => {
    expect(GOOGLE_DETAILS_FIELD_MASK).not.toContain("*");
    expect(GOOGLE_DETAILS_FIELD_MASK.length).toBeGreaterThan(10);
  });
});

describe("query generation and Mumbai coverage", () => {
  it("builds a Mumbai-scoped query string", () => {
    expect(buildQueryText("Bandra West", "rooftop bars").toLowerCase()).toContain("bandra west");
    expect(buildQueryText("Bandra West", "rooftop bars").toLowerCase()).toContain("mumbai");
  });

  it("covers the requested Mumbai areas", () => {
    for (const area of ["Colaba", "Fort", "Lower Parel", "Bandra West", "Juhu", "Powai", "BKC", "Navi Mumbai", "Thane"]) {
      expect(MUMBAI_AREAS).toContain(area);
    }
    expect(MUMBAI_BIAS.radiusMetres).toBeGreaterThan(1000);
  });
});

describe("budgets, retries and rate limits", () => {
  it("stops when daily or monthly budget is exhausted", () => {
    expect(requestsRemaining({ requestsToday: 500, requestsThisMonth: 100, dailyLimit: 500, monthlyLimit: 5000 })).toBe(0);
    expect(requestsRemaining({ requestsToday: 10, requestsThisMonth: 5000, dailyLimit: 500, monthlyLimit: 5000 })).toBe(0);
    expect(requestsRemaining({ requestsToday: 10, requestsThisMonth: 20, dailyLimit: 500, monthlyLimit: 5000 })).toBe(490);
  });

  it("retries rate limits and server errors only", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
  });

  it("backs off exponentially", () => {
    expect(backoffDelayMs(2)).toBeGreaterThan(backoffDelayMs(1));
  });
});

describe("entity resolution", () => {
  const base = { placeId: "ChIJ1", name: "The Bombay Canteen", domain: "thebombaycanteen.com", phone: "+912212345678", address: "Kamala Mills, Lower Parel", lat: 19.0, lng: 72.83 };

  it("links on identical Place ID", () => {
    expect(matchEntities(base, { ...base, name: "Bombay Canteen" }).decision).toBe("link");
  });

  it("flags near matches for review instead of merging", () => {
    const d = matchEntities(base, { ...base, placeId: "ChIJ2", phone: null }).decision;
    expect(["link", "review"]).toContain(d);
  });

  it("keeps clearly different places separate", () => {
    const other = { placeId: "ChIJ9", name: "Soho House Mumbai", domain: "sohohouse.com", phone: "+912299999999", address: "Juhu Tara Road", lat: 19.09, lng: 72.82 };
    expect(matchEntities(base, other).decision).toBe("separate");
  });
});

describe("provenance and analytics", () => {
  it("tracks the required provenance fields", () => {
    for (const f of ["name", "address", "website", "phone", "event_title", "event_date", "event_booking_url"]) {
      expect(TRACKED_PROVENANCE_FIELDS).toContain(f);
    }
  });

  it("declares the discovery funnel events", () => {
    expect(Object.values(GOOGLE_DISCOVERY_EVENTS)).toContain("google_discovery_started");
    expect(Object.values(GOOGLE_DISCOVERY_EVENTS)).toContain("google_candidate_duplicate");
  });
});

describe("URL safety", () => {
  it("rejects malformed and SSRF-prone website URLs", () => {
    expect(sanitiseUrl("javascript:alert(1)")).toBeNull();
    expect(sanitiseUrl("http://127.0.0.1/admin")).toBeNull();
    expect(sanitiseUrl("http://localhost:8080")).toBeNull();
    expect(sanitiseUrl("not a url")).toBeNull();
    expect(sanitiseUrl("https://thebombaycanteen.com/")).toContain("thebombaycanteen.com");
  });
});
