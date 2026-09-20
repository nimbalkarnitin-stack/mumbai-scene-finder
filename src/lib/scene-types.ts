import type { OpeningHours } from "./ingestion/venue-profile";

export type ItemType = "venue" | "event" | "experience";

/**
 * Venue profile facts, exactly as a permitted source published them.
 * Every field is nullable: the UI only renders what a source actually stated.
 */
export interface VenueDetails {
  address: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  mapUrl: string | null;
  phone: string | null;
  email: string | null;
  contactUrl: string | null;
  reservationUrl: string | null;
  bookingProvider: string | null;
  reservationsAvailable: boolean | null;
  menuUrl: string | null;
  eventsUrl: string | null;
  socialUrls: Record<string, string>;
  hours: OpeningHours | null;
  specialHours: Record<string, string> | null;
  cuisines: string[];
  dietaryOptions: string[];
  serviceType: string | null;
  amenities: string[];
  dressCode: string | null;
  accessibility: string | null;
  parking: string | null;
  ageRestriction: string | null;
  petPolicy: string | null;
  priceBand: string | null;
  coverCharge: string | null;
  completeness: number | null;
  missingFields: string[];
  geoStatus: string | null;
  lastVerifiedAt: string | null;
}

/**
 * Event-specific facts, exactly as stored from a permitted source.
 * Nullable throughout: the UI renders only what the source published.
 */
export interface EventDetails {
  timezone: string;
  sourceName: string | null;
  organiser: string | null;
  venueName: string | null;
  venueSlug: string | null;
  venueAddress: string | null;
  venueLat: number | null;
  venueLng: number | null;
  venueMapUrl: string | null;
  venueWebsiteUrl: string | null;
}

export interface SceneItem {
  id: string;
  type: ItemType;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  areaSlug: string | null;
  areaName: string | null;
  priceMin: number | null;
  priceMax: number | null;
  moods: string[];
  groupTypes: string[];
  tags: string[];
  bestTimes: string[];
  startsAt: string | null;
  endsAt: string | null;
  scheduleNote: string | null;
  openingHours: Record<string, string> | null;
  bookingUrl: string | null;
  websiteUrl: string | null;
  affiliateLinkId: string | null;
  isSponsored: boolean;
  sponsorName: string | null;
  popularity: number;
  isVerified: boolean;
  /** Where the listing details were checked, when an editor supplied one. */
  sourceUrl: string | null;
  /** Last time the stored record was edited (stand-in for last-checked). */
  updatedAt: string | null;
  createdAt: string;
  /** Present for venues only, and only with the fields a source published. */
  venue?: VenueDetails | null;
  /** Present for events only: sourced schedule/venue/organiser facts. */
  event?: EventDetails | null;
}

export interface Recommendation extends SceneItem {
  score: number;
  reasons: string[];
  breakdown: ScoreBreakdown;
  /** Score before the capped monetisation nudge — kept so ranking stays auditable. */
  relevanceScore?: number;
  monetisation?: { applied: boolean; weight: number; boost: number; reason: string };
}

export interface SceneQuery {
  city?: string | undefined;
  mood?: string | undefined;
  group?: string | undefined;
  budget?: number | undefined;
  timing?: string | undefined;
  area?: string | undefined;
  category?: string | undefined;
  type?: ItemType | undefined;
  limit?: number | undefined;
  history?: { moods?: string[] | undefined; areas?: string[] | undefined; categories?: string[] | undefined } | undefined;
}

export interface ScoreBreakdown {
  preference: number;
  budget: number;
  time: number;
  location: number;
  occasion: number;
  freshness: number;
  popularity: number;
  history: number;
}

export interface ItineraryStop {
  time: string;
  title: string;
  itemId: string | null;
  itemType: ItemType | null;
  area: string | null;
  estimatedCost: number | null;
  note: string;
}
