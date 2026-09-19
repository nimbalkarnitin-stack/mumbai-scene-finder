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
  createdAt: string;
}

export interface Recommendation extends SceneItem {
  score: number;
  reasons: string[];
  breakdown: Record<string, number>;
}

export interface SceneQuery {
  city?: string;
  mood?: string;
  group?: string;
  budget?: number;
  timing?: string;
  area?: string;
  category?: string;
  type?: ItemType;
  limit?: number;
  history?: { moods?: string[]; areas?: string[]; categories?: string[] };
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
