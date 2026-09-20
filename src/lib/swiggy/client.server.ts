/**
 * Swiggy MCP transport, server-only.
 *
 * Streamable-HTTP JSON-RPC against the documented Food server (https://mcp.swiggy.com/food)
 * with Bearer auth from the user's MCP session. Retries follow the docs: exponential backoff
 * with jitter, max 5 retries, for transient upstream failures only. There is no synthetic
 * RATE_LIMITED class because the MCP layer does not currently enforce 429.
 *
 * Compliance: only non-sensitive call metadata is recorded (server, tool, outcome, status,
 * latency, retries, error class). Request and response bodies are never persisted or logged.
 */
import {
  MAX_RETRIES,
  SWIGGY_SERVERS,
  SwiggyError,
  backoffDelayMs,
  classifyHttpStatus,
  isRetryable,
  parseToolResult,
  type SwiggyServer,
} from "./protocol";
import { getAccessToken, noteConnectionUse } from "./oauth.server";

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "vybz", version: "1.0.0" };

/** Short-lived MCP session reuse, keyed per user+server. Sessions are not persisted. */
const sessions = new Map<string, { sessionId: string | null; at: number }>();
const SESSION_TTL_MS = 5 * 60 * 1000;

interface RpcOutcome {
  result: unknown;
  sessionId: string | null;
  status: number;
}

function parseSse(text: string): unknown {
  let last: unknown = null;
  for (const block of text.split(/\n\n/)) {
    for (const line of block.split(/\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        last = JSON.parse(payload);
      } catch {
        /* ignore non-JSON keepalives */
      }
    }
  }
  return last;
}

async function rpc(
  endpoint: string,
  token: string,
  sessionId: string | null,
  message: Record<string, unknown>,
  expectResult: boolean,
): Promise<RpcOutcome> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": PROTOCOL_VERSION,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  let res: Response;
  try {
    res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(message) });
  } catch (err) {
    throw new SwiggyError("TRANSPORT_ERROR", `Could not reach Swiggy: ${err instanceof Error ? err.message : String(err)}`);
  }

  const nextSession = res.headers.get("mcp-session-id") ?? sessionId;
  if (!res.ok) {
    const cls = classifyHttpStatus(res.status);
    throw new SwiggyError(cls, `Swiggy responded with HTTP ${res.status}.`, res.status);
  }
  if (!expectResult || res.status === 202) return { result: null, sessionId: nextSession, status: res.status };

  const body = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  let envelope: unknown = null;
  if (contentType.includes("text/event-stream")) envelope = parseSse(body);
  else {
    try {
      envelope = JSON.parse(body);
    } catch {
      throw new SwiggyError("TRANSPORT_ERROR", "Swiggy returned a response that could not be read.");
    }
  }
  const env = (envelope && typeof envelope === "object" ? envelope : {}) as Record<string, unknown>;
  if (env["error"]) {
    const e = env["error"] as Record<string, unknown>;
    throw new SwiggyError("TOOL_ERROR", typeof e["message"] === "string" ? e["message"] : "Swiggy returned an error.");
  }
  return { result: env["result"], sessionId: nextSession, status: res.status };
}

async function openSession(endpoint: string, token: string): Promise<string | null> {
  const init = await rpc(
    endpoint,
    token,
    null,
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO } },
    true,
  );
  if (init.sessionId) {
    await rpc(endpoint, token, init.sessionId, { jsonrpc: "2.0", method: "notifications/initialized" }, false).catch(() => undefined);
  }
  return init.sessionId;
}

async function recordMetric(input: {
  userId: string;
  server: SwiggyServer;
  tool: string;
  outcome: "success" | "error";
  httpStatus: number | null;
  durationMs: number;
  retries: number;
  errorClass: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("swiggy_call_metrics").insert({
      user_id: input.userId,
      server: input.server,
      tool: input.tool,
      outcome: input.outcome,
      http_status: input.httpStatus,
      duration_ms: input.durationMs,
      retries: input.retries,
      error_class: input.errorClass,
    });
  } catch {
    /* Observability must never break a user request. */
  }
}

/**
 * Call a documented Swiggy MCP tool as the signed-in user. Session credentials come from the
 * stored MCP session, never from tool arguments.
 */
export async function callSwiggyTool(input: {
  userId: string;
  tool: string;
  args: Record<string, unknown>;
  server?: SwiggyServer;
}): Promise<unknown> {
  const server = input.server ?? "food";
  const endpoint = SWIGGY_SERVERS[server];
  const token = await getAccessToken(input.userId);
  const cacheKey = `${input.userId}:${server}`;
  const started = Date.now();
  let retries = 0;
  let lastError: SwiggyError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      let cached = sessions.get(cacheKey);
      if (!cached || Date.now() - cached.at > SESSION_TTL_MS) {
        cached = { sessionId: await openSession(endpoint, token), at: Date.now() };
        sessions.set(cacheKey, cached);
      }
      const call = await rpc(
        endpoint,
        token,
        cached.sessionId,
        { jsonrpc: "2.0", id: attempt + 1, method: "tools/call", params: { name: input.tool, arguments: input.args } },
        true,
      );
      const payload = parseToolResult(call.result);
      await recordMetric({ userId: input.userId, server, tool: input.tool, outcome: "success", httpStatus: call.status, durationMs: Date.now() - started, retries, errorClass: null });
      await noteConnectionUse(input.userId, null);
      return payload;
    } catch (err) {
      const error = err instanceof SwiggyError ? err : new SwiggyError("UNKNOWN", err instanceof Error ? err.message : String(err));
      lastError = error;
      // A dropped session is not a user-facing failure: rebuild it and retry once more.
      if (error.errorClass === "INVALID_REQUEST" && sessions.has(cacheKey)) sessions.delete(cacheKey);
      if (!isRetryable(error.errorClass) || attempt > MAX_RETRIES) break;
      sessions.delete(cacheKey);
      retries++;
      await new Promise((r) => setTimeout(r, backoffDelayMs(attempt)));
    }
  }

  const error = lastError ?? new SwiggyError("UNKNOWN", "Swiggy call failed.");
  await recordMetric({ userId: input.userId, server, tool: input.tool, outcome: "error", httpStatus: error.httpStatus, durationMs: Date.now() - started, retries, errorClass: error.errorClass });
  await noteConnectionUse(input.userId, error.errorClass);
  throw error;
}
