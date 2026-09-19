/**
 * SSRF guard for configurable fetchers: only public http(s) origins are allowed.
 * Pure functions so they can be unit tested and reused by validators.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "instance-data",
  "0.0.0.0",
  "[::1]",
  "::1",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
}

export interface UrlCheck {
  ok: boolean;
  reason?: string;
  url?: URL;
}

/** Validate an external URL before fetching or storing it. */
export function checkExternalUrl(raw: string | null | undefined, allowHosts: string[] = []): UrlCheck {
  if (!raw || typeof raw !== "string") return { ok: false, reason: "missing url" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "not a valid absolute url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: `protocol ${url.protocol} not allowed` };
  if (url.username || url.password) return { ok: false, reason: "credentials in url not allowed" };
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return { ok: false, reason: "loopback/metadata host blocked" };
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, reason: "internal hostname blocked" };
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) return { ok: false, reason: "private ip range blocked" };
  if (!host.includes(".")) return { ok: false, reason: "non-public hostname blocked" };
  if (allowHosts.length > 0) {
    const allowed = allowHosts.some((h) => {
      const clean = h.trim().toLowerCase().replace(/^\*\./, "");
      return clean.length > 0 && (host === clean || host.endsWith(`.${clean}`));
    });
    if (!allowed) return { ok: false, reason: "host not in source allowlist" };
  }
  return { ok: true, url };
}

export function isSafeExternalUrl(raw: string | null | undefined, allowHosts: string[] = []): boolean {
  return checkExternalUrl(raw, allowHosts).ok;
}

/** Keep only URLs we are willing to store/render. */
export function sanitiseUrl(raw: string | null | undefined): string | null {
  const check = checkExternalUrl(raw);
  return check.ok && check.url ? check.url.toString() : null;
}

/** Strip tags/entities from imported HTML or text before it is stored or rendered. */
export function sanitiseText(input: unknown, maxLength = 2000): string | null {
  if (typeof input !== "string") return null;
  const text = input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** Minimal robots.txt honouring for `User-agent: *` disallow rules. */
export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  let inStar = false;
  const disallows: string[] = [];
  const allows: string[] = [];
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey || rest.length === 0) continue;
    const key = rawKey.toLowerCase().trim();
    const value = rest.join(":").trim();
    if (key === "user-agent") inStar = value === "*";
    else if (inStar && key === "disallow" && value) disallows.push(value);
    else if (inStar && key === "allow" && value) allows.push(value);
  }
  const match = (rule: string) => path.startsWith(rule);
  const longestAllow = allows.filter(match).sort((a, b) => b.length - a.length)[0]?.length ?? -1;
  const longestDisallow = disallows.filter(match).sort((a, b) => b.length - a.length)[0]?.length ?? -1;
  if (longestDisallow === -1) return true;
  return longestAllow >= longestDisallow;
}
