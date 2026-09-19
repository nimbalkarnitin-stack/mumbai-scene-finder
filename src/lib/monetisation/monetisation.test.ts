import { describe, expect, it } from "vitest";
import { buildTrackedUrl, isPartnerLive, partnerSetupState, type PartnerRecord } from "./partners";
import { buildSubid, canTransition, clickDedupeKey, funnelMetrics, reconcileConversion, type ClickRow } from "./attribution";
import { applyMonetisationSignal, effectiveWeight, monetisationBoost } from "./ranking";
import { DEFAULT_DISCLOSURE, MAX_ALLOWED_MONETISATION_BOOST } from "./types";

const partner = (over: Partial<PartnerRecord> = {}): PartnerRecord => ({
  id: "p1",
  slug: "cuelinks",
  name: "Cuelinks",
  kind: "affiliate_network",
  adapter_key: "cuelinks",
  status: "unconfigured",
  enabled: false,
  base_url: null,
  credential_env_keys: ["CUELINKS_API_TOKEN"],
  capabilities: {},
  config: {},
  disclosure_text: null,
  default_commission_model: null,
  default_commission_rate: null,
  currency: "INR",
  ...over,
});

const DEST = "https://venue.example.com/book?show=42";

describe("disabled partners", () => {
  it("never rewrites a link for an unconfigured partner", () => {
    const link = buildTrackedUrl({ destinationUrl: DEST, subid: "sa-1", partner: partner() });
    expect(link.partnerApplied).toBe(false);
    expect(link.reason).toBe("partner_disabled");
    expect(link.url.startsWith("https://venue.example.com/book")).toBe(true);
  });

  it("does not go live without a deep-link template or subid parameter", () => {
    const link = buildTrackedUrl({ destinationUrl: DEST, subid: "sa-1", partner: partner({ enabled: true, status: "active" }) });
    expect(link.partnerApplied).toBe(false);
    expect(link.reason).toBe("no_template");
    expect(isPartnerLive(partner({ enabled: true, status: "active" }))).toBe(true);
    expect(isPartnerLive(partner({ enabled: true, status: "paused" }))).toBe(false);
  });

  it("reports missing credentials and config without exposing values", () => {
    const state = partnerSetupState(partner(), []);
    expect(state.ready).toBe(false);
    expect(state.missingSecrets).toContain("CUELINKS_API_TOKEN");
    expect(state.missingConfig).toContain("deep_link_template or subid_param");
  });

  it("builds a partner deep link once configured and enabled", () => {
    const p = partner({
      enabled: true,
      status: "active",
      config: { deep_link_template: "https://linksredirect.com/?url={destination}&subid={subid}" },
    });
    const link = buildTrackedUrl({ destinationUrl: DEST, subid: "sa-abc", partner: p });
    expect(link.partnerApplied).toBe(true);
    expect(link.url).toContain(encodeURIComponent(DEST));
    expect(link.url).toContain("subid=sa-abc");
  });

  it("falls back to the destination when the URL is not a public link", () => {
    const link = buildTrackedUrl({ destinationUrl: "not-a-url", subid: "sa-1", partner: partner({ enabled: true, status: "active" }) });
    expect(link.reason).toBe("invalid_destination");
    expect(link.url).toBe("not-a-url");
  });
});

describe("click attribution and idempotency", () => {
  const ctx = {
    destinationUrl: DEST,
    linkKind: "booking" as const,
    partnerSlug: "cuelinks",
    itemType: "event" as const,
    itemId: "e1",
    sessionId: "s1",
  };

  it("gives identical clicks the same dedupe key and subid inside the window", () => {
    const a = new Date("2026-09-19T10:00:00.000Z");
    const b = new Date("2026-09-19T10:09:00.000Z");
    expect(clickDedupeKey(ctx, a)).toBe(clickDedupeKey(ctx, b));
    expect(buildSubid(ctx, a)).toBe(buildSubid(ctx, b));
  });

  it("separates clicks once the dedupe window has passed", () => {
    const a = new Date("2026-09-19T10:00:00.000Z");
    const later = new Date("2026-09-19T11:30:00.000Z");
    expect(clickDedupeKey(ctx, a)).not.toBe(clickDedupeKey(ctx, later));
  });

  it("separates different sessions, listings and destinations", () => {
    const at = new Date("2026-09-19T10:00:00.000Z");
    expect(clickDedupeKey(ctx, at)).not.toBe(clickDedupeKey({ ...ctx, sessionId: "s2" }, at));
    expect(clickDedupeKey(ctx, at)).not.toBe(clickDedupeKey({ ...ctx, itemId: "e2" }, at));
    expect(clickDedupeKey(ctx, at)).not.toBe(clickDedupeKey({ ...ctx, destinationUrl: `${DEST}&x=1` }, at));
  });
});

describe("conversion reconciliation", () => {
  const click: ClickRow = {
    id: "c1",
    subid: "sa-xyz",
    partner_id: "p1",
    offer_id: "o1",
    merchant_partnership_id: null,
    item_type: "event",
    item_id: "e1",
    created_at: "2026-09-19T10:00:00.000Z",
  };
  const report = {
    partnerSlug: "cuelinks",
    externalConversionId: "X-1",
    subid: "sa-xyz",
    orderValue: 1200,
    commissionAmount: 60,
    currency: "INR",
    status: "pending" as const,
    occurredAt: "2026-09-19T12:00:00.000Z",
    raw: {},
  };

  it("matches a conversion to its click and inherits the attribution", () => {
    const r = reconcileConversion(report, [click]);
    expect(r).toMatchObject({ clickId: "c1", reconciliationStatus: "matched", itemId: "e1", offerId: "o1" });
  });

  it("stays unmatched rather than guessing when the subid is unknown", () => {
    expect(reconcileConversion({ ...report, subid: "sa-nope" }, [click]).reconciliationStatus).toBe("unmatched");
    expect(reconcileConversion({ ...report, subid: null }, [click]).clickId).toBe(null);
  });

  it("flags conversions reported outside the attribution window", () => {
    const r = reconcileConversion({ ...report, occurredAt: "2026-12-19T12:00:00.000Z" }, [click]);
    expect(r.reconciliationStatus).toBe("outside_window");
  });

  it("only allows valid commission state transitions", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("approved", "paid")).toBe(true);
    expect(canTransition("paid", "pending")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
  });

  it("derives funnel metrics from stored counts only", () => {
    const m = funnelMetrics({ impressions: 1000, clicks: 50, bookingStarts: 40, conversions: 5, approved: 3, paid: 1, bookingValue: 10000, commission: 500 });
    expect(m.ctr).toBeCloseTo(0.05);
    expect(m.conversionRate).toBeCloseTo(0.1);
    expect(m.epc).toBeCloseTo(10);
    expect(m.averageOrderValue).toBeCloseTo(2000);
    expect(funnelMetrics({ impressions: 0, clicks: 0, bookingStarts: 0, conversions: 0, approved: 0, paid: 0, bookingValue: 0, commission: 0 }).ctr).toBe(0);
  });
});

describe("relevance-first ranking", () => {
  it("caps the monetisation boost however the settings are configured", () => {
    expect(effectiveWeight({ enabled: true, weight: 0.9, max_boost: 0.9 }).weight).toBeLessThanOrEqual(MAX_ALLOWED_MONETISATION_BOOST);
    expect(monetisationBoost({ hasPartnerLink: true, hasDirectPartnership: true }, { weight: 1, max_boost: 1 }).boost).toBeLessThanOrEqual(MAX_ALLOWED_MONETISATION_BOOST);
  });

  it("applies nothing when there is no monetised link", () => {
    const audit = monetisationBoost({ hasPartnerLink: false, hasDirectPartnership: false });
    expect(audit.applied).toBe(false);
    expect(audit.boost).toBe(0);
  });

  it("never lets a monetised listing outrank a clearly more relevant one", () => {
    const items = [
      { id: "relevant", score: 0.8, isSponsored: false },
      { id: "monetised", score: 0.74, isSponsored: false },
    ];
    const ranked = applyMonetisationSignal(items, (i) => ({ hasPartnerLink: i.id === "monetised", hasDirectPartnership: i.id === "monetised" }));
    expect(ranked[0]!.item.id).toBe("relevant");
    expect(ranked[1]!.monetisation.applied).toBe(true);
    // the pre-boost score stays available for auditing
    expect(ranked[1]!.relevanceScore).toBe(0.74);
  });

  it("can only reorder listings that are already near-identical on relevance", () => {
    const items = [
      { id: "a", score: 0.7, isSponsored: false },
      { id: "b", score: 0.699, isSponsored: false },
    ];
    const ranked = applyMonetisationSignal(items, (i) => ({ hasPartnerLink: false, hasDirectPartnership: i.id === "b" }));
    expect(ranked[0]!.item.id).toBe("b");
    expect(ranked[0]!.finalScore - ranked[0]!.relevanceScore).toBeLessThanOrEqual(0.7 * MAX_ALLOWED_MONETISATION_BOOST);
  });

  it("honours a disabled monetisation weight", () => {
    const ranked = applyMonetisationSignal([{ id: "a", score: 0.5, isSponsored: false }], () => ({ hasPartnerLink: true, hasDirectPartnership: true }), { enabled: false });
    expect(ranked[0]!.finalScore).toBe(0.5);
  });
});

describe("disclosure", () => {
  it("ships affiliate and sponsored wording that names the commercial relationship", () => {
    expect(DEFAULT_DISCLOSURE.affiliate.toLowerCase()).toContain("commission");
    expect(DEFAULT_DISCLOSURE.sponsored.toLowerCase()).toContain("sponsored");
    expect(DEFAULT_DISCLOSURE.sponsored.toLowerCase()).toContain("paid");
  });
});
