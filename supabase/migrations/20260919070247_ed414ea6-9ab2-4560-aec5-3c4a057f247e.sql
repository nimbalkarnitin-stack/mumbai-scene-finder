-- ===== enums =====
CREATE TYPE public.verification_state AS ENUM ('VERIFIED','REVIEW_REQUIRED','STALE','UNVERIFIED');
CREATE TYPE public.event_lifecycle AS ENUM ('DRAFT','PENDING_REVIEW','ACTIVE','SOLD_OUT','POSTPONED','CANCELLED','EXPIRED');
CREATE TYPE public.ingestion_source_type AS ENUM ('official_site','organiser_submission','partner_feed','ticketing_api','social_api');
CREATE TYPE public.ingestion_job_status AS ENUM ('running','success','partial','failed');

-- ===== ingestion_sources =====
CREATE TABLE public.ingestion_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  source_type public.ingestion_source_type NOT NULL,
  adapter_key text NOT NULL,
  base_url text,
  enabled boolean NOT NULL DEFAULT false,
  authority_level int NOT NULL DEFAULT 3 CHECK (authority_level BETWEEN 1 AND 5),
  refresh_interval_minutes int NOT NULL DEFAULT 1440 CHECK (refresh_interval_minutes >= 15),
  requires_credentials boolean NOT NULL DEFAULT false,
  credential_env_keys text[] NOT NULL DEFAULT '{}',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status public.ingestion_job_status,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingestion_sources TO authenticated;
GRANT ALL ON public.ingestion_sources TO service_role;
ALTER TABLE public.ingestion_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ingestion sources" ON public.ingestion_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ingestion_sources_updated_at BEFORE UPDATE ON public.ingestion_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX ingestion_sources_due_idx ON public.ingestion_sources (enabled, next_run_at);

