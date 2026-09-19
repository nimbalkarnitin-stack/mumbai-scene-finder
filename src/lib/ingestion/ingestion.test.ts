import { describe, expect, it } from "vitest";
import { istDayBounds, istDayKey, istLocalToUtcIso, istTonightWindow, istWeekendWindow, utcIsoToIstLocal } from "./timezone";
import { isSafeExternalUrl, sanitiseText } from "./url-guard";
import { computeQualityScore, nextRefreshAt, passesPublishGate, verificationStateFor } from "./quality";
import { compareRecords, duplicateConfidenceFrom, similarity } from "./dedupe";
import { isTransient, withRetry } from "./safe-fetch.server";
import { DEFAULT_CADENCE, DEFAULT_GATE, DEFAULT_WEIGHTS } from "./types";
import { sha256Hex } from "./adapters/shared";

describe("Asia/Kolkata timezone handling", () => {
  it("treats a wall-clock Mumbai time as IST (+05:30)", () => {
    expect(istLocalToUtcIso("2026-09-19T20:30")).toBe("2026-09-19T15:00:00.000Z");
  });

  it("round-trips back to the same wall-clock value", () => {
    const utc = istLocalToUtcIso("2026-01-02T09:05")!;
    expect(utcIsoToIstLocal(utc)).toBe("2026-01-02T09:05");
  });

  it("keeps late-night instants on the correct IST day", () => {
    // 19:00 UTC on 19 Sep is 00:30 IST on 20 Sep.
    expect(istDayKey("2026-09-19T19:00:00.000Z")).toBe("2026-09-20");
  });

  it("bounds an IST day at local midnight", () => {
    expect(istDayBounds("2026-09-19")).toEqual({ start: "2026-09-18T18:30:00.000Z", end: "2026-09-19T18:30:00.000Z" });
  });

  it("runs tonight until 04:00 IST the next morning", () => {
    const w = istTonightWindow(new Date("2026-09-19T16:00:00.000Z")); // 21:30 IST
    expect(w.end).toBe("2026-09-19T22:30:00.000Z"); // 04:00 IST on 20 Sep
  });

  it("returns the Sat–Mon IST weekend window", () => {
    const w = istWeekendWindow(new Date("2026-09-16T06:00:00.000Z")); // Wed
    expect(w.start).toBe("2026-09-18T18:30:00.000Z"); // Sat 00:00 IST
    expect(new Date(w.end).getTime() - new Date(w.start).getTime()).toBe(2 * 86400000);
  });

  it("returns null for unparseable input rather than guessing", () => {
    expect(istLocalToUtcIso("not a date")).toBeNull();
    expect(utcIsoToIstLocal(null)).toBe("");
  });
});

describe("URL validation / SSRF guard", () => {
  it("accepts public https URLs", () => {
    expect(isSafeExternalUrl("https://venue.example.com/events")).toBe(true);
  });

  it("rejects non-http protocols", () => {
    for (const u of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "ftp://example.com/x"]) {
      expect(isSafeExternalUrl(u)).toBe(false);
    }
  });

  it("rejects localhost, link-local and private ranges", () => {
    for (const u of [
      "http://localhost:8080/x",
      "http://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data",
      "http://10.1.2.3/x",
      "http://192.168.1.10/x",
      "http://172.16.4.5/x",
      "http://[::1]/x",
      "http://metadata.google.internal/x",
    ]) {
      expect(isSafeExternalUrl(u)).toBe(false);
    }
  });

  it("strips markup from imported text", () => {
    const cleaned = sanitiseText("<script>bad()</script>Live jazz <b>tonight</b>") ?? "";
    expect(cleaned).not.toContain("<");
    expect(cleaned).toContain("tonight");
    expect(cleaned).not.toContain("bad()");
  });
});

