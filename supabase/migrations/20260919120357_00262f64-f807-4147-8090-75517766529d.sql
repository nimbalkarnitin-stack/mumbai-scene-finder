INSERT INTO public.ingestion_sources (slug, name, source_type, adapter_key, base_url, enabled, authority_level, refresh_interval_minutes, requires_credentials, credential_env_keys, config, notes)
VALUES (
  'bookmyshow-apify',
  'BookMyShow via Apify',
  'partner_feed',
  'apify',
  'https://api.apify.com/v2',
  false,
  3,
  360,
  true,
  ARRAY['LOVABLE_API_KEY','APIFY_API_KEY'],
  jsonb_build_object(
    'actor_id', NULL,
    'actor_input', jsonb_build_object(),
    'run_timeout_seconds', 180,
    'max_items', 500,
    'page_size', 200,
    'city', 'mumbai'
  ),
  'Disabled until the Apify connector is linked and an explicit Actor ID plus input JSON are configured. Only run Actors you are authorised to use; no Actor is assumed.'
)
ON CONFLICT (slug) DO NOTHING;