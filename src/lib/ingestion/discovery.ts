/**
 * Source-discovery helpers. Pure functions so they can be unit tested and shared with validators.
 *
 * Discovery only ever identifies *where* a fact might be published (an official website,
 * an events page, an authorised social profile). It never produces event facts itself.
 */

export type DiscoveryStatus = "DISCOVERED" | "SOURCE_FOUND" | "VALIDATED" | "INGESTED" | "REJECTED";

export type SourceCandidateKind = "official_site" | "events_page" | "feed" | "calendar" | "social_profile" | "unknown";

/** Domains that aggregate or resell other people's listings — never treated as an official source. */
const AGGREGATOR_DOMAINS = [
  "bookmyshow.com",
  "insider.in",
  "eventbrite.com",
  "eventbrite.co.in",
  "ticketmaster.com",
  "zomato.com",
  "swiggy.com",
  "dineout.co.in",
  "tripadvisor.com",
  "tripadvisor.in",
  "yelp.com",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "justdial.com",
  "magicpin.com",
  "nearbuy.com",
  "eazydiner.com",
  "townscript.com",
  "allevents.in",
  "meraevents.com",
  "wikipedia.org",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "linktr.ee",
  "linkedin.com",
  "youtube.com",
  "medium.com",
];

const SOCIAL_HOSTS: Record<string, string> = {
  "instagram.com": "instagram",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "x.com": "x",
  "twitter.com": "x",
  "linkedin.com": "linkedin",
  "youtube.com": "youtube",
};

/** Lowercased hostname without a leading www. */
export function hostnameOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Best-effort registrable domain (handles common two-label suffixes such as co.in / com.au). */
export function registrableDomain(raw: string | null | undefined): string | null {
  const host = hostnameOf(raw) ?? (raw ? raw.toLowerCase().replace(/^www\./, "") : null);
  if (!host || !host.includes(".")) return null;
  const parts = host.split(".");
  const twoLabelSuffixes = new Set(["co.in", "com.au", "co.uk", "org.in", "net.in", "gov.in", "ac.in", "com.br", "co.jp"]);
  const lastTwo = parts.slice(-2).join(".");
  if (twoLabelSuffixes.has(lastTwo) && parts.length >= 3) return parts.slice(-3).join(".");
  return lastTwo;
}

export function isAggregatorDomain(raw: string | null | undefined): boolean {
  const domain = registrableDomain(raw);
  if (!domain) return false;
  return AGGREGATOR_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function socialPlatformOf(raw: string | null | undefined): string | null {
  const domain = registrableDomain(raw);
  if (!domain) return null;
  return SOCIAL_HOSTS[domain] ?? null;
}

/** Parse a social profile URL into platform + handle. Returns null for post/permalink URLs. */
export function parseSocialProfile(raw: string | null | undefined): { platform: string; handle: string; profileUrl: string } | null {
  const platform = socialPlatformOf(raw);
  if (!platform || !raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) return null;
  const reserved = new Set(["p", "reel", "reels", "explore", "stories", "watch", "events", "share", "status", "hashtag", "tv", "channel", "pages"]);
  if (reserved.has(first.toLowerCase())) return null;
  const handle = first.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._-]{2,60}$/.test(handle)) return null;
  return { platform, handle, profileUrl: `${url.origin}/${handle}` };
}

function tokenise(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["the", "and", "cafe", "bar", "club", "mumbai", "restaurant", "house", "studio", "theatre", "theater"].includes(t));
}

/**
 * How strongly a URL looks like the official website of a named venue/organiser.
 * Returns 0 for aggregator/social domains — those are never promoted to "official" automatically.
 */
