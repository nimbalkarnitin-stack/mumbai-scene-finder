export type ItemType = "venue" | "event" | "experience";

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
