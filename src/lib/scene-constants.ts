export const DEFAULT_CITY_SLUG = "mumbai";
export const DEFAULT_CITY_ID = "11111111-1111-1111-1111-111111111111";

export const MOODS = [
  { id: "party", label: "Party", emoji: "🪩" },
  { id: "romantic", label: "Romantic", emoji: "🌹" },
  { id: "live-music", label: "Live Music", emoji: "🎸" },
  { id: "comedy", label: "Comedy", emoji: "🎤" },
  { id: "food", label: "Food", emoji: "🍛" },
  { id: "outdoors", label: "Outdoors", emoji: "🌊" },
  { id: "chill", label: "Chill", emoji: "☕" },
  { id: "something-new", label: "Something New", emoji: "✨" },
] as const;

export const GROUPS = [
  { id: "solo", label: "Solo" },
  { id: "couple", label: "Couple" },
  { id: "friends", label: "Friends" },
  { id: "family", label: "Family" },
] as const;

export const BUDGETS = [
  { id: 500, label: "₹500" },
  { id: 1000, label: "₹1,000" },
  { id: 2500, label: "₹2,500" },
  { id: 5000, label: "₹5,000+" },
] as const;

export const TIMINGS = [
  { id: "tonight", label: "Tonight" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
  { id: "weekend", label: "This Weekend" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];
export type GroupId = (typeof GROUPS)[number]["id"];
export type TimingId = (typeof TIMINGS)[number]["id"];

export const CATEGORY_NAV = [
  { slug: "events", label: "Events", path: "/events" },
  { slug: "restaurants", label: "Restaurants", path: "/restaurants" },
  { slug: "cafes", label: "Cafés", path: "/cafes" },
  { slug: "nightlife", label: "Nightlife", path: "/nightlife" },
  { slug: "live-music", label: "Live Music", path: "/live-music" },
  { slug: "comedy", label: "Comedy", path: "/comedy" },
  { slug: "experiences", label: "Experiences", path: "/experiences" },
] as const;

export const CONCIERGE_SUGGESTIONS = [
  "Make it cheaper",
  "Replace dinner",
  "Add live music",
  "Keep everything near Bandra",
  "Make it more romantic",
];

export const SEO_PAGES: Record<
  string,
  { title: string; h1: string; description: string; filters: Record<string, string> }
> = {
  "things-to-do-in-mumbai": {
    title: "Things to do in Mumbai",
    h1: "Things to do in Mumbai",
    description: "The best things to do in Mumbai right now, picked by vybz — bars, cafés, gigs, comedy, experiences and more.",
    filters: {},
  },
  "mumbai-events-this-weekend": {
    title: "Mumbai events this weekend",
    h1: "Mumbai events this weekend",
    description: "What's on in Mumbai this weekend — live music, comedy nights, pop-ups and experiences, updated as listings are verified.",
    filters: { timing: "weekend", type: "event" },
  },
  "things-to-do-tonight": {
    title: "Things to do in Mumbai tonight",
    h1: "Things to do tonight",
    description: "Last-minute plans in Mumbai tonight: gigs, comedy, rooftop bars, late dinners and late-night cafés.",
    filters: { timing: "tonight" },
  },
  "live-music-mumbai": {
    title: "Live music in Mumbai",
    h1: "Live music in Mumbai",
    description: "Live music venues and gigs across Mumbai — indie, jazz, electronic and everything in between.",
    filters: { category: "live-music" },
  },
  "comedy-mumbai": {
    title: "Comedy shows in Mumbai",
    h1: "Comedy in Mumbai",
    description: "Stand-up, open mics and comedy clubs in Mumbai. Find a show that fits your night.",
    filters: { category: "comedy" },
  },
  "mumbai-date-ideas": {
    title: "Mumbai date ideas",
    h1: "Date ideas in Mumbai",
    description: "Romantic things to do in Mumbai for couples — sunset spots, intimate dinners, cosy cafés and shared experiences.",
    filters: { mood: "romantic", group: "couple" },
  },
  "mumbai-nightlife": {
    title: "Mumbai nightlife",
    h1: "Mumbai nightlife",
    description: "Bars, clubs and late-night spots across Mumbai, from Bandra rooftops to Lower Parel basements.",
    filters: { category: "nightlife" },
  },
  "mumbai-cafes": {
    title: "Best cafés in Mumbai",
    h1: "Cafés in Mumbai",
    description: "Cafés worth the commute — Irani classics, specialty coffee and slow afternoons across Mumbai.",
    filters: { category: "cafes" },
  },
  "mumbai-weekend-experiences": {
    title: "Mumbai weekend experiences",
    h1: "Weekend experiences in Mumbai",
    description: "Workshops, walks, tours and things to try this weekend in Mumbai.",
    filters: { category: "experiences", timing: "weekend" },
  },
};
