import { MOODS } from "../scene-constants";
import type { NormalisedRecord } from "./types";

const MOOD_IDS = MOODS.map((m) => m.id);
const GROUP_IDS = ["solo", "couple", "friends", "family"];
const OCCASIONS = ["date-night", "birthday", "after-work", "weekend-brunch", "girls-night", "family-outing", "solo-recharge", "big-night-out"];
const CATEGORIES = ["events", "restaurants", "cafes", "nightlife", "live-music", "comedy", "experiences"];

export interface Enrichment {
  categoryHint: string | null;
  moodTags: string[];
  occasionTags: string[];
  groupTags: string[];
  areaHint: string | null;
  priceBand: "budget" | "mid" | "premium" | null;
  language: string | null;
  ageMin: number | null;
  shortDescription: string | null;
  keywords: string[];
  /** true when the model/heuristics could not classify confidently → route to review. */
  needsReview: boolean;
}

const KEYWORD_MAP: { match: RegExp; category: string; moods: string[] }[] = [
  { match: /\b(gig|band|concert|live music|acoustic|dj set|indie)\b/i, category: "live-music", moods: ["live-music", "party"] },
  { match: /\b(stand[- ]?up|comedy|open mic|improv)\b/i, category: "comedy", moods: ["comedy"] },
  { match: /\b(club|nightclub|party|rooftop bar|cocktail|pub)\b/i, category: "nightlife", moods: ["party"] },
  { match: /\b(cafe|coffee|bakery|brunch)\b/i, category: "cafes", moods: ["chill"] },
  { match: /\b(restaurant|dining|kitchen|bistro|thali|tasting menu)\b/i, category: "restaurants", moods: ["food"] },
  { match: /\b(workshop|pottery|trek|walk|kayak|sailing|cycling|heritage tour)\b/i, category: "experiences", moods: ["outdoors", "something-new"] },
];

/** Deterministic fallback: tags only from words the source actually used. */
export function heuristicEnrichment(rec: NormalisedRecord): Enrichment {
  const text = `${rec.name} ${rec.description ?? ""} ${rec.categoryHint ?? ""}`.toLowerCase();
  const hit = KEYWORD_MAP.find((k) => k.match.test(text));
  const priceBand = rec.priceMin === null ? null : rec.priceMin <= 800 ? "budget" : rec.priceMin <= 2500 ? "mid" : "premium";
  return {
    categoryHint: hit?.category ?? (rec.kind === "event" ? "events" : null),
    moodTags: hit?.moods ?? [],
    occasionTags: [],
    groupTags: [],
    areaHint: rec.areaHint,
    priceBand,
    language: rec.language,
    ageMin: rec.ageMin,
    shortDescription: rec.description ? rec.description.slice(0, 220) : null,
    keywords: [],
    needsReview: !hit,
  };
}

const SYSTEM = `You classify Mumbai nightlife/culture listings for a discovery app.
You ONLY categorise text that is given to you. Absolute rules:
- NEVER invent or guess prices, dates, times, venue names, addresses, capacities, booking availability or features.
- Only use the taxonomy values provided. If the text does not clearly support a value, omit it.
- If you cannot classify the listing confidently, set needs_review to true.
Return JSON only.`;

/**
 * AI enrichment for taxonomy mapping only (category / moods / occasions / groups / keywords).
 * Falls back to deterministic keyword matching when the AI gateway is unavailable.
 * Factual fields are never produced here.
 */
export async function enrichRecord(rec: NormalisedRecord): Promise<Enrichment> {
  const fallback = heuristicEnrichment(rec);
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || (!rec.description && !rec.name)) return fallback;

  const payload = {
    model: "openai/gpt-6-astra",
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          taxonomy: { categories: CATEGORIES, moods: MOOD_IDS, occasions: OCCASIONS, groups: GROUP_IDS },
          listing: {
            kind: rec.kind,
            name: rec.name,
            description: rec.description,
            category_hint: rec.categoryHint,
            area_hint: rec.areaHint,
            price_min: rec.priceMin,
            language: rec.language,
            source_text: rec.sourceText?.slice(0, 1500) ?? null,
          },
          response_shape: {
            category: "one of categories or null",
            mood_tags: "subset of moods",
            occasion_tags: "subset of occasions",
            group_tags: "subset of groups",
            area: "area name mentioned in the text or null",
            language: "language mentioned or null",
            age_min: "number stated in the text or null",
            short_description: "<=220 chars, rewritten only from the given text",
            keywords: "up to 8 search keywords from the text",
            needs_review: "true if unsure",
          },
        }),
      },
    ],
    response_format: { type: "json_object" as const },
  };

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "Lovable-API-Key": apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const out = JSON.parse(content) as Record<string, unknown>;
    const pick = (value: unknown, allowed: string[]) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && allowed.includes(v)).slice(0, 6) : [];
    const category = typeof out["category"] === "string" && CATEGORIES.includes(out["category"]) ? out["category"] : fallback.categoryHint;
    const shortDescription = typeof out["short_description"] === "string" ? out["short_description"].slice(0, 220) : fallback.shortDescription;
    return {
      categoryHint: category,
      moodTags: pick(out["mood_tags"], MOOD_IDS as unknown as string[]),
      occasionTags: pick(out["occasion_tags"], OCCASIONS),
      groupTags: pick(out["group_tags"], GROUP_IDS),
      areaHint: typeof out["area"] === "string" ? out["area"] : rec.areaHint,
      priceBand: fallback.priceBand,
      language: typeof out["language"] === "string" ? out["language"] : rec.language,
      // Ages/prices/dates are only ever taken from the source record, never from the model.
      ageMin: rec.ageMin,
      shortDescription,
      keywords: Array.isArray(out["keywords"]) ? out["keywords"].filter((k): k is string => typeof k === "string").slice(0, 8) : [],
      needsReview: out["needs_review"] === true || !category,
    };
  } catch {
    return fallback;
  }
}
