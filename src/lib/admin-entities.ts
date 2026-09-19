import { DEFAULT_CITY_ID } from "./scene-constants";

export type FieldKind = "text" | "textarea" | "number" | "boolean" | "datetime" | "list" | "select" | "json";
export interface FieldDef { key: string; label: string; kind: FieldKind; options?: string; required?: boolean; help?: string }
export interface EntityDef { table: string; label: string; singular: string; listCols: string[]; fields: FieldDef[]; defaults?: Record<string, unknown>; orderBy: string }

const LISTING_COMMON: FieldDef[] = [
  { key: "name", label: "Name", kind: "text", required: true },
  { key: "slug", label: "Slug", kind: "text", required: true, help: "URL id, lowercase-with-dashes" },
  { key: "description", label: "Description", kind: "textarea" },
  { key: "category_id", label: "Category", kind: "select", options: "categories" },
  { key: "area_id", label: "Area", kind: "select", options: "areas" },
  { key: "image_url", label: "Image URL", kind: "text" },
  { key: "price_min", label: "Price min (₹)", kind: "number" },
  { key: "price_max", label: "Price max (₹)", kind: "number" },
  { key: "moods", label: "Moods", kind: "list", help: "party, romantic, live-music, comedy, food, outdoors, chill, something-new" },
  { key: "group_types", label: "Groups", kind: "list", help: "solo, couple, friends, family" },
  { key: "tags", label: "Tags", kind: "list" },
  { key: "booking_url", label: "Booking URL", kind: "text" },
  { key: "source_url", label: "Source URL", kind: "text", help: "Where this info was verified" },
  { key: "affiliate_link_id", label: "Affiliate link", kind: "select", options: "affiliate_links" },
  { key: "is_sponsored", label: "Sponsored", kind: "boolean" },
  { key: "sponsor_id", label: "Sponsor", kind: "select", options: "sponsors" },
  { key: "is_verified", label: "Verified", kind: "boolean" },
  { key: "is_active", label: "Active", kind: "boolean" },
  { key: "popularity_score", label: "Popularity (0-100)", kind: "number" },
];

