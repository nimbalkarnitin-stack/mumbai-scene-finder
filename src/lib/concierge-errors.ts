/**
 * Concierge failure classification.
 *
 * Pure, dependency-free so it can be unit tested and reused by the /api/chat route.
 * Produces (a) a stable machine `kind` for server-side logs and (b) an actionable
 * user-facing message. Never include provider bodies, tokens or PII in either.
 */

export type ConciergeErrorKind =
  | "validation"
  | "config"
  | "auth"
  | "credits"
  | "rate_limit"
  | "ai_denied"
  | "ai_bad_request"
  | "ai_unavailable"
  | "tool_catalogue"
  | "tool_swiggy"
  | "aborted"
  | "unknown";

export interface ConciergeErrorInfo {
  kind: ConciergeErrorKind;
  /** Shown to the end user. Actionable, no internals. */
  userMessage: string;
  /** Whether the same request could succeed if retried shortly. */
  retryable: boolean;
  /** HTTP status observed from the provider/gateway, when any. */
  status?: number;
  /** Short provider error type (e.g. credit_limit_reached) — safe, no payload. */
  providerType?: string;
}

const MESSAGES: Record<ConciergeErrorKind, string> = {
  validation: "That request couldn't be read. Please rephrase and send it again.",
  config: "The concierge isn't configured yet. Please contact vybz support.",
  auth: "Your session expired. Please sign in again to keep chatting.",
  credits:
    "The concierge is out of AI credits for this workspace. A workspace admin needs to raise the limit or top up before it can answer again.",
  rate_limit: "The concierge is busy right now — try again in a few seconds.",
  ai_denied: "The concierge can't answer that request.",
  ai_bad_request: "The concierge couldn't process that message. Try a shorter or simpler question.",
  ai_unavailable: "The concierge is temporarily unavailable. Please try again in a moment.",
  tool_catalogue: "The Mumbai catalogue is unreachable right now, so the concierge can't suggest places. Please try again shortly.",
  tool_swiggy: "Live Swiggy data isn't available right now — the concierge will use the vybz catalogue instead.",
  aborted: "Response stopped.",
  unknown: "The concierge hit a snag. Please try again.",
};

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Pull a status code off any of the shapes the AI SDK / fetch layers use. */
function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as Record<string, unknown>;
  const direct =
    readNumber(e["statusCode"]) ?? readNumber(e["status"]) ?? readNumber(e["httpStatus"]);
  if (direct) return direct;
  const data = e["data"];
  if (data && typeof data === "object") {
    const nested = readNumber((data as Record<string, unknown>)["status"]);
    if (nested) return nested;
  }
  const cause = e["cause"];
  if (cause && cause !== error) return extractStatus(cause);
  return undefined;
}

/** Provider error `type` if the gateway sent a JSON envelope. Never returns free-form text. */
function extractProviderType(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as Record<string, unknown>;
  const data = e["data"];
  if (data && typeof data === "object") {
    const t = (data as Record<string, unknown>)["type"];
    if (typeof t === "string" && t.length <= 64) return t;
  }
  const body = e["responseBody"];
  if (typeof body === "string" && body.startsWith("{")) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const t = parsed["type"];
      if (typeof t === "string" && t.length <= 64) return t;
    } catch {
      /* ignore unparseable bodies */
    }
  }
  const cause = e["cause"];
  if (cause && cause !== error) return extractProviderType(cause);
  return undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const m = (error as Record<string, unknown>)["message"];
    if (typeof m === "string") return m;
  }
  return "";
}

function nameOf(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (error && typeof error === "object") {
    const n = (error as Record<string, unknown>)["name"];
    if (typeof n === "string") return n;
  }
  return "";
}

function build(kind: ConciergeErrorKind, status?: number, providerType?: string): ConciergeErrorInfo {
  return {
    kind,
    userMessage: MESSAGES[kind],
    retryable: kind === "rate_limit" || kind === "ai_unavailable" || kind === "tool_catalogue",
    ...(status !== undefined ? { status } : {}),
    ...(providerType ? { providerType } : {}),
  };
}

export function classifyConciergeError(error: unknown): ConciergeErrorInfo {
  const name = nameOf(error);
  const text = messageOf(error);
  const status = extractStatus(error);
  const providerType = extractProviderType(error);

  if (name === "AbortError" || /aborted|abortsignal/i.test(text)) return build("aborted", status, providerType);
  if (name === "ZodError" || /invalid_enum_value|invalid_type|validation/i.test(text)) return build("validation", status, providerType);

  // Tool-scoped failures are tagged by the route before they bubble.
  if (/^\[tool:search_listings\]/.test(text)) return build("tool_catalogue", status, providerType);
  if (/^\[tool:swiggy\]/.test(text)) return build("tool_swiggy", status, providerType);

  if (/missing\s+lovable_api_key|not configured/i.test(text)) return build("config", status, providerType);

  if (providerType === "credit_limit_reached" || status === 402 || /insufficient.*credit|credit limit/i.test(text)) {
    return build("credits", status, providerType);
  }
  if (status === 429 || /rate.?limit|too many requests/i.test(text)) return build("rate_limit", status, providerType);
  if (status === 401 || /unauthorized|invalid api key|jwt/i.test(text)) return build("auth", status, providerType);
  if (status === 403) return build("ai_denied", status, providerType);
  if (status === 400) return build("ai_bad_request", status, providerType);
  if ((status !== undefined && status >= 500) || /fetch failed|network|timed? out|ETIMEDOUT|ECONNRESET/i.test(text)) {
    return build("ai_unavailable", status, providerType);
  }

  return build("unknown", status, providerType);
}

/** Structured, secret-free log line for the concierge request path. */
export function conciergeLogFields(info: ConciergeErrorInfo, scope: string, runId?: string | null) {
  return {
    at: "concierge",
    scope,
    kind: info.kind,
    retryable: info.retryable,
    ...(info.status !== undefined ? { status: info.status } : {}),
    ...(info.providerType ? { providerType: info.providerType } : {}),
    ...(runId ? { runId } : {}),
  };
}

export function logConciergeError(info: ConciergeErrorInfo, scope: string, runId?: string | null) {
  // Only classified fields are logged — never the provider body, headers or user text.
  console.error("[concierge:error]", JSON.stringify(conciergeLogFields(info, scope, runId)));
}