describe("quality gate and verification states", () => {
  const strong = {
    authorityLevel: 5,
    ageHours: 2,
    dateConfirmed: true,
    priceConfirmed: true,
    venueConfirmed: true,
    locationConfirmed: true,
    duplicateConfidence: 1,
    completeness: 1,
  };

  it("scores a complete, fresh, first-party record above the publish gate", () => {
    const score = computeQualityScore(strong, DEFAULT_WEIGHTS, DEFAULT_GATE);
    expect(score).toBeGreaterThanOrEqual(DEFAULT_GATE.publish_min);
    const state = verificationStateFor(score, strong, DEFAULT_GATE);
    expect(state).toBe("VERIFIED");
    expect(passesPublishGate(score, state, DEFAULT_GATE)).toBe(true);
  });

  it("never publishes a record with no confirmed date", () => {
    const input = { ...strong, dateConfirmed: false };
    const score = computeQualityScore(input, DEFAULT_WEIGHTS, DEFAULT_GATE);
    const state = verificationStateFor(score, input, DEFAULT_GATE);
    expect(state).not.toBe("VERIFIED");
    expect(passesPublishGate(score, state, DEFAULT_GATE)).toBe(false);
  });

  it("marks an old record as stale regardless of score", () => {
    const input = { ...strong, ageHours: DEFAULT_GATE.stale_after_hours + 10 };
    const score = computeQualityScore(input, DEFAULT_WEIGHTS, DEFAULT_GATE);
    expect(verificationStateFor(score, input, DEFAULT_GATE)).toBe("STALE");
  });

  it("holds back a record with an unresolved duplicate", () => {
    const input = { ...strong, duplicateConfidence: 0.5 };
    const score = computeQualityScore(input, DEFAULT_WEIGHTS, DEFAULT_GATE);
    expect(verificationStateFor(score, input, DEFAULT_GATE)).not.toBe("VERIFIED");
  });

  it("sends a thin low-authority record to review, not to the public site", () => {
    const input = { authorityLevel: 1, ageHours: 20, dateConfirmed: true, priceConfirmed: false, venueConfirmed: false, locationConfirmed: false, duplicateConfidence: 0.5, completeness: 0.2 };
    const score = computeQualityScore(input, DEFAULT_WEIGHTS, DEFAULT_GATE);
    const state = verificationStateFor(score, input, DEFAULT_GATE);
    expect(passesPublishGate(score, state, DEFAULT_GATE)).toBe(false);
    expect(["REVIEW_REQUIRED", "UNVERIFIED"]).toContain(state);
  });
});

describe("refresh cadence", () => {
  const now = new Date("2026-09-19T06:00:00.000Z");
  const minutesUntil = (iso: string) => Math.round((new Date(iso).getTime() - now.getTime()) / 60000);

  it("refreshes near-term events most often", () => {
    const soon = nextRefreshAt("event", new Date(now.getTime() + 12 * 3600000).toISOString(), now, DEFAULT_CADENCE);
    expect(minutesUntil(soon)).toBe(DEFAULT_CADENCE.event_lt_48h_minutes);
  });

  it("uses the mid window for events 3–14 days out", () => {
    const mid = nextRefreshAt("event", new Date(now.getTime() + 5 * 86400000).toISOString(), now, DEFAULT_CADENCE);
    expect(minutesUntil(mid)).toBe(DEFAULT_CADENCE.event_3_to_14d_minutes);
  });

  it("uses the far window beyond 14 days and the weekly cadence for venues", () => {
    const far = nextRefreshAt("event", new Date(now.getTime() + 40 * 86400000).toISOString(), now, DEFAULT_CADENCE);
    expect(minutesUntil(far)).toBe(DEFAULT_CADENCE.event_gt_14d_minutes);
    expect(minutesUntil(nextRefreshAt("venue", null, now, DEFAULT_CADENCE))).toBe(DEFAULT_CADENCE.venue_minutes);
  });

  it("is driven by configuration, not hard-coded values", () => {
    const custom = { ...DEFAULT_CADENCE, event_lt_48h_minutes: 45 };
    const soon = nextRefreshAt("event", new Date(now.getTime() + 6 * 3600000).toISOString(), now, custom);
    expect(minutesUntil(soon)).toBe(45);
  });
});

