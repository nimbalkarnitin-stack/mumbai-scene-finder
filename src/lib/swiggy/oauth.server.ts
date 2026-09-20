/**
 * Swiggy MCP OAuth 2.1 + PKCE, server-only.
 *
 * Follows the documented Swiggy Builders Club flow: OAuth 2.1 with PKCE and dynamic client
 * registration, access tokens valid for 5 days with no refresh token in v1.0 — so an expired or
 * revoked session can only be fixed by re-authorising. Discovery uses the standard protected
 * resource / authorization server metadata documents; no endpoint or parameter is invented.
 *
 * Tokens never leave the server: they are stored in `swiggy_connections` (RLS denies the browser)
 * and are never logged, returned to the client, or placed in a URL.
 */
import { SWIGGY_SERVERS, SwiggyError, isTokenExpired } from "./protocol";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
/** Docs: access tokens expire in 5 days. Used only when the token response omits expires_in. */
const DEFAULT_TOKEN_TTL_SEC = 5 * 24 * 60 * 60;

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------------------------------------------------ PKCE */

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/* ------------------------------------------------------------------ redirect URI */

/**
 * The callback must be an exact HTTPS URL in production. http is tolerated only for localhost
 * during local development, as the Swiggy docs require.
 */
export function resolveRedirectUri(origin: string): string {
  const url = new URL(origin);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !isLocal) {
    throw new SwiggyError("INVALID_REQUEST", "Swiggy requires an HTTPS callback URL.");
  }
  return `${url.origin}/api/public/swiggy/callback`;
}

/* ------------------------------------------------------------------ metadata discovery */

export interface SwiggyAuthMetadata {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string | null;
  scopesSupported: string[];
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new SwiggyError(res.status >= 500 ? "UPSTREAM_ERROR" : "INVALID_REQUEST", `${url} responded ${res.status}`, res.status);
  return (await res.json()) as unknown;
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export async function discoverAuthMetadata(resource = SWIGGY_SERVERS.food): Promise<SwiggyAuthMetadata> {
  const resourceUrl = new URL(resource);
  const candidates: string[] = [];
  try {
    const prm = rec(await fetchJson(`${resourceUrl.origin}/.well-known/oauth-protected-resource${resourceUrl.pathname}`));
    for (const as of Array.isArray(prm["authorization_servers"]) ? prm["authorization_servers"] : []) {
      if (typeof as === "string") candidates.push(as);
    }
  } catch {
    /* Protected-resource metadata is optional; fall back to the server origin. */
  }
  if (candidates.length === 0) candidates.push(resourceUrl.origin);

  let lastError: unknown = null;
  for (const issuer of candidates) {
    const base = issuer.replace(/\/+$/, "");
    for (const path of ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"]) {
      try {
        const md = rec(await fetchJson(`${base}${path}`));
        const authorizationEndpoint = typeof md["authorization_endpoint"] === "string" ? md["authorization_endpoint"] : null;
        const tokenEndpoint = typeof md["token_endpoint"] === "string" ? md["token_endpoint"] : null;
        if (!authorizationEndpoint || !tokenEndpoint) continue;
        return {
          issuer: typeof md["issuer"] === "string" ? md["issuer"] : base,
          authorizationEndpoint,
          tokenEndpoint,
          registrationEndpoint: typeof md["registration_endpoint"] === "string" ? md["registration_endpoint"] : null,
          scopesSupported: (Array.isArray(md["scopes_supported"]) ? md["scopes_supported"] : []).filter((s): s is string => typeof s === "string"),
        };
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw new SwiggyError("UPSTREAM_ERROR", `Swiggy authorization server metadata could not be read.${lastError ? ` (${String(lastError)})` : ""}`);
}

/* ------------------------------------------------------------------ dynamic client registration */

export interface SwiggyClientRow {
  id: string;
  client_id: string;
  client_secret: string | null;
  authorization_endpoint: string;
  token_endpoint: string;
  scope: string | null;
  redirect_uri: string;
}

/** Register once per callback URL, then reuse the stored client. */
export async function ensureRegisteredClient(redirectUri: string): Promise<SwiggyClientRow> {
  const db = await admin();
  const { data: existing } = await db
    .from("swiggy_clients")
    .select("id,client_id,client_secret,authorization_endpoint,token_endpoint,scope,redirect_uri")
    .eq("redirect_uri", redirectUri)
    .maybeSingle();
  if (existing) return existing as SwiggyClientRow;

  const md = await discoverAuthMetadata();
  if (!md.registrationEndpoint) {
    throw new SwiggyError("INVALID_REQUEST", "Swiggy's authorization server does not advertise dynamic client registration for this app yet.");
  }
  const scope = md.scopesSupported.length > 0 ? md.scopesSupported.join(" ") : null;
  const registration = rec(
    await fetchJson(md.registrationEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "My Mood (vybz)",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        application_type: "web",
        ...(scope ? { scope } : {}),
      }),
    }),
  );
  const clientId = typeof registration["client_id"] === "string" ? registration["client_id"] : null;
  if (!clientId) throw new SwiggyError("UPSTREAM_ERROR", "Swiggy client registration did not return a client_id.");

  const { data: inserted, error } = await db
    .from("swiggy_clients")
    .insert({
      issuer: md.issuer,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: typeof registration["client_secret"] === "string" ? registration["client_secret"] : null,
      authorization_endpoint: md.authorizationEndpoint,
      token_endpoint: md.tokenEndpoint,
      registration_client_uri: typeof registration["registration_client_uri"] === "string" ? registration["registration_client_uri"] : null,
      scope,
    })
    .select("id,client_id,client_secret,authorization_endpoint,token_endpoint,scope,redirect_uri")
    .single();
  if (error || !inserted) throw new SwiggyError("UNKNOWN", error?.message ?? "Could not store the Swiggy client.");
  return inserted as SwiggyClientRow;
}

/* ------------------------------------------------------------------ authorization */

/** Only same-origin relative paths may be used as the post-connect return target. */
export function safeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/food";
  return path;
}

