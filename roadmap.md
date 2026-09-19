# SceneAI ingestion engine — roadmap

- [x] Ingestion schema: source_records, ingestion_sources, ingestion_jobs, duplicate_candidates, ingestion_settings, cron tokens, provenance/freshness columns, event lifecycle + timezone, indexes, RLS
- [x] Shared ingestion libs: types, Asia/Kolkata timezone, URL/SSRF guard, quality scoring, dedupe, safe fetch with retry + rate limit
- [x] Adapters: official site, organiser submission, partner feed (JSON/RSS/CSV), BookMyShow scaffold (disabled), Instagram/Meta scaffold (disabled), registry
- [x] AI enrichment (source-grounded, no invented facts)
- [x] Pipeline: ingest source, normalise/publish, dedupe scan, verify, expire, orchestrate, job logging
- [x] Authenticated ingestion endpoints (/api/public/ingestion/$task)
- [x] Admin server functions: review queues, actions, sources, health, organiser submission
- [x] Admin UI: /admin/data-review, /admin/data-health, /admin/sources (+ nav)
- [x] Public NOW / NEXT 3 HOURS / TONIGHT / THIS WEEKEND section from real records only
- [x] Ingestion analytics events through the existing interactions table
- [x] Tests: timezone, expiry, idempotency, dedupe, URL validation, retry, quality gate (32 passing)
- [x] Cron schedules via pg_cron + pg_net with a Vault-held scheduler token (4 jobs, recreated idempotently)
- [x] Typecheck / build / endpoint + page smoke checks

Open (blocked on external input):
- [ ] BookMyShow adapter stays disabled until BOOKMYSHOW_API_BASE_URL + BOOKMYSHOW_API_KEY are added (needs authorised partner access)
- [ ] Instagram/Meta adapter stays disabled until INSTAGRAM_GRAPH_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ACCOUNT_ID are added
- [ ] Official-site source needs real venue/organiser page URLs entered in /admin/sources
- [ ] Admin screens not yet smoke-tested signed in: no user accounts exist yet, so no admin role could be granted
- Do not publish. No fake listings. No secrets in frontend.
