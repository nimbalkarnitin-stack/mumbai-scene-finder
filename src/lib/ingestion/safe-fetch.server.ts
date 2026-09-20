import { checkExternalUrl, isAllowedByRobots } from "./url-guard";

export interface SafeFetchOptions {
  allowHosts?: string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  /** Skip robots.txt check (only for authorised APIs / partner feeds). */
  skipRobots?: boolean;
}

export interface SafeFetchResult {
  status: number;
  url: string;
  body: string;
  lastModified: string | null;
  contentType: string;
}

export class FetchBlockedError extends Error {
  constructor(reason: string) {
    super(`Blocked: ${reason}`);
    this.name = "FetchBlockedError";
  }
}

const USER_AGENT = "vybz-Ingest/1.0 (+https://vybz.co.in)";
const robotsCache = new Map<string, { allowedCheck: (path: string) => boolean; at: number }>();

async function robotsAllows(url: URL, timeoutMs: number): Promise<boolean> {
  const key = url.origin;
  const cached = robotsCache.get(key);
  if (cached && Date.now() - cached.at < 3600_000) return cached.allowedCheck(url.pathname);
  let check: (path: string) => boolean = () => true;
  try {
    const res = await fetch(`${url.origin}/robots.txt`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (res.ok) {
      const txt = (await res.text()).slice(0, 200_000);
      check = (path) => isAllowedByRobots(txt, path);
    }
  } catch {
    // No robots.txt reachable: treat as allowed, the fetch itself is still rate-limited.
  }
  robotsCache.set(key, { allowedCheck: check, at: Date.now() });
  return check(url.pathname);
}

/** Simple in-process rate limiter: at most one request per host per interval. */
const lastHostFetch = new Map<string, number>();
const MIN_HOST_INTERVAL_MS = 1200;

async function rateLimit(host: string) {
  const last = lastHostFetch.get(host) ?? 0;
  const wait = MIN_HOST_INTERVAL_MS - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHostFetch.set(host, Date.now());
}

/**
 * Fetch an external URL with SSRF protection: protocol allowlist, private-range blocking,
 * validated redirects, timeouts, response-size cap, robots.txt honouring and per-host rate limiting.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxBytes = options.maxBytes ?? 1_500_000;
  const maxRedirects = options.maxRedirects ?? 3;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const check = checkExternalUrl(current, options.allowHosts ?? []);
    if (!check.ok || !check.url) throw new FetchBlockedError(check.reason ?? "invalid url");
    const url = check.url;
    if (!options.skipRobots && !(await robotsAllows(url, timeoutMs))) {
      throw new FetchBlockedError(`robots.txt disallows ${url.pathname}`);
    }
    await rateLimit(url.hostname);

    const res = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: { "user-agent": USER_AGENT, accept: "*/*", ...(options.headers ?? {}) },
      ...(options.body ? { body: options.body } : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new FetchBlockedError("redirect without location");
      current = new URL(location, url).toString();
      continue;
    }

    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > maxBytes) throw new FetchBlockedError(`response too large (${declared} bytes)`);

    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) throw new FetchBlockedError(`response too large (${buf.byteLength} bytes)`);

    return {
      status: res.status,
      url: url.toString(),
      body: new TextDecoder().decode(buf),
      lastModified: res.headers.get("last-modified"),
      contentType: res.headers.get("content-type") ?? "",
    };
  }
  throw new FetchBlockedError("too many redirects");
}

/** Bounded exponential backoff for transient failures (network errors / 5xx / 429). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseMs = 400 }: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof FetchBlockedError) throw error;
      // Permanent upstream failures (4xx other than 429) must not be retried.
      if ((error as { permanent?: boolean })?.permanent) throw error;
      if (i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function isTransient(error: unknown): boolean {
  if (error instanceof FetchBlockedError) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /timeout|network|fetch failed|ECONN|429|50\d/i.test(msg);
}