describe("duplicate detection", () => {
  const base = {
    name: "Nucleya Live in Mumbai",
    startsAt: "2026-10-02T15:00:00.000Z",
    venueName: "antisocial",
    organiser: "Only Much Louder",
    description: "Bass night with Nucleya.",
    sourceName: "official-venue-pages",
    externalId: "a",
  };

  it("flags the same event listed by two sources", () => {
    const other = { ...base, sourceName: "partner-feed", externalId: "b", name: "NUCLEYA – Live in Mumbai!", venueName: "AntiSOCIAL", startsAt: "2026-10-02T15:30:00.000Z" };
    const result = compareRecords(base, other);
    expect(result.isCandidate).toBe(true);
    expect(result.score).toBeGreaterThan(0.62);
  });

  it("treats the same source + external id as a deterministic match", () => {
    expect(compareRecords(base, { ...base, name: "Completely different title" }).deterministic).toBe(true);
  });

  it("does not flag different events at the same venue on different nights", () => {
    const other = { ...base, sourceName: "partner-feed", externalId: "c", name: "Comedy Open Mic", startsAt: "2026-10-09T15:00:00.000Z", description: "Stand-up open mic." };
    expect(compareRecords(base, other).isCandidate).toBe(false);
  });

  it("ignores punctuation and casing when comparing names", () => {
    expect(similarity("Nucleya: Live!", "nucleya live")).toBeGreaterThan(0.85);
  });

  it("lowers duplicate confidence as open candidates pile up", () => {
    expect(duplicateConfidenceFrom(0)).toBe(1);
    expect(duplicateConfidenceFrom(3)).toBeLessThan(duplicateConfidenceFrom(1));
  });
});

describe("idempotent ingestion", () => {
  it("produces a stable content hash for unchanged payloads and a new one after an edit", async () => {
    const payload = { name: "Jazz at the pier", startsAt: "2026-10-02T15:00:00.000Z", price: 800 };
    const a = await sha256Hex(JSON.stringify(payload));
    const b = await sha256Hex(JSON.stringify({ ...payload }));
    const c = await sha256Hex(JSON.stringify({ ...payload, price: 900 }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});

describe("event expiry", () => {
  /** Mirrors expireEvents: an event is expired once its end (or start, when no end) has passed. */
  const isExpired = (ev: { startsAt: string; endsAt: string | null }, now: Date) =>
    new Date(ev.endsAt ?? ev.startsAt).getTime() < now.getTime();

  const now = new Date("2026-09-19T18:00:00.000Z"); // 23:30 IST

  it("expires an event that has already ended", () => {
    expect(isExpired({ startsAt: "2026-09-19T14:00:00.000Z", endsAt: "2026-09-19T17:00:00.000Z" }, now)).toBe(true);
  });

  it("keeps an in-progress event live", () => {
    expect(isExpired({ startsAt: "2026-09-19T17:00:00.000Z", endsAt: "2026-09-19T20:00:00.000Z" }, now)).toBe(false);
  });

  it("falls back to the start time when a source gave no end time", () => {
    expect(isExpired({ startsAt: "2026-09-19T17:30:00.000Z", endsAt: null }, now)).toBe(true);
    expect(isExpired({ startsAt: "2026-09-20T17:30:00.000Z", endsAt: null }, now)).toBe(false);
  });
});

describe("transient failures and bounded retry", () => {
  it("classifies network/5xx errors as transient and 404s as permanent", () => {
    expect(isTransient(new Error("fetch failed: ECONNRESET"))).toBe(true);
    expect(isTransient(new Error("Upstream responded 503"))).toBe(true);
    expect(isTransient(new Error("Upstream responded 404"))).toBe(false);
  });

  it("retries a transient failure and then succeeds", async () => {
    let calls = 0;
    const value = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("fetch failed: ETIMEDOUT");
        return "ok";
      },
      { attempts: 4, baseMs: 1 },
    );
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("gives up after the bounded attempt count", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("fetch failed: ECONNRESET");
        },
        { attempts: 2, baseMs: 1 },
      ),
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });
});
