-- ============ affiliate_partners ============
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.partner_kind NOT NULL DEFAULT 'affiliate_network',
  adapter_key text NOT NULL,
  status public.partner_status NOT NULL DEFAULT 'unconfigured',
  enabled boolean NOT NULL DEFAULT false,
  base_url text,
  dashboard_url text,
  credential_env_keys text[] NOT NULL DEFAULT '{}',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  disclosure_text text,
  default_commission_model public.commission_model,
  default_commission_rate numeric CHECK (default_commission_rate IS NULL OR (default_commission_rate >= 0 AND default_commission_rate <= 100)),
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_partners TO authenticated;
GRANT ALL ON public.affiliate_partners TO service_role;
ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage affiliate partners" ON public.affiliate_partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER affiliate_partners_updated_at BEFORE UPDATE ON public.affiliate_partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ affiliate_offers ============
CREATE TABLE IF NOT EXISTS public.affiliate_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  external_id text,
  title text NOT NULL,
  description text,
  destination_url text,
  deep_link_template text,
  item_type public.item_type,
  item_id uuid,
  commission_model public.commission_model NOT NULL DEFAULT 'CPA',
  commission_rate numeric CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100)),
  commission_flat numeric CHECK (commission_flat IS NULL OR commission_flat >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status public.campaign_status NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  disclosure_required boolean NOT NULL DEFAULT true,
  terms_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_offers_partner_external_idx
  ON public.affiliate_offers (partner_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliate_offers_entity_idx ON public.affiliate_offers (item_type, item_id);
CREATE INDEX IF NOT EXISTS affiliate_offers_status_idx ON public.affiliate_offers (status, starts_at, ends_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_offers TO authenticated;
GRANT SELECT ON public.affiliate_offers TO anon;
GRANT ALL ON public.affiliate_offers TO service_role;
ALTER TABLE public.affiliate_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage affiliate offers" ON public.affiliate_offers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Live affiliate offers are public" ON public.affiliate_offers FOR SELECT TO anon, authenticated
  USING (status = 'active' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE TRIGGER affiliate_offers_updated_at BEFORE UPDATE ON public.affiliate_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ merchant_partnerships ============
CREATE TABLE IF NOT EXISTS public.merchant_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  merchant_name text NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  item_type public.item_type,
  item_id uuid,
  model public.commission_model NOT NULL DEFAULT 'CPA',
  commission_rate numeric CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100)),
  flat_fee numeric CHECK (flat_fee IS NULL OR flat_fee >= 0),
  booking_fee numeric CHECK (booking_fee IS NULL OR booking_fee >= 0),
  currency text NOT NULL DEFAULT 'INR',
  status public.partner_status NOT NULL DEFAULT 'unconfigured',
  contact_name text,
  contact_email text,
  payout_terms text,
  contract_starts_at timestamptz,
  contract_ends_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchant_partnerships_entity_idx ON public.merchant_partnerships (item_type, item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_partnerships TO authenticated;
GRANT ALL ON public.merchant_partnerships TO service_role;
ALTER TABLE public.merchant_partnerships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage merchant partnerships" ON public.merchant_partnerships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER merchant_partnerships_updated_at BEFORE UPDATE ON public.merchant_partnerships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ sponsored_listings ============
CREATE TABLE IF NOT EXISTS public.sponsored_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  sponsor_id uuid REFERENCES public.sponsors(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  campaign_name text NOT NULL,
  placement text NOT NULL DEFAULT 'discovery',
  item_type public.item_type,
  item_id uuid,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  fee_amount numeric CHECK (fee_amount IS NULL OR fee_amount >= 0),
  budget_amount numeric CHECK (budget_amount IS NULL OR budget_amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  priority integer NOT NULL DEFAULT 0,
  disclosure_label text NOT NULL DEFAULT 'Sponsored',
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sponsored_listings_live_idx ON public.sponsored_listings (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS sponsored_listings_entity_idx ON public.sponsored_listings (item_type, item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsored_listings TO authenticated;
GRANT SELECT ON public.sponsored_listings TO anon;
GRANT ALL ON public.sponsored_listings TO service_role;
ALTER TABLE public.sponsored_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sponsored listings" ON public.sponsored_listings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Live sponsored listings are public" ON public.sponsored_listings FOR SELECT TO anon, authenticated
  USING (status = 'active' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE TRIGGER sponsored_listings_updated_at BEFORE UPDATE ON public.sponsored_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ affiliate_clicks ============
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subid text NOT NULL UNIQUE,
  dedupe_key text,
  partner_id uuid REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.affiliate_offers(id) ON DELETE SET NULL,
  sponsored_listing_id uuid REFERENCES public.sponsored_listings(id) ON DELETE SET NULL,
  merchant_partnership_id uuid REFERENCES public.merchant_partnerships(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  user_id uuid,
  session_id text,
  item_type public.item_type,
  item_id uuid,
  recommendation_id text,
  placement text,
  campaign text,
  link_kind text NOT NULL DEFAULT 'booking',
  destination_url text NOT NULL,
  tracked_url text NOT NULL,
  disclosure_shown boolean NOT NULL DEFAULT true,
  is_sponsored boolean NOT NULL DEFAULT false,
  commission_model public.commission_model,
  expected_commission_rate numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_clicks_dedupe_idx ON public.affiliate_clicks (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliate_clicks_partner_time_idx ON public.affiliate_clicks (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_clicks_entity_idx ON public.affiliate_clicks (item_type, item_id);
CREATE INDEX IF NOT EXISTS affiliate_clicks_session_idx ON public.affiliate_clicks (session_id, created_at DESC);
GRANT SELECT ON public.affiliate_clicks TO authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read affiliate clicks" ON public.affiliate_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ affiliate_conversions ============
CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  click_id uuid REFERENCES public.affiliate_clicks(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.affiliate_offers(id) ON DELETE SET NULL,
  merchant_partnership_id uuid REFERENCES public.merchant_partnerships(id) ON DELETE SET NULL,
  subid text,
  external_conversion_id text NOT NULL,
  status public.conversion_status NOT NULL DEFAULT 'pending',
  commission_model public.commission_model,
  order_value numeric CHECK (order_value IS NULL OR order_value >= 0),
  commission_amount numeric CHECK (commission_amount IS NULL OR commission_amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  item_type public.item_type,
  item_id uuid,
  occurred_at timestamptz,
  reported_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  rejection_reason text,
  payout_reference text,
  reconciliation_status text NOT NULL DEFAULT 'unmatched',
  reconciled_at timestamptz,
  import_batch text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_conversions_partner_external_idx
  ON public.affiliate_conversions (partner_id, external_conversion_id);
CREATE INDEX IF NOT EXISTS affiliate_conversions_status_idx ON public.affiliate_conversions (status, reported_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_conversions_subid_idx ON public.affiliate_conversions (subid);
GRANT SELECT, UPDATE ON public.affiliate_conversions TO authenticated;
GRANT ALL ON public.affiliate_conversions TO service_role;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read affiliate conversions" ON public.affiliate_conversions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update affiliate conversions" ON public.affiliate_conversions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER affiliate_conversions_updated_at BEFORE UPDATE ON public.affiliate_conversions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ monetisation_settings ============
CREATE TABLE IF NOT EXISTS public.monetisation_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.monetisation_settings TO authenticated;
GRANT SELECT ON public.monetisation_settings TO anon;
GRANT ALL ON public.monetisation_settings TO service_role;
ALTER TABLE public.monetisation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage monetisation settings" ON public.monetisation_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Monetisation settings are readable" ON public.monetisation_settings FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER monetisation_settings_updated_at BEFORE UPDATE ON public.monetisation_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ configuration templates (no merchants, rates or transactions) ============
INSERT INTO public.monetisation_settings (key, value, description) VALUES
  ('ranking_weight', '{"enabled": true, "weight": 0.03, "max_boost": 0.05}'::jsonb,
   'Monetisation is a secondary ranking signal only. weight is the share of the final score a monetised listing may gain; relevance, freshness, availability, budget fit and verification dominate.'),
  ('disclosure', '{"affiliate": "Some links on SceneAI are affiliate links. If you book through them SceneAI may earn a commission at no extra cost to you.", "sponsored": "Sponsored placement — paid for by the partner. It is always labelled and kept separate from organic recommendations."}'::jsonb,
   'User-facing affiliate and sponsored disclosure wording.'),
  ('attribution', '{"click_dedupe_window_minutes": 30, "conversion_window_days": 30}'::jsonb,
   'Attribution windows: repeated identical clicks inside the dedupe window reuse the same tracking id.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.affiliate_partners (slug, name, kind, adapter_key, status, enabled, base_url, dashboard_url, credential_env_keys, capabilities, config, disclosure_text, notes) VALUES
  ('cuelinks', 'Cuelinks', 'affiliate_network', 'cuelinks', 'unconfigured', false, NULL, NULL,
   ARRAY['CUELINKS_API_TOKEN','CUELINKS_CHANNEL_ID'],
   '{"deep_links": "unknown", "postback": "unknown", "reporting_api": "unknown"}'::jsonb,
   '{"deep_link_template": null, "subid_param": null, "postback_secret_env": "CUELINKS_POSTBACK_SECRET"}'::jsonb,
   'Affiliate link — SceneAI may earn a commission.',
   'Template only. Deep-link format, subid parameter, endpoints and commission rates must be filled in from the partner dashboard before enabling.'),
  ('vcommission', 'vCommission', 'affiliate_network', 'vcommission', 'unconfigured', false, NULL, NULL,
   ARRAY['VCOMMISSION_API_KEY','VCOMMISSION_AFFILIATE_ID'],
   '{"deep_links": "unknown", "postback": "unknown", "reporting_api": "unknown"}'::jsonb,
   '{"deep_link_template": null, "subid_param": null, "postback_secret_env": "VCOMMISSION_POSTBACK_SECRET"}'::jsonb,
   'Affiliate link — SceneAI may earn a commission.',
   'Template only. Awaiting affiliate ID, tracking-link format and postback configuration.'),
  ('admitad', 'Admitad', 'affiliate_network', 'admitad', 'unconfigured', false, NULL, NULL,
   ARRAY['ADMITAD_CLIENT_ID','ADMITAD_CLIENT_SECRET','ADMITAD_CAMPAIGN_ID'],
   '{"deep_links": "unknown", "postback": "unknown", "reporting_api": "unknown"}'::jsonb,
   '{"deep_link_template": null, "subid_param": null, "postback_secret_env": "ADMITAD_POSTBACK_SECRET"}'::jsonb,
   'Affiliate link — SceneAI may earn a commission.',
   'Template only. Awaiting campaign/website ID and tracking-link format.'),
  ('direct-merchant', 'Direct merchant / venue partnerships', 'direct_merchant', 'direct', 'unconfigured', false, NULL, NULL,
   ARRAY[]::text[],
   '{"deep_links": true, "postback": "manual", "reporting_api": false}'::jsonb,
   '{"deep_link_template": null, "subid_param": "sceneai_ref"}'::jsonb,
   'Partner link — SceneAI has a commercial arrangement with this venue.',
   'Use for CPA / CPL / CPS / revenue-share / booking-fee / fixed-sponsorship deals agreed directly with a venue or organiser. Add one merchant_partnerships row per signed deal.')
ON CONFLICT (slug) DO NOTHING;
