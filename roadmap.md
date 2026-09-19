# SceneAI ingestion engine — roadmap

- [x] Ingestion schema: source_records, ingestion_sources, ingestion_jobs, duplicate_candidates, ingestion_settings, cron tokens, provenance/freshness columns, event lifecycle + timezone, indexes, RLS
- [x] Shared ingestion libs: types, Asia/Kolkata timezone, URL/SSRF guard, quality scoring, dedupe, safe fetch with retry + rate limit
- [x] Adapters: official site, organiser submission, partner feed (JSON/RSS/CSV), BookMyShow scaffold (disabled), Instagram/Meta scaffold (disabled), registry
- [x] AI enrichment (source-grounded, no invented facts)
- [x] Pipeline: ingest source, normalise/publish, dedupe scan, verify, expire, orchestrate, job logging
- [x] Authenticated ingestion endpoints (/api/public/ingestion/$task)
- [x] Admin server functions: review queues, actions, sources, health, organiser submission
- [ ] Admin UI: /admin/data-review, /admin/data-health, /admin/sources (+ nav)
- [ ] Public NOW / NEXT 3 HOURS / TONIGHT / THIS WEEKEND section from real records only
- [ ] Ingestion analytics events wired through existing tracking
- [ ] Tests: timezone, expiry, idempotency, dedupe, URL validation, retry, quality gate
- [ ] Cron schedules (only if pg_cron/pg_net safely available — otherwise report endpoints for external scheduling)
- [ ] Typecheck / build / smoke verification
- Do not publish. No fake listings. No secrets in frontend.
