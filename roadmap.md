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

## Apify integration
- [x] Apify adapter (`src/lib/ingestion/adapters/apify.server.ts`) via Lovable connector gateway, registered in the adapter registry.
- [x] Disabled source row "BookMyShow via Apify" (adapter `apify`), no Actor assumed.
- [x] Admin Actor configuration/status panel on /admin/sources.
- [x] Apify connector linked ("Nitin's Apify", gateway-backed, credentials verified; FREE plan with $5/mo credits).
- [ ] Blocked: user chose not to pick a store Actor — source stays disabled until they supply an authorised Actor ID + input JSON (Admin → Sources → BookMyShow via Apify), then enable + Run now.

## Monetisation & affiliate engine (done, awaiting partner details)
- Schema: affiliate_partners, affiliate_offers, merchant_partnerships, sponsored_listings,
  affiliate_clicks, affiliate_conversions, monetisation_settings (+ enums, indexes, RLS, triggers).
- Code: src/lib/monetisation/* (types, partners, attribution, ranking, server + admin functions,
  events), /api/public/affiliate/$partner/postback, Disclosure components, monetised outbound
  tracking in src/lib/track.ts, relevance-first capped ranking in scene.functions.ts,
  SponsoredRail, /admin/monetization.
- Templates only: Cuelinks, vCommission, Admitad and direct merchant/venue deals are all
  DISABLED and unconfigured. No commission rates, merchants, offers or transactions invented.
- Ranking: monetisation is a secondary signal, default 3%, hard cap 5%, auditable per item.
- Tests: 19 monetisation tests (56 total) covering attribution, click idempotency,
  reconciliation, disclosure, disabled partners, relevance-first ranking.
- STILL NEEDED FROM USER, per partner: account/publisher ID, deep-link template or subid
  parameter, commission model + rate, API token and postback signing secret
  (Project Settings -> Secrets), then set the partner live in /admin/monetization.
- Sponsored placements need a real campaign row pointing at an existing catalogue listing.
