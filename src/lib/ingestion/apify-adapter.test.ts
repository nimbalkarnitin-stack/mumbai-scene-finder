import { describe, expect, it } from "vitest";
import { apifyAdapter } from "./adapters/apify.server";
import { AdapterDisabledError } from "./adapters/types";

const ctx = {
  source: {
    id: "s1",
    slug: "bookmyshow-apify",
    name: "BookMyShow via Apify",
    source_type: "partner_feed" as const,
    adapter_key: "apify",
    base_url: "https://api.apify.com/v2",
    enabled: true,
    authority_level: 3,
    refresh_interval_minutes: 360,
    requires_credentials: true,
    credential_env_keys: ["LOVABLE_API_KEY", "APIFY_API_KEY"],
    config: {} as Record<string, unknown>,
    city_id: null,
  },
  now: new Date("2026-01-01T00:00:00Z"),
  log: () => {},
};

describe("apify adapter", () => {
  it("stays disabled without connector credentials", async () => {
    delete process.env["APIFY_API_KEY"];
    await expect(apifyAdapter.fetch(ctx)).rejects.toBeInstanceOf(AdapterDisabledError);
  });

  it("stays disabled when no actor is configured", async () => {
    process.env["LOVABLE_API_KEY"] = "test";
    process.env["APIFY_API_KEY"] = "test";
    await expect(apifyAdapter.fetch({ ...ctx, source: { ...ctx.source, config: {} } })).rejects.toThrow(/Actor/);
    delete process.env["APIFY_API_KEY"];
  });

  it("skips dataset items with no name", () => {
    expect(apifyAdapter.parse({ raw: { price: 500 }, sourceUrl: null }, ctx)).toBeNull();
  });

  it("only maps facts present in the payload", () => {
    const parsed = apifyAdapter.parse({ raw: { title: "Indie Night", startAt: "2026-02-01T14:30:00Z", venueName: "Antisocial" }, sourceUrl: "https://example.com/e/1" }, ctx);
    expect(parsed).not.toBeNull();
    const rec = apifyAdapter.normalise(parsed!, ctx)!;
    expect(rec.name).toBe("Indie Night");
    expect(rec.startsAt).toBe("2026-02-01T14:30:00.000Z");
    expect(rec.priceMin).toBeNull();
    expect(rec.priceMax).toBeNull();
    expect(rec.endsAt).toBeNull();
    expect(rec.timezone).toBe("Asia/Kolkata");
    expect(rec.confirmed).toEqual({ date: true, price: false, venue: true, location: false });
  });

  it("derives a stable external id and source url", () => {
    const parsed = apifyAdapter.parse({ raw: { name: "Gig", id: "evt-9", url: "https://example.com/e/9" }, sourceUrl: "https://example.com/e/9" }, ctx)!;
    expect(apifyAdapter.getExternalId(parsed, ctx)).toBe("evt-9");
    expect(apifyAdapter.getExternalId(parsed, ctx)).toBe(apifyAdapter.getExternalId(parsed, ctx));
    expect(apifyAdapter.getSourceUrl(parsed, ctx)).toBe("https://example.com/e/9");
    expect(apifyAdapter.getLastModified(parsed, ctx)).toBeNull();
  });
});
