import { apifyAdapter } from "./apify.server";
import { bookMyShowAdapter } from "./bookmyshow.server";
import { googleDiscoveryAdapter } from "./google-discovery.server";
import { instagramAdapter } from "./instagram.server";
import { metaPagesAdapter } from "./meta-pages.server";
import { officialSiteAdapter } from "./official-site.server";
import { organiserSubmissionAdapter } from "./organiser-submission.server";
import { partnerFeedAdapter } from "./partner-feed.server";
import type { SourceAdapter } from "./types";

export const ADAPTERS: Record<string, SourceAdapter> = {
  [officialSiteAdapter.key]: officialSiteAdapter,
  [organiserSubmissionAdapter.key]: organiserSubmissionAdapter,
  [partnerFeedAdapter.key]: partnerFeedAdapter,
  [bookMyShowAdapter.key]: bookMyShowAdapter,
  [instagramAdapter.key]: instagramAdapter,
  [metaPagesAdapter.key]: metaPagesAdapter,
  [apifyAdapter.key]: apifyAdapter,
  [googleDiscoveryAdapter.key]: googleDiscoveryAdapter,
};

export function getAdapter(key: string): SourceAdapter | null {
  return ADAPTERS[key] ?? null;
}
