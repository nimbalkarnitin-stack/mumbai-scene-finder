INSERT INTO public.ingestion_sources
  (slug, name, source_type, adapter_key, base_url, enabled, authority_level, refresh_interval_minutes, requires_credentials, credential_env_keys, config, notes)
VALUES
  ('google-discovery', 'Google discovery (Places / Programmable Search)', 'discovery', 'google_discovery', NULL, false, 2, 1440, true,
   ARRAY['GOOGLE_PLACES_API_KEY','GOOGLE_SEARCH_API_KEY','GOOGLE_SEARCH_ENGINE_ID'],
   '{"city": "mumbai", "mode": "places_text_search", "queries": [], "max_results": 20, "location_bias": {"lat": 19.076, "lng": 72.8777, "radius_m": 25000}}'::jsonb,
   'Discovery/enrichment signal only: stores candidate names and official website links to resolve first-party sources. Google listing content (reviews, photos, ratings, descriptions) is never copied into the catalogue. Requires Google API keys and compliance with Google''s terms, quotas and caching rules.'),
  ('eventbrite-authorised', 'Eventbrite (authorised API)', 'ticketing_api', 'partner_feed', NULL, false, 4, 540, true,
   ARRAY['EVENTBRITE_API_TOKEN'],
   '{"city": "mumbai", "format": "json", "feed_url": null, "items_path": "events", "auth_env_key": "EVENTBRITE_API_TOKEN"}'::jsonb,
   'Disabled until an Eventbrite API token and organisation/feed URL you are authorised to read are configured.'),
  ('facebook-pages', 'Facebook Pages (Meta Graph API)', 'social_api', 'meta_pages', NULL, false, 2, 540, true,
   ARRAY['META_GRAPH_ACCESS_TOKEN'],
   '{"city": "mumbai", "page_ids": [], "api_version": "v21.0"}'::jsonb,
   'Authorised Meta Graph API page events only. Provides freshness/change signals; records always route to review. No scraping.')
ON CONFLICT (slug) DO NOTHING;