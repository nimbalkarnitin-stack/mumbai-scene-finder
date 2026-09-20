/**
 * Admin observability for the Swiggy integration. Non-sensitive only: connection counts,
 * last successful call, last error class, latency and retries. No tokens, no user identities,
 * no Swiggy response bodies.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

export const getSwiggyHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = Date.now();

    const [{ data: connections }, { data: clients }, { data: metrics }] = await Promise.all([
      supabaseAdmin.from("swiggy_connections").select("expires_at,revoked_at,last_error_class,last_used_at"),
      supabaseAdmin.from("swiggy_clients").select("id,redirect_uri,created_at"),
      supabaseAdmin
        .from("swiggy_call_metrics")
        .select("server,tool,outcome,http_status,duration_ms,retries,error_class,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const rows = connections ?? [];
    const active = rows.filter((r) => !r.revoked_at && Date.parse(r.expires_at) > now);
    const expired = rows.filter((r) => !r.revoked_at && Date.parse(r.expires_at) <= now);
    const calls = metrics ?? [];
    const ok = calls.filter((c) => c.outcome === "success");
    const failed = calls.filter((c) => c.outcome !== "success");

    const byTool = new Map<string, { tool: string; calls: number; errors: number; avgMs: number; retries: number }>();
    for (const c of calls) {
      const key = `${c.server}:${c.tool}`;
      const entry = byTool.get(key) ?? { tool: key, calls: 0, errors: 0, avgMs: 0, retries: 0 };
      entry.avgMs = (entry.avgMs * entry.calls + (c.duration_ms ?? 0)) / (entry.calls + 1);
      entry.calls += 1;
      if (c.outcome !== "success") entry.errors += 1;
      entry.retries += c.retries ?? 0;
      byTool.set(key, entry);
    }

    const errorClasses = new Map<string, number>();
    for (const c of failed) errorClasses.set(c.error_class ?? "UNKNOWN", (errorClasses.get(c.error_class ?? "UNKNOWN") ?? 0) + 1);

    return {
      registeredClients: (clients ?? []).length,
      clientRegisteredAt: clients?.[0]?.created_at ?? null,
      connections: { total: rows.length, active: active.length, expired: expired.length },
      lastSuccessAt: ok[0]?.created_at ?? null,
      lastErrorAt: failed[0]?.created_at ?? null,
      lastErrorClass: failed[0]?.error_class ?? null,
      sampleSize: calls.length,
      successRate: calls.length === 0 ? null : Math.round((ok.length / calls.length) * 100),
      avgLatencyMs: ok.length === 0 ? null : Math.round(ok.reduce((s, c) => s + (c.duration_ms ?? 0), 0) / ok.length),
      totalRetries: calls.reduce((s, c) => s + (c.retries ?? 0), 0),
      byTool: [...byTool.values()].map((t) => ({ ...t, avgMs: Math.round(t.avgMs) })).sort((a, b) => b.calls - a.calls),
      errorClasses: [...errorClasses.entries()].map(([errorClass, count]) => ({ errorClass, count })).sort((a, b) => b.count - a.count),
    };
  });