export function officialDomainConfidence(name: string, url: string): { confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  const domain = registrableDomain(url);
  if (!domain) return { confidence: 0, reasons: ["no resolvable domain"] };
  if (isAggregatorDomain(domain)) return { confidence: 0, reasons: [`${domain} is an aggregator/social domain, not a first-party source`] };

  const domainWord = domain.split(".")[0] ?? "";
  const compact = domainWord.replace(/[^a-z0-9]/g, "");
  const tokens = tokenise(name);
  let score = 0.25;
  reasons.push("resolvable non-aggregator domain");

  const nameCompact = tokens.join("");
  if (nameCompact && compact.includes(nameCompact)) {
    score += 0.5;
    reasons.push("domain contains the full venue name");
  } else {
    const hits = tokens.filter((t) => compact.includes(t)).length;
    if (hits > 0) {
      score += Math.min(0.4, 0.2 * hits);
      reasons.push(`${hits} name token(s) present in the domain`);
    } else {
      reasons.push("domain does not contain the venue name");
    }
  }
  try {
    if (new URL(url).protocol === "https:") {
      score += 0.1;
      reasons.push("https");
    }
  } catch {
    // handled by registrableDomain above
  }
  return { confidence: Math.round(Math.min(1, score) * 100) / 100, reasons };
}

/** Paths publishers commonly use for a what's-on page. Used only on the venue's own domain. */
export const EVENT_PATH_CANDIDATES = [
  "/events",
  "/whats-on",
  "/what-s-on",
  "/calendar",
  "/events/",
  "/upcoming-events",
  "/lineup",
  "/line-up",
  "/gigs",
  "/shows",
  "/programme",
  "/program",
];

/** Candidate what's-on URLs on the same origin as the official site. */
export function candidateEventUrls(officialUrl: string): string[] {
  let origin: string;
  try {
    origin = new URL(officialUrl).origin;
  } catch {
    return [];
  }
  return EVENT_PATH_CANDIDATES.map((p) => `${origin}${p}`);
}

const EVENT_WORDS = /(event|whats[-\s]?on|calendar|line[-\s]?up|gig|show|programme|program|upcoming|tickets)/i;

/** Classify a link found on an official page. Cross-domain links are never "official_site". */
export function classifyLinkKind(url: string, linkText = "", officialDomain: string | null = null): SourceCandidateKind {
  const domain = registrableDomain(url);
  if (!domain) return "unknown";
  if (socialPlatformOf(domain)) return "social_profile";
  if (/\.ics(\?|$)/i.test(url)) return "calendar";
  if (/\.(rss|xml|json)(\?|$)/i.test(url) || /\/feed\/?$/i.test(url)) return "feed";
  const sameSite = officialDomain ? domain === officialDomain : true;
  if (!sameSite) return "unknown";
  if (EVENT_WORDS.test(url) || EVENT_WORDS.test(linkText)) return "events_page";
  return "official_site";
}

/** Extract absolute links (href + visible text) from an HTML document. */
export function extractLinks(html: string, baseUrl: string): { url: string; text: string }[] {
  const out: { url: string; text: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < 400) {
    const href = m[1];
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    const text = (m[2] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    out.push({ url: abs, text });
  }
  return out;
}

/** Status a candidate should move to, given what the resolver found. Never skips ahead. */
export function nextDiscoveryStatus(
  current: DiscoveryStatus,
  found: { officialUrl: string | null; eventsUrl: string | null; structuredData: boolean },
): DiscoveryStatus {
  if (current === "REJECTED" || current === "INGESTED") return current;
  if (found.structuredData && found.eventsUrl) return "VALIDATED";
  if (found.officialUrl || found.eventsUrl) return "SOURCE_FOUND";
  return "DISCOVERED";
}

/** Re-check cadence for discovery candidates (cheaper than catalogue freshness checks). */
export function nextDiscoveryCheckAt(status: DiscoveryStatus, now: Date = new Date()): string {
  const days = status === "VALIDATED" || status === "INGESTED" ? 14 : status === "SOURCE_FOUND" ? 7 : 3;
  return new Date(now.getTime() + days * 86400000).toISOString();
}