export const ENTITIES: Record<string, EntityDef> = {
  venues: {
    table: "venues", label: "Venues", singular: "Venue", orderBy: "updated_at", listCols: ["name", "slug", "price_min", "is_verified", "is_sponsored", "is_active"],
    fields: [...LISTING_COMMON, { key: "address", label: "Address", kind: "text" }, { key: "website_url", label: "Website", kind: "text" }, { key: "opening_hours", label: "Opening hours (JSON)", kind: "json" }, { key: "best_times", label: "Best times", kind: "list", help: "morning, afternoon, evening, late-night" }],
    defaults: { city_id: DEFAULT_CITY_ID, is_active: true, moods: [], group_types: [], tags: [], best_times: [], popularity_score: 50 },
  },
  events: {
    table: "events", label: "Events", singular: "Event", orderBy: "starts_at", listCols: ["name", "starts_at", "price_min", "is_verified", "is_active"],
    fields: [...LISTING_COMMON, { key: "starts_at", label: "Starts at", kind: "datetime", required: true }, { key: "ends_at", label: "Ends at", kind: "datetime" }, { key: "venue_id", label: "Venue", kind: "select", options: "venues" }],
    defaults: { city_id: DEFAULT_CITY_ID, is_active: true, moods: [], group_types: [], tags: [], popularity_score: 50 },
  },
  experiences: {
    table: "experiences", label: "Experiences", singular: "Experience", orderBy: "updated_at", listCols: ["name", "slug", "price_min", "is_verified", "is_active"],
    fields: [...LISTING_COMMON, { key: "duration_minutes", label: "Duration (min)", kind: "number" }, { key: "schedule_note", label: "Schedule note", kind: "text" }, { key: "best_times", label: "Best times", kind: "list" }],
    defaults: { city_id: DEFAULT_CITY_ID, is_active: true, moods: [], group_types: [], tags: [], best_times: [], popularity_score: 50 },
  },
  offers: {
    table: "offers", label: "Offers", singular: "Offer", orderBy: "created_at", listCols: ["title", "discount_text", "is_members_only", "is_sponsored", "is_active"],
    fields: [
      { key: "title", label: "Title", kind: "text", required: true }, { key: "description", label: "Description", kind: "textarea" }, { key: "discount_text", label: "Discount label", kind: "text" },
      { key: "promo_code", label: "Promo code", kind: "text" }, { key: "url", label: "Redeem URL", kind: "text" }, { key: "valid_from", label: "Valid from", kind: "datetime" }, { key: "valid_until", label: "Valid until", kind: "datetime" },
      { key: "item_type", label: "Item type", kind: "select", options: "item_type" }, { key: "item_id", label: "Item ID", kind: "text" },
      { key: "is_members_only", label: "SceneAI+ only", kind: "boolean" }, { key: "is_sponsored", label: "Sponsored", kind: "boolean" }, { key: "sponsor_id", label: "Sponsor", kind: "select", options: "sponsors" }, { key: "is_active", label: "Active", kind: "boolean" },
    ],
    defaults: { city_id: DEFAULT_CITY_ID, is_active: true },
  },
  categories: {
    table: "categories", label: "Categories", singular: "Category", orderBy: "sort_order", listCols: ["name", "slug", "kind", "sort_order", "is_active"],
    fields: [{ key: "name", label: "Name", kind: "text", required: true }, { key: "slug", label: "Slug", kind: "text", required: true }, { key: "kind", label: "Kind", kind: "text", help: "venue | event | experience" }, { key: "icon", label: "Icon", kind: "text" }, { key: "sort_order", label: "Sort order", kind: "number" }, { key: "is_active", label: "Active", kind: "boolean" }],
    defaults: { is_active: true, kind: "venue", sort_order: 100 },
  },
  areas: {
    table: "areas", label: "Areas", singular: "Area", orderBy: "name", listCols: ["name", "slug", "zone", "is_active"],
    fields: [{ key: "name", label: "Name", kind: "text", required: true }, { key: "slug", label: "Slug", kind: "text", required: true }, { key: "zone", label: "Zone", kind: "text" }, { key: "lat", label: "Lat", kind: "number" }, { key: "lng", label: "Lng", kind: "number" }, { key: "is_active", label: "Active", kind: "boolean" }],
    defaults: { city_id: DEFAULT_CITY_ID, is_active: true },
  },
  guides: {
    table: "guides", label: "Content", singular: "Guide", orderBy: "created_at", listCols: ["title", "slug", "is_published"],
    fields: [{ key: "title", label: "Title", kind: "text", required: true }, { key: "slug", label: "Slug", kind: "text", required: true }, { key: "excerpt", label: "Excerpt", kind: "textarea" }, { key: "body", label: "Body (Markdown)", kind: "textarea" }, { key: "cover_image_url", label: "Cover image URL", kind: "text" }, { key: "is_published", label: "Published", kind: "boolean" }],
    defaults: { city_id: DEFAULT_CITY_ID, is_published: false },
  },
  sponsors: {
    table: "sponsors", label: "Sponsors", singular: "Sponsor", orderBy: "created_at", listCols: ["name", "website", "is_active"],
    fields: [{ key: "name", label: "Name", kind: "text", required: true }, { key: "website", label: "Website", kind: "text" }, { key: "logo_url", label: "Logo URL", kind: "text" }, { key: "contact_email", label: "Contact email", kind: "text" }, { key: "is_active", label: "Active", kind: "boolean" }],
    defaults: { is_active: true },
  },
  affiliate_links: {
    table: "affiliate_links", label: "Affiliate links", singular: "Affiliate link", orderBy: "created_at", listCols: ["partner_name", "base_url", "commission_rate", "is_active"],
    fields: [{ key: "partner_name", label: "Partner", kind: "text", required: true }, { key: "base_url", label: "Base URL", kind: "text", required: true }, { key: "tracking_param", label: "Tracking param", kind: "text", help: "e.g. ref=sceneai" }, { key: "commission_rate", label: "Commission %", kind: "number" }, { key: "is_active", label: "Active", kind: "boolean" }],
    defaults: { is_active: true, commission_rate: 0 },
  },
  digital_products: {
    table: "digital_products", label: "Digital products", singular: "Product", orderBy: "created_at", listCols: ["title", "price", "is_active"],
    fields: [{ key: "title", label: "Title", kind: "text", required: true }, { key: "slug", label: "Slug", kind: "text", required: true }, { key: "description", label: "Description", kind: "textarea" }, { key: "price", label: "Price (₹)", kind: "number", required: true }, { key: "image_url", label: "Image URL", kind: "text" }, { key: "purchase_url", label: "Purchase URL", kind: "text" }, { key: "is_active", label: "Active", kind: "boolean" }],
    defaults: { is_active: true, price: 0 },
  },
  revenue_events: {
    table: "revenue_events", label: "Revenue", singular: "Revenue event", orderBy: "occurred_at", listCols: ["occurred_at", "source", "amount", "currency"],
    fields: [{ key: "source", label: "Source", kind: "text", required: true, help: "affiliate | sponsorship | membership | product" }, { key: "amount", label: "Amount", kind: "number", required: true }, { key: "currency", label: "Currency", kind: "text" }, { key: "occurred_at", label: "Occurred at", kind: "datetime" }, { key: "sponsor_id", label: "Sponsor", kind: "select", options: "sponsors" }, { key: "affiliate_link_id", label: "Affiliate link", kind: "select", options: "affiliate_links" }, { key: "item_type", label: "Item type", kind: "select", options: "item_type" }, { key: "item_id", label: "Item ID", kind: "text" }],
    defaults: { currency: "INR", amount: 0, source: "affiliate" },
  },
};

export const ADMIN_NAV: { to: string; label: string }[] = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/data-review", label: "Data review" },
  { to: "/admin/data-health", label: "Data health" },
  { to: "/admin/sources", label: "Sources" },
  { to: "/admin/discovery", label: "Discovery" },
  { to: "/admin/monetization", label: "Monetisation" },
  ...Object.entries(ENTITIES).map(([k, e]) => ({ to: `/admin/${k}`, label: e.label })),
  { to: "/admin/users", label: "Users" },
  { to: "/admin/analytics", label: "Analytics" },
];