-- ===== source_records =====
CREATE TABLE public.source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.ingestion_sources(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_type public.ingestion_source_type NOT NULL,
  source_url text,
  external_id text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  source_last_modified_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  fetch_status text NOT NULL DEFAULT 'pending' CHECK (fetch_status IN ('pending','ok','failed','skipped')),
  parse_status text NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending','ok','partial','failed','needs_review')),
  source_confidence numeric NOT NULL DEFAULT 0 CHECK (source_confidence BETWEEN 0 AND 100),
  verification_status public.verification_state NOT NULL DEFAULT 'UNVERIFIED',
  quality_score numeric,
  review_status text NOT NULL DEFAULT 'new' CHECK (review_status IN ('new','needs_review','approved','rejected','published','changed')),
  linked_entity_type public.item_type,
  linked_entity_id uuid,
  normalised jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_name, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_records TO authenticated;
GRANT ALL ON public.source_records TO service_role;
ALTER TABLE public.source_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage source records" ON public.source_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER source_records_updated_at BEFORE UPDATE ON public.source_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX source_records_hash_idx ON public.source_records (content_hash);
CREATE INDEX source_records_review_idx ON public.source_records (review_status, last_seen_at DESC);
CREATE INDEX source_records_linked_idx ON public.source_records (linked_entity_type, linked_entity_id);

-- ===== ingestion_jobs =====
CREATE TABLE public.ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.ingestion_sources(id) ON DELETE SET NULL,
  source_name text,
  job_type text NOT NULL,
  status public.ingestion_job_status NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_fetched int NOT NULL DEFAULT 0,
  records_created int NOT NULL DEFAULT 0,
  records_updated int NOT NULL DEFAULT 0,
  records_skipped int NOT NULL DEFAULT 0,
  records_failed int NOT NULL DEFAULT 0,
  error_summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingestion_jobs TO authenticated;
GRANT ALL ON public.ingestion_jobs TO service_role;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read ingestion jobs" ON public.ingestion_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX ingestion_jobs_started_idx ON public.ingestion_jobs (started_at DESC);
CREATE INDEX ingestion_jobs_source_idx ON public.ingestion_jobs (source_name, started_at DESC);

-- ===== duplicate_candidates =====
CREATE TABLE public.duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.item_type NOT NULL,
  primary_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  match_score numeric NOT NULL DEFAULT 0,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','merged','rejected')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, primary_id, candidate_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplicate_candidates TO authenticated;
GRANT ALL ON public.duplicate_candidates TO service_role;
ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage duplicate candidates" ON public.duplicate_candidates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER duplicate_candidates_updated_at BEFORE UPDATE ON public.duplicate_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ingestion_settings (quality weights + refresh cadence) =====
CREATE TABLE public.ingestion_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingestion_settings TO authenticated;
GRANT ALL ON public.ingestion_settings TO service_role;
ALTER TABLE public.ingestion_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ingestion settings" ON public.ingestion_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER ingestion_settings_updated_at BEFORE UPDATE ON public.ingestion_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ingestion_settings (key, value, description) VALUES
('quality_weights', '{"source_authority":30,"freshness":20,"date_confirmed":15,"price_confirmed":10,"venue_confirmed":10,"location_confirmed":5,"duplicate_confidence":5,"content_completeness":5}'::jsonb, 'Internal quality score weights (total 100).'),
('quality_gate', '{"publish_min":70,"review_min":45,"stale_after_hours":72}'::jsonb, 'Minimum internal score to publish, to route to review, and staleness window.'),
('refresh_cadence', '{"event_lt_48h_minutes":180,"event_3_to_14d_minutes":540,"event_gt_14d_minutes":1440,"venue_minutes":10080,"offer_minutes":540,"social_minutes":540}'::jsonb, 'How often each record class is refreshed (minutes).');

-- ===== cron token (service-role only; never readable by app users) =====
CREATE TABLE public.ingestion_cron_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  token_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ingestion_cron_tokens TO service_role;
ALTER TABLE public.ingestion_cron_tokens ENABLE ROW LEVEL SECURITY;

-- ===== catalogue provenance / verification columns =====
ALTER TABLE public.venues
  ADD COLUMN verification_status public.verification_state NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN quality_score numeric,
  ADD COLUMN source_record_id uuid REFERENCES public.source_records(id) ON DELETE SET NULL,
  ADD COLUMN source_name text,
  ADD COLUMN source_last_checked_at timestamptz,
  ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_seen_at timestamptz,
  ADD COLUMN next_refresh_at timestamptz;

ALTER TABLE public.experiences
  ADD COLUMN verification_status public.verification_state NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN quality_score numeric,
  ADD COLUMN source_record_id uuid REFERENCES public.source_records(id) ON DELETE SET NULL,
  ADD COLUMN source_name text,
  ADD COLUMN source_last_checked_at timestamptz,
  ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_seen_at timestamptz,
  ADD COLUMN next_refresh_at timestamptz;

ALTER TABLE public.offers
  ADD COLUMN verification_status public.verification_state NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN quality_score numeric,
  ADD COLUMN source_record_id uuid REFERENCES public.source_records(id) ON DELETE SET NULL,
  ADD COLUMN source_name text,
  ADD COLUMN source_url text,
  ADD COLUMN source_last_checked_at timestamptz,
  ADD COLUMN next_refresh_at timestamptz;

ALTER TABLE public.events
  ADD COLUMN verification_status public.verification_state NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN quality_score numeric,
  ADD COLUMN source_record_id uuid REFERENCES public.source_records(id) ON DELETE SET NULL,
  ADD COLUMN source_name text,
  ADD COLUMN source_last_checked_at timestamptz,
  ADD COLUMN first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_seen_at timestamptz,
  ADD COLUMN next_refresh_at timestamptz,
  ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN website_url text,
  ADD COLUMN age_min int,
  ADD COLUMN language text,
  ADD COLUMN occasion_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN lifecycle_status public.event_lifecycle NOT NULL DEFAULT 'DRAFT';

UPDATE public.events SET lifecycle_status = 'ACTIVE' WHERE is_active = true;
UPDATE public.events SET verification_status = 'VERIFIED' WHERE is_verified = true;
UPDATE public.venues SET verification_status = 'VERIFIED' WHERE is_verified = true;
UPDATE public.experiences SET verification_status = 'VERIFIED' WHERE is_verified = true;

-- keep is_active in step with the event lifecycle
CREATE OR REPLACE FUNCTION public.sync_event_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    NEW.is_active := (NEW.lifecycle_status = 'ACTIVE');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_event_lifecycle() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER events_lifecycle_sync BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_lifecycle();

CREATE INDEX events_lifecycle_idx ON public.events (lifecycle_status, starts_at);
CREATE INDEX events_refresh_idx ON public.events (next_refresh_at);
CREATE INDEX venues_refresh_idx ON public.venues (next_refresh_at);
CREATE INDEX experiences_refresh_idx ON public.experiences (next_refresh_at);
CREATE UNIQUE INDEX events_source_record_idx ON public.events (source_record_id) WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX venues_source_record_idx ON public.venues (source_record_id) WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX experiences_source_record_idx ON public.experiences (source_record_id) WHERE source_record_id IS NOT NULL;

-- ===== safe, non-secret initial source configuration =====
INSERT INTO public.ingestion_sources
  (city_id, slug, name, source_type, adapter_key, base_url, enabled, authority_level, refresh_interval_minutes, requires_credentials, credential_env_keys, config, notes)
VALUES
('11111111-1111-1111-1111-111111111111','official-venue-pages','Official venue & event pages','official_site','official_site',NULL,true,4,720,false,'{}',
 '{"pages":[],"allow_hosts":[],"max_bytes":1500000,"timeout_ms":8000}'::jsonb,
 'Add each venue''s own public events page URL under config.pages. Only official first-party pages; robots and rate limits are respected.'),
('11111111-1111-1111-1111-111111111111','organiser-submissions','Organiser & venue submissions','organiser_submission','organiser_submission',NULL,true,3,60,false,'{}',
 '{}'::jsonb,
 'Records submitted by organisers/venues. Always routed to review before publishing.'),
('11111111-1111-1111-1111-111111111111','partner-feed','Authorised partner feed (JSON/RSS/CSV)','partner_feed','partner_feed',NULL,false,3,360,false,'{}',
 '{"feed_url":null,"format":"json","items_path":null}'::jsonb,
 'Enable once an authorised partner feed URL is configured. Supports JSON, RSS and CSV.'),
('11111111-1111-1111-1111-111111111111','bookmyshow','BookMyShow (authorised API/feed)','ticketing_api','bookmyshow',NULL,false,5,240,true,'{BOOKMYSHOW_API_BASE_URL,BOOKMYSHOW_API_KEY}',
 '{"city":"mumbai"}'::jsonb,
 'Disabled until authorised API/feed access and credentials are provided. Without authorisation, BookMyShow is used only as a deep-link destination.'),
('11111111-1111-1111-1111-111111111111','instagram-professional','Instagram Professional (Meta Graph API)','social_api','instagram_professional',NULL,false,2,540,true,'{INSTAGRAM_GRAPH_ACCESS_TOKEN,INSTAGRAM_BUSINESS_ACCOUNT_ID}',
 '{"hashtags":[],"accounts":[]}'::jsonb,
 'Discovery/freshness signal only, never the authoritative booking record. Requires authorised Meta credentials.');
