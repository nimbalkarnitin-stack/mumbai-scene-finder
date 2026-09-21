# vybz ingestion engine — roadmap

- [x] Ingestion schema: source_records, ingestion_sources, ingestion_jobs, duplicate_candidates, ingestion_settings, cron tokens, provenance/freshness columns, event lifecycle + timezone, indexes, RLS
- [x] Shared ingestion libs: types, Asia/Kolkata timezone, URL/SSRF guard, quality scoring, dedupe, safe fetch with retry + rate limit
- [x] Adapters: official site, organiser submission, partner feed (JSON/RSS/CSV), BookMyShow scaffold (disabled), Instagram/Meta scaffold (disabled), Google discovery, Apify (disabled), registry
- [x] AI enrichment (source-grounded, no invented facts)
- [x] Pipeline: ingest source, normalise/publish, dedupe scan, verify, expire, orchestrate, job logging
- [x] Authenticated ingestion endpoints (/api/public/ingestion/$task)
- [x] Admin server functions + UI: /admin/data-review, /admin/data-health, /admin/sources, /admin/discovery
- [x] Public NOW / NEXT 3 HOURS / TONIGHT / THIS WEEKEND section from real records only
- [x] Ingestion analytics through the existing interactions table
- [x] Cron schedules via pg_cron + pg_net with a Vault-held scheduler token
- [x] Discovery -> recommendation loop: verified candidates auto-promote to official-pages source, ingest -> publish -> NOW/NEXT

Open (blocked on external input):
- [ ] BookMyShow adapter disabled until authorised partner access (BOOKMYSHOW_API_BASE_URL + BOOKMYSHOW_API_KEY)
- [ ] Instagram/Meta adapter disabled until INSTAGRAM_GRAPH_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ACCOUNT_ID
- [ ] Apify source disabled until an authorised Actor ID + input JSON is supplied
- [ ] Admin screens not smoke-tested signed in: no user accounts exist yet
- Do not publish. No fake listings. No secrets in frontend.

## Monetisation & affiliate engine (built, awaiting partner credentials)
- Schema, tracked links, attribution, reconciliation, capped relevance-first ranking, disclosures,
  /admin/monetization, postback endpoint. All partners DISABLED and unconfigured — no invented
  rates, merchants or transactions. Per-partner analytics recorded on every outbound click.

## Swiggy live layer (session-only, never persisted)
- OAuth 2.1 + PKCE, server-only MCP transport, Food + Dineout tools, /food live search,
  venue-page delivery + live Dineout reservations with confirmation references, /admin/swiggy metrics.
- Live enrichment on recommendations: for a signed-in user with a connected Swiggy account and a
  selected address, food venues in /scene show a session-only "Live from Swiggy" note
  (open for delivery now, ETA, cost for two). OPEN-only. Bounded to 6 venues per view.
  Disconnected users get identical canonical recommendations.
- Hard rule kept: no Swiggy response is written to venues/events/source_records/discovery tables,
  and no Swiggy data is used for analytics or ranking learning.
- [ ] External step: each user must authorise Swiggy; v1.0 issues no refresh token (reconnect after 5 days).

## Concierge reliability (error classification)
- src/lib/concierge-errors.ts classifies every /api/chat failure (credits, rate limit, auth,
  provider denial, bad request, unavailable, catalogue tool, Swiggy tool, abort, validation,
  config, unknown) into a distinct user message + secret-free structured log line.
- search_listings / list_areas return controlled "unavailable" tool results instead of throwing;
  Swiggy failures are non-blocking and only mentioned when the user asked about food/delivery.
- [ ] External step: workspace monthly AI spending limit (4 credits, block usage) is currently
  reached — a workspace admin must raise it or top up before the concierge can answer.
