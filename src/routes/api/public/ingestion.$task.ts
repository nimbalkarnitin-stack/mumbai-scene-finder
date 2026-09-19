import { createFileRoute } from "@tanstack/react-router";

const TASKS = ["orchestrate", "ingest-source", "normalise-record", "deduplicate-records", "verify-catalogue", "expire-events", "health", "google-discovery"] as const;
type Task = (typeof TASKS)[number];

/**
 * Ingestion pipeline endpoints, invoked by the scheduler (pg_cron) or by an admin from
 * /admin/sources. Caller is verified against the stored scheduler token hash or the
 * Lovable cron secret — route placement never authenticates anyone.
 */
export const Route = createFileRoute("/api/public/ingestion/$task")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { authoriseIngestionRequest } = await import("@/lib/ingestion/cron-auth.server");
        const denied = await authoriseIngestionRequest(request);
        if (denied) return denied;

        const task = params.task as Task;
        if (!TASKS.includes(task)) return Response.json({ error: "Unknown task" }, { status: 404 });

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const pipeline = await import("@/lib/ingestion/pipeline.server");
        const settings = await pipeline.loadSettings(supabaseAdmin);

        try {
          switch (task) {
            case "orchestrate": {
              const mode = body["mode"] === "full" ? "full" : "near";
              const result = await pipeline.orchestrate(supabaseAdmin, { mode, sourceSlug: typeof body["source"] === "string" ? body["source"] : null });
              return Response.json({ ok: true, task, ...result });
            }
            case "ingest-source": {
              const slug = typeof body["source"] === "string" ? body["source"] : null;
              if (!slug) return Response.json({ error: "source slug required" }, { status: 400 });
              const { data: source } = await supabaseAdmin.from("ingestion_sources").select("*").eq("slug", slug).maybeSingle();
              if (!source) return Response.json({ error: "source not found" }, { status: 404 });
              if (!source.enabled) return Response.json({ ok: false, task, error: "source disabled" }, { status: 409 });
              const result = await pipeline.runSource(supabaseAdmin, source as never, settings);
              return Response.json({ ok: result.status !== "failed", task, ...result });
            }
            case "normalise-record": {
              const published = await pipeline.publishReadyRecords(supabaseAdmin, settings);
              return Response.json({ ok: true, task, published });
            }
            case "deduplicate-records": {
              const result = await pipeline.scanDuplicates(supabaseAdmin);
              return Response.json({ ok: true, task, result });
            }
            case "verify-catalogue": {
              const result = await pipeline.verifyCatalogue(supabaseAdmin, settings);
              return Response.json({ ok: true, task, result });
            }
            case "expire-events": {
              const result = await pipeline.expireEvents(supabaseAdmin);
              return Response.json({ ok: true, task, result });
            }
            case "health": {
              const since = new Date(Date.now() - 86400000).toISOString();
              const [{ data: jobs }, { count: reviewQueue }] = await Promise.all([
                supabaseAdmin.from("ingestion_jobs").select("status,records_created,records_updated,records_failed").gte("started_at", since),
                supabaseAdmin.from("source_records").select("id", { count: "exact", head: true }).in("review_status", ["new", "needs_review", "changed"]),
              ]);
              const rows = jobs ?? [];
              return Response.json({
                ok: true,
                task,
                window_hours: 24,
                jobs: rows.length,
                failed_jobs: rows.filter((j) => j.status === "failed").length,
                created: rows.reduce((n, j) => n + j.records_created, 0),
                updated: rows.reduce((n, j) => n + j.records_updated, 0),
                failed_records: rows.reduce((n, j) => n + j.records_failed, 0),
                review_queue: reviewQueue ?? 0,
              });
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[ingestion:${task}]`, message);
          return Response.json({ ok: false, task, error: message }, { status: 500 });
        }
        return Response.json({ error: "Unhandled task" }, { status: 400 });
      },
    },
  },
});
