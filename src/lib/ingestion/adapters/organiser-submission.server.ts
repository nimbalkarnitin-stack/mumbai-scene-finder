import { buildNormalised, isoOrNull, numberOrNull } from "./shared";
import { firstString } from "./shared";
import type { ParsedItem, RawItem, SourceAdapter } from "./types";

/**
 * Organiser / venue submissions.
 * Nothing is fetched: rows are written straight into source_records by the submission
 * server function, then normalised and always routed to human review before publishing.
 */
export const organiserSubmissionAdapter: SourceAdapter = {
  key: "organiser_submission",
  requiredEnv: [],

  async fetch(): Promise<RawItem[]> {
    return [];
  },

  parse(item) {
    const name = firstString((item.raw as Record<string, unknown>)["name"]);
    if (!name) return null;
    return { ...item.raw, name, __sourceUrl: item.sourceUrl } satisfies ParsedItem;
  },

  normalise(parsed) {
    const startsAt = isoOrNull(parsed["starts_at"] ?? parsed["startsAt"]);
    const priceMin = numberOrNull(parsed["price_min"] ?? parsed["priceMin"]);
    return buildNormalised({
      kind: (parsed["kind"] as "event" | "venue" | "experience") ?? "event",
      name: String(parsed["name"]),
      description: firstString(parsed["description"]),
      startsAt,
      endsAt: isoOrNull(parsed["ends_at"] ?? parsed["endsAt"]),
      priceMin,
      priceMax: numberOrNull(parsed["price_max"] ?? parsed["priceMax"]),
      venueName: firstString(parsed["venue_name"] ?? parsed["venueName"]),
      areaHint: firstString(parsed["area"]),
      address: firstString(parsed["address"]),
      imageUrl: firstString(parsed["image_url"] ?? parsed["imageUrl"]),
      bookingUrl: firstString(parsed["booking_url"] ?? parsed["bookingUrl"]),
      websiteUrl: firstString(parsed["website_url"] ?? parsed["websiteUrl"], parsed["__sourceUrl"]),
      categoryHint: firstString(parsed["category"]),
      language: firstString(parsed["language"]),
      ageMin: numberOrNull(parsed["age_min"] ?? parsed["ageMin"]),
      organiser: firstString(parsed["organiser"] ?? parsed["organizer"]),
      confirmed: {
        date: !!startsAt,
        price: priceMin !== null,
        venue: !!firstString(parsed["venue_name"] ?? parsed["venueName"]),
        location: !!firstString(parsed["address"]),
      },
      sourceText: firstString(parsed["description"]),
    });
  },

  getExternalId(parsed) {
    return String(parsed["submission_id"] ?? `${String(parsed["name"])}#${String(parsed["starts_at"] ?? "")}`).slice(0, 300);
  },

  getSourceUrl(parsed) {
    return firstString(parsed["source_url"] ?? parsed["__sourceUrl"]);
  },

  getLastModified(parsed) {
    return isoOrNull(parsed["updated_at"]);
  },
};
