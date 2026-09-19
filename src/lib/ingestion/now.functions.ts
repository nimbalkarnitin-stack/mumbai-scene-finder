import { createServerFn } from "@tanstack/react-start";
import { PUBLIC_VISIBLE_STATES } from "./provenance";

export interface NowEvent {
  id: string;
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  areaName: string | null;
  categoryName: string | null;
  bookingUrl: string | null;
  verification: string;
  sourceName: string | null;
}

export interface NowWindow {
  key: "now" | "next3h" | "tonight" | "weekend";
  label: string;
  count: number;
  items: NowEvent[];
}

interface Row {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  booking_url: string | null;
  verification_status: string;
  source_name: string | null;
  areas: { name: string } | null;
  categories: { name: string } | null;
}

const toItem = (r: Row): NowEvent => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  imageUrl: r.image_url,
  priceMin: r.price_min,
  priceMax: r.price_max,
  areaName: r.areas?.name ?? null,
  categoryName: r.categories?.name ?? null,
  bookingUrl: r.booking_url,
  verification: r.verification_status,
  sourceName: r.source_name,
});

/**
 * Live "what's happening" windows, built only from ACTIVE catalogue events with a stored
 * start time. Empty windows stay empty — nothing here is generated or estimated.
 */
export const getHappeningNow = createServerFn({ method: "GET" }).handler(async (): Promise<{ windows: NowWindow[]; total: number }> => {
  const { createPublicClient } = await import("@/lib/public-db.server");
  const { istTonightWindow, istWeekendWindow } = await import("@/lib/ingestion/timezone");
  const db = createPublicClient();
  const now = new Date();
  const tonight = istTonightWindow(now);
  const weekend = istWeekendWindow(now);

  const select = "id,slug,name,starts_at,ends_at,image_url,price_min,price_max,booking_url,verification_status,source_name,areas(name),categories(name)";
  // Source-backed only: stale and unverified events never appear in the live windows,
  // and cancelled/expired lifecycles are excluded.
  const query = (from: string, to: string, limit: number) =>
    db
      .from("events")
      .select(select, { count: "exact" })
      .eq("is_active", true)
      .eq("lifecycle_status", "ACTIVE")
      .in("verification_status", PUBLIC_VISIBLE_STATES)
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true })
      .limit(limit);

  // "Now" = already started and not yet ended (or started within the last 2 hours).
  const runningFrom = new Date(now.getTime() - 3 * 3600000).toISOString();
  const [running, next3h, tonightRes, weekendRes] = await Promise.all([
    query(runningFrom, now.toISOString(), 8),
    query(now.toISOString(), new Date(now.getTime() + 3 * 3600000).toISOString(), 8),
    query(tonight.start, tonight.end, 8),
    query(weekend.start, weekend.end, 8),
  ]);

  const build = (
    key: NowWindow["key"],
    label: string,
    res: { data: unknown; count: number | null },
  ): NowWindow => ({ key, label, count: res.count ?? 0, items: ((res.data ?? []) as unknown as Row[]).map(toItem) });

  const windows: NowWindow[] = [
    build("now", "Now", running),
    build("next3h", "Next 3 hours", next3h),
    build("tonight", "Tonight", tonightRes),
    build("weekend", "This weekend", weekendRes),
  ];
  return { windows, total: windows.reduce((n, w) => n + w.count, 0) };
});