export async function beginAuthorization(input: { userId: string; origin: string; returnPath?: string | null }): Promise<{ authorizeUrl: string }> {
  const redirectUri = resolveRedirectUri(input.origin);
  const client = await ensureRegisteredClient(redirectUri);
  const db = await admin();

  const state = randomToken(24);
  const verifier = randomToken(32);
  const { error } = await db.from("swiggy_oauth_states").insert({
    user_id: input.userId,
    state,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    client_row_id: client.id,
    return_path: safeReturnPath(input.returnPath),
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
  });
  if (error) throw new SwiggyError("UNKNOWN", error.message);

  const url = new URL(client.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await codeChallengeS256(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  // Swiggy's documented combined flow shares one OAuth session across Food and Dineout.
  url.searchParams.set("resource", SWIGGY_SERVERS.food);
  if (client.scope) url.searchParams.set("scope", client.scope);
  return { authorizeUrl: url.toString() };
}

export async function completeAuthorization(input: { code: string; state: string }): Promise<{ userId: string; returnPath: string }> {
  const db = await admin();
  const { data: stateRow } = await db
    .from("swiggy_oauth_states")
    .select("id,user_id,code_verifier,redirect_uri,client_row_id,return_path,consumed_at,expires_at")
    .eq("state", input.state)
    .maybeSingle();
  if (!stateRow) throw new SwiggyError("INVALID_REQUEST", "This Swiggy sign-in link is not valid any more.");
  if (stateRow.consumed_at) throw new SwiggyError("INVALID_REQUEST", "This Swiggy sign-in link was already used.");
  if (Date.parse(stateRow.expires_at) <= Date.now()) throw new SwiggyError("INVALID_REQUEST", "This Swiggy sign-in link has expired. Please try connecting again.");

  // Single-use: consume before exchanging so a replayed callback cannot mint a second token.
  await db.from("swiggy_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("id", stateRow.id);

  if (!stateRow.client_row_id) throw new SwiggyError("INVALID_REQUEST", "The Swiggy app registration is missing.");
  const { data: client } = await db
    .from("swiggy_clients")
    .select("id,client_id,client_secret,token_endpoint,scope")
    .eq("id", stateRow.client_row_id)
    .maybeSingle();
  if (!client) throw new SwiggyError("INVALID_REQUEST", "The Swiggy app registration is missing.");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: stateRow.redirect_uri,
    client_id: client.client_id,
    code_verifier: stateRow.code_verifier,
    // The resulting session token is valid for both documented MCP servers.
    resource: SWIGGY_SERVERS.food,
  });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (client.client_secret) headers["authorization"] = `Basic ${btoa(`${client.client_id}:${client.client_secret}`)}`;

  const res = await fetch(client.token_endpoint, { method: "POST", headers, body });
  if (!res.ok) {
    throw new SwiggyError(res.status >= 500 ? "UPSTREAM_ERROR" : "UNAUTHORIZED", `Swiggy rejected the authorization (HTTP ${res.status}).`, res.status);
  }
  const token = rec(await res.json());
  const accessToken = typeof token["access_token"] === "string" ? token["access_token"] : null;
  if (!accessToken) throw new SwiggyError("UPSTREAM_ERROR", "Swiggy did not return an access token.");
  const expiresIn = typeof token["expires_in"] === "number" ? token["expires_in"] : DEFAULT_TOKEN_TTL_SEC;

  const now = new Date();
  await db
    .from("swiggy_connections")
    .upsert(
      {
        user_id: stateRow.user_id,
        access_token: accessToken,
        token_type: typeof token["token_type"] === "string" ? token["token_type"] : "Bearer",
        scope: typeof token["scope"] === "string" ? token["scope"] : client.scope,
        expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
        connected_at: now.toISOString(),
        updated_at: now.toISOString(),
        last_error_class: null,
        revoked_at: null,
      },
      { onConflict: "user_id" },
    );

  return { userId: stateRow.user_id, returnPath: safeReturnPath(stateRow.return_path) };
}

/* ------------------------------------------------------------------ connection state */

export interface SwiggyConnectionState {
  connected: boolean;
  expiresAt: string | null;
  connectedAt: string | null;
  lastUsedAt: string | null;
  needsReconnect: boolean;
  lastErrorClass: string | null;
}

export async function getConnectionState(userId: string): Promise<SwiggyConnectionState> {
  const db = await admin();
  const { data } = await db
    .from("swiggy_connections")
    .select("expires_at,connected_at,last_used_at,last_error_class,revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.revoked_at) {
    return { connected: false, expiresAt: null, connectedAt: null, lastUsedAt: null, needsReconnect: false, lastErrorClass: null };
  }
  const expired = isTokenExpired(data.expires_at);
  return {
    connected: !expired,
    expiresAt: data.expires_at,
    connectedAt: data.connected_at,
    lastUsedAt: data.last_used_at,
    needsReconnect: expired || data.last_error_class === "UNAUTHORIZED" || data.last_error_class === "SESSION_EXPIRED",
    lastErrorClass: data.last_error_class,
  };
}

/** Server-only: the raw token is never returned to the browser. */
export async function getAccessToken(userId: string): Promise<string> {
  const db = await admin();
  const { data } = await db
    .from("swiggy_connections")
    .select("access_token,expires_at,revoked_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.revoked_at) throw new SwiggyError("NOT_CONNECTED", "Connect your Swiggy account to see live delivery options.");
  if (isTokenExpired(data.expires_at)) throw new SwiggyError("SESSION_EXPIRED", "Your Swiggy session has expired — please reconnect.");
  return data.access_token;
}

export async function noteConnectionUse(userId: string, errorClass: string | null): Promise<void> {
  const db = await admin();
  await db
    .from("swiggy_connections")
    .update({ last_used_at: new Date().toISOString(), last_error_class: errorClass, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function disconnectSwiggyAccount(userId: string): Promise<void> {
  const db = await admin();
  // The token itself is dropped, not just flagged.
  await db.from("swiggy_connections").delete().eq("user_id", userId);
}
