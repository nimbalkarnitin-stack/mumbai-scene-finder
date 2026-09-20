# SceneAI audit — plan vs. reality (read-only)

All figures below are live counts read from the project's database and code today. Nothing was changed.

## 1. Completed and operational

- **Mumbai-first discovery**: 1 city, 12 areas, category set live. City-scoped data model with `city_id` on every listing table, so more cities can be added without redesign.
- **Mood / budget / group / time / area picker**: live on the home page and the recommendation page, with results ranked by a weighted relevance engine (preference, budget, time, location, occasion, freshness, popularity, history).
- **Personalisation signal**: recent searches/saves feed a lightweight history input into ranking; no extra personal data collected.
- **Google-based discovery layer**: operational. 1,800 configured queries, 165 enabled, 208 API calls logged, 773 candidate places discovered, 163 validated, 543 candidate source pages found. Google is used only to find candidates and their own official websites.
- **Official-source ingestion**: 9 sources configured (3 enabled), 86 ingestion runs recorded, 52 raw source records stored, with source name/URL, first-seen, last-checked and field-level provenance.
- **Verification, deduplication, freshness, quarantine**: all running. 0 open field conflicts, 0 unresolved duplicates.
- **Automation**: 4 active scheduled jobs (near-term ingest every 2 hours, nightly full ingest, nightly health check, hourly event expiry), authenticated by a stored token. No n8n needed.
- **Venue detail depth**: 8 venues (6 active Mumbai, 2 quarantined wrong-city), average profile completeness ~84%, with hours, contact, menu, map, reservation links and source attribution shown only when a source published them.
- **Event detail depth**: sourced date/time in Mumbai time, venue, price, booking link, organiser, description, map and today's status.
- **AI concierge + itinerary builder**: conversational refinement and "plan my weekend" both work, grounded only in stored listings, unverified ones flagged.
- **Auth + admin**: sign-in, saved items, membership tier field, and admin screens for catalogue, data review, data health, sources, discovery, users, analytics, monetisation.
- **Analytics capture**: 5,247 interaction events recorded (searches, views, outbound clicks, with booking vs. map/website clicks separated).
- **Monetisation engine (code + schema)**: tracked links, attribution, click/conversion recording, commission models, capped sponsored ranking, disclosure labels, admin dashboard, signed partner callback endpoint.

## 2. Partially completed

- **Catalogue size**: only 12 events (6 upcoming, 1 in the next 7 days), 6 active venues, 0 experiences. The engine works; the inventory is far too thin for a usable consumer product.
- **NOW / NEXT 3 HOURS / TONIGHT / WEEKEND**: built and reading real records, but usually empty because of the thin catalogue.
- **Discovery-to-catalogue conversion**: 773 candidates produced only 52 raw records and 12 events. The bottleneck is the step that turns validated candidates into ingested official pages.
- **SEO**: category and city routes exist with per-page titles/descriptions, and the crawler file allows indexing, but there is **no sitemap**, no structured data for listings, and the membership, deals and guides pages have no page-specific titles/descriptions.
- **Content engine**: guides feature is built but **0 guides** exist, so there is no content-driven traffic.
- **SceneAI+ membership**: page and tier field exist, but there is no payment flow, no paid benefits gating, and 0 registered users.
- **Digital products**: table, admin editor and storefront query exist, but **0 products** and no checkout.
- **Revenue dashboard**: dashboard exists; 0 clicks, 0 conversions, 0 revenue rows because no affiliate partner is live.

## 3. Pending / blockers

- **No user accounts at all** (0 users, 0 admins). Nobody has signed in, so the admin screens have never been used signed-in, and the admin role cannot be granted until you create an account.
- **No monetisation is live**: 0 enabled partners, 0 offers, 0 sponsored campaigns. Needs, per partner: publisher/account ID, link format, commission rate, API token and callback secret.
- **Ticketing data blocked**: the large-scale event source needs authorised partner access (or a paid automation actor you chose not to select), so no ticketed events flow in.
- **Social sources blocked**: professional social API access not granted.
- **Email, WhatsApp and social distribution**: not built at all — no code exists for any of these.
- **Payments**: no payment provider connected, so membership and digital products cannot earn.
- **Not published**: the app has not been deployed as a live product.
- **Experiences category**: completely empty; no source feeds it yet.

## 4. Recommended next 10 tasks, in priority order

1. Create your own account and grant yourself the admin role, so the admin tooling is actually usable.
2. Fix the candidate-to-catalogue conversion so the 163 validated candidates and 543 candidate pages actually produce venues and events; target hundreds of listings, not 12.
3. Widen enabled discovery coverage (more areas/categories) and re-run, to grow the candidate pool for restaurants, cafés, nightlife, comedy and live music.
4. Add a small set of high-trust Mumbai organiser/venue event pages as official sources so TONIGHT and THIS WEEKEND are reliably populated.
5. Add a sitemap plus listing structured data, and give the membership, deals and guides pages real titles and descriptions.
6. Launch the first revenue channel: activate one affiliate partner end-to-end (account ID, link format, rate, token, callback secret) and verify a real tracked click.
7. Connect a payment provider and make SceneAI+ and at least one digital product actually purchasable.
8. Auto-generate SEO guides from the real catalogue (area and category round-ups) to create organic traffic, with no invented facts.
9. Add email capture plus a weekly "what's on in Mumbai" send, built only from verified upcoming events.
10. Publish the app, then review the funnel (search → view → outbound click) on real traffic and tune ranking from it.

## Technical notes

- Counts sourced from: `venues`, `events`, `experiences`, `guides`, `offers`, `digital_products`, `discovery_candidates`, `discovery_source_candidates`, `source_records`, `ingestion_sources`, `ingestion_jobs`, `google_discovery_queries`, `google_api_requests`, `affiliate_*`, `sponsored_listings`, `interactions`, `itineraries`, `auth.users`, `user_roles`, `field_conflicts`, `duplicate_candidates`, and `cron.job`.
- Scheduling uses in-database cron hitting authenticated ingestion endpoints; no external automation tool is required.
- Existing database linter warnings about SECURITY DEFINER helper functions remain and are intentional (they back the role check).
- Missing credentials/accounts: ticketing partner access, an automation actor ID, professional social API access, affiliate partner credentials + callback secrets, and a payment provider.

No code or data was modified by this audit.
