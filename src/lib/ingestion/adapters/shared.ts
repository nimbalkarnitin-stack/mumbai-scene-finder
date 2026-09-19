import { sanitiseText, sanitiseUrl } from "../url-guard";
import { IST_TZ } from "../timezone";
import type { NormalisedRecord } from "../types";

/** Build a normalised record with safe defaults; every unknown fact stays null. */
export function buildNormalised(partial: Partial<NormalisedRecord> & { kind: NormalisedRecord["kind"]; name: string }): NormalisedRecord {
  const name = sanitiseText(partial.name, 200) ?? "";
  return {
    kind: partial.kind,
    name,
    description: partial.description ? sanitiseText(partial.description) : null,
    startsAt: partial.startsAt ?? null,
    endsAt: partial.endsAt ?? null,
    timezone: partial.timezone ?? IST_TZ,
    priceMin: numberOrNull(partial.priceMin),
    priceMax: numberOrNull(partial.priceMax),
    currency: partial.currency ?? "INR",
    venueName: partial.venueName ? sanitiseText(partial.venueName, 160) : null,
    areaHint: partial.areaHint ? sanitiseText(partial.areaHint, 80) : null,
    address: partial.address ? sanitiseText(partial.address, 300) : null,
    lat: numberOrNull(partial.lat),
    lng: numberOrNull(partial.lng),
    imageUrl: sanitiseUrl(partial.imageUrl ?? null),
    bookingUrl: sanitiseUrl(partial.bookingUrl ?? null),
    websiteUrl: sanitiseUrl(partial.websiteUrl ?? null),
    categoryHint: partial.categoryHint ? sanitiseText(partial.categoryHint, 60) : null,
    language: partial.language ? sanitiseText(partial.language, 40) : null,
    ageMin: numberOrNull(partial.ageMin),
    organiser: partial.organiser ? sanitiseText(partial.organiser, 160) : null,
    moodTags: uniqueSlugs(partial.moodTags),
    occasionTags: uniqueSlugs(partial.occasionTags),
    groupTags: uniqueSlugs(partial.groupTags),
    keywords: uniqueSlugs(partial.keywords),
    confirmed: {
      date: partial.confirmed?.date ?? false,
      price: partial.confirmed?.price ?? false,
      venue: partial.confirmed?.venue ?? false,
      location: partial.confirmed?.location ?? false,
    },
    sourceText: partial.sourceText ? sanitiseText(partial.sourceText, 4000) : null,
  };
}

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function uniqueSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string") continue;
    const slug = v.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (slug) out.add(slug);
  }
  return [...out].slice(0, 12);
}

/** Only accept an ISO-parseable date the source actually stated. */
export function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extract JSON-LD blocks from an HTML page (structured data that publishers expose on purpose). */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const body = match[1];
    if (!body) continue;
    try {
      const parsed: unknown = JSON.parse(body.trim());
      const push = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(push);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(push);
        else out.push(obj);
      };
      push(parsed);
    } catch {
      // ignore malformed blocks — never guess at their contents
    }
  }
  return out;
}

export function jsonLdType(node: Record<string, unknown>): string {
  const t = node["@type"];
  if (typeof t === "string") return t;
  if (Array.isArray(t) && typeof t[0] === "string") return t[0];
  return "";
}

export function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return null;
}
