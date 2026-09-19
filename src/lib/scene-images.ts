import liveMusic from "@/assets/cat-live-music.jpg";
import comedy from "@/assets/cat-comedy.jpg";
import cafe from "@/assets/cat-cafe.jpg";
import restaurant from "@/assets/cat-restaurant.jpg";
import nightlife from "@/assets/cat-nightlife.jpg";
import outdoors from "@/assets/cat-outdoors.jpg";
import experience from "@/assets/cat-experience.jpg";
import arts from "@/assets/cat-arts.jpg";
import hero from "@/assets/hero-mumbai.jpg";

export const HERO_IMAGE = hero;

export const CATEGORY_IMAGES: Record<string, string> = {
  "live-music": liveMusic,
  comedy,
  cafes: cafe,
  restaurants: restaurant,
  nightlife,
  outdoors,
  experiences: experience,
  "arts-culture": arts,
  events: liveMusic,
};

export function itemImage(item: { imageUrl: string | null; categorySlug: string | null }) {
  return item.imageUrl ?? CATEGORY_IMAGES[item.categorySlug ?? ""] ?? hero;
}
