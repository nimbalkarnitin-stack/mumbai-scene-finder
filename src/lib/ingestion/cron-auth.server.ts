import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Ingestion endpoints accept either the Lovable cron secret or a scheduler token whose
 * sha256 hash is stored in ingestion_cron_tokens (service-role only). No secret is ever
 * sent to, or readable by, the browser.
 */
export async function authoriseIngestionRequest(request: Request): Promise<Response | null> {
  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });

  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = createHash("sha256").update(token, "utf8").digest("hex");

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("ingestion_cron_tokens").select("token_sha256");
    for (const row of data ?? []) {
      const stored = Buffer.from(row.token_sha256, "utf8");
      const provided = Buffer.from(digest, "utf8");
      if (stored.length === provided.length && timingSafeEqual(stored, provided)) return null;
    }
  } catch {
    // fall through to the Lovable cron secret check
  }

  return authenticateCronRequest(request);
}
