import { withRetry } from "../safe-fetch.server";
import { buildNormalised, firstString, isoOrNull, numberOrNull } from "./shared";
import { AdapterDisabledError, missingEnv, type AdapterContext, type ParsedItem, type RawItem, type SourceAdapter } from "./types";

const ENV = ["LOVABLE_API_KEY", "APIFY_API_KEY"];
const GATEWAY_URL = "https://connector-gateway.lovable.dev/apify";

interface ApifyConfig {
  actor_id?: unknown;
  actor_input?: unknown;
  run_timeout_seconds?: unknown;
  max_items?: unknown;
  page_size?: unknown;
  dataset_id?: unknown;
}

function gatewayHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "x-connection-api-key": process.env["APIFY_API_KEY"]!,
    "content-type": "application/json",
  };
}

async function gatewayFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers: { ...gatewayHeaders(), ...(init.headers as Record<string, string>) }, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[apify] ${init.method ?? "GET"} ${path} failed [${res.status}]: ${text.slice(0, 600)}`);
      const err = new Error(`Apify request failed [${res.status}]: ${text.slice(0, 400)}`);
      // Mark 4xx as non-transient so retries stop immediately.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) (err as Error & { permanent?: boolean }).permanent = true;
      throw err;
    }
    return text ? (JSON.parse(text) as unknown) : null;
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Apify adapter. Runs an explicitly configured Apify Actor through the Lovable connector
 * gateway and reads its dataset items. Credentials live only in the server environment
 * (LOVABLE_API_KEY + the connector's APIFY_API_KEY). With no connector or no configured
 * actor_id the adapter stays disabled — it never guesses an Actor, and it only maps fields
 * that are literally present in the returned payload.
 */
export const apifyAdapter: SourceAdapter = {
  key: "apify",
  requiredEnv: ENV,

  async fetch(ctx: AdapterContext): Promise<RawItem[]> {
    const missing = missingEnv(ENV);
    if (missing.length > 0) {
      throw new AdapterDisabledError(
        `Apify access is not configured. Connect the Apify connector to this project so ${missing.join(", ")} are available.`,
      );
    }
    const cfg = ctx.source.config as ApifyConfig;
    const actorId = typeof cfg.actor_id === "string" && cfg.actor_id.trim() ? cfg.actor_id.trim() : null;
    const datasetId = typeof cfg.dataset_id === "string" && cfg.dataset_id.trim() ? cfg.dataset_id.trim() : null;
    if (!actorId && !datasetId) {
      throw new AdapterDisabledError("No Apify Actor configured. Set config.actor_id (owner~actor-name) on this source before enabling it.");
    }

    const pageSize = Math.min(Math.max(numberOrNull(cfg.page_size) ?? 200, 25), 1000);
    const maxItems = Math.min(Math.max(numberOrNull(cfg.max_items) ?? 500, 1), 5000);
    const timeoutSeconds = Math.min(Math.max(numberOrNull(cfg.run_timeout_seconds) ?? 180, 30), 540);

    let resolvedDataset = datasetId;

    if (actorId) {
      const input = asRecord(cfg.actor_input);
      const started = asRecord(
        await withRetry(() =>
          gatewayFetch(`/acts/${encodeURIComponent(actorId)}/runs`, { method: "POST", body: JSON.stringify(input), timeoutMs: 30_000 }),
        ),
      );
      const run = asRecord(started["data"]);
      const runId = typeof run["id"] === "string" ? run["id"] : null;
      if (!runId) throw new Error("Apify did not return a run id.");
      ctx.log(`Apify run ${runId} started for actor ${actorId}.`);

      const deadline = Date.now() + timeoutSeconds * 1000;
      let status = typeof run["status"] === "string" ? run["status"] : "READY";
      let dataset = typeof run["defaultDatasetId"] === "string" ? run["defaultDatasetId"] : null;
      while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
        if (Date.now() > deadline) throw new Error(`Apify run ${runId} did not finish within ${timeoutSeconds}s (status ${status}).`);
        await new Promise((r) => setTimeout(r, 5000));
        const polled = asRecord(asRecord(await gatewayFetch(`/actor-runs/${runId}`, { timeoutMs: 20_000 }))["data"]);
        status = typeof polled["status"] === "string" ? polled["status"] : status;
        dataset = typeof polled["defaultDatasetId"] === "string" ? polled["defaultDatasetId"] : dataset;
      }
      if (status !== "SUCCEEDED") throw new Error(`Apify run ${runId} ended with status ${status}.`);
      resolvedDataset = dataset;
      if (!resolvedDataset) throw new Error(`Apify run ${runId} exposed no dataset.`);
      ctx.log(`Apify run ${runId} succeeded; reading dataset ${resolvedDataset}.`);
    }

    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    while (rows.length < maxItems) {
      const limit = Math.min(pageSize, maxItems - rows.length);
      const page = await withRetry(() => gatewayFetch(`/datasets/${resolvedDataset}/items?clean=true&limit=${limit}&offset=${offset}`, { timeoutMs: 30_000 }));
      const list = Array.isArray(page) ? page : Array.isArray(asRecord(page)["items"]) ? (asRecord(page)["items"] as unknown[]) : [];
      const batch = list.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
      rows.push(...batch);
      if (batch.length < limit) break;
      offset += batch.length;
    }
    ctx.log(`Apify dataset ${resolvedDataset} returned ${rows.length} items.`);
    return rows.map((raw) => ({ raw, sourceUrl: firstString(raw["url"], raw["eventUrl"], raw["bookingUrl"], raw["link"]) }));
  },

  parse(item) {
    const name = firstString(item.raw["name"], item.raw["title"], item.raw["eventName"], item.raw["event_name"]);
    if (!name) return null;
    return { ...item.raw, name, __sourceUrl: item.sourceUrl } satisfies ParsedItem;
  },

  normalise(parsed) {
    const startsAt = isoOrNull(parsed["startAt"] ?? parsed["start_at"] ?? parsed["startTime"] ?? parsed["startDate"] ?? parsed["eventDate"]);
    const priceMin = numberOrNull(parsed["priceMin"] ?? parsed["price_min"] ?? parsed["minPrice"] ?? parsed["price"]);
    const venue = asRecord(parsed["venue"]);
    const venueName = firstString(parsed["venueName"], parsed["venue_name"], venue["name"], typeof parsed["venue"] === "string" ? parsed["venue"] : null);
    const address = firstString(parsed["venueAddress"], parsed["address"], venue["address"]);
    const lat = numberOrNull(parsed["latitude"] ?? parsed["lat"]);
    const lng = numberOrNull(parsed["longitude"] ?? parsed["lng"]);
    return buildNormalised({
      kind: startsAt ? "event" : "venue",
      name: String(parsed["name"]),
      description: firstString(parsed["description"], parsed["synopsis"], parsed["about"]),
      startsAt,
      endsAt: isoOrNull(parsed["endAt"] ?? parsed["end_at"] ?? parsed["endTime"] ?? parsed["endDate"]),
      priceMin,
      priceMax: numberOrNull(parsed["priceMax"] ?? parsed["price_max"] ?? parsed["maxPrice"]),
      currency: firstString(parsed["currency"]) ?? "INR",
      venueName,
      areaHint: firstString(parsed["area"], parsed["subRegion"], parsed["locality"], parsed["neighbourhood"]),
      address,
      lat,
      lng,
      imageUrl: firstString(parsed["imageUrl"], parsed["image"], parsed["thumbnail"]),
      bookingUrl: firstString(parsed["bookingUrl"], parsed["ticketUrl"], parsed["url"], parsed["__sourceUrl"]),
      websiteUrl: firstString(parsed["websiteUrl"], parsed["website"]),
      categoryHint: firstString(parsed["category"], parsed["genre"], parsed["type"]),
      language: firstString(parsed["language"]),
      ageMin: numberOrNull(parsed["ageMin"] ?? parsed["minAge"]),
      organiser: firstString(parsed["organiser"], parsed["organizer"], parsed["promoter"]),
      confirmed: {
        date: !!startsAt,
        price: priceMin !== null,
        venue: !!venueName,
        location: !!address || lat !== null,
      },
      sourceText: firstString(parsed["description"], parsed["synopsis"]),
    });
  },

  getExternalId(parsed) {
    return String(
      firstString(parsed["externalId"], parsed["eventCode"], parsed["id"], parsed["bookingUrl"], parsed["url"]) ??
        `${String(parsed["name"])}#${String(parsed["startAt"] ?? parsed["startTime"] ?? "")}`,
    ).slice(0, 300);
  },

  getSourceUrl(parsed) {
    return firstString(parsed["url"], parsed["eventUrl"], parsed["bookingUrl"], parsed["__sourceUrl"]);
  },

  getLastModified(parsed) {
    return isoOrNull(parsed["updatedAt"] ?? parsed["modifiedAt"] ?? parsed["scrapedAt"] ?? parsed["lastModified"]);
  },
};
