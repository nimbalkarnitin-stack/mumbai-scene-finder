CREATE TYPE public.discovery_status AS ENUM ('DISCOVERED','SOURCE_FOUND','VALIDATED','INGESTED','REJECTED');

CREATE TABLE public.discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  entity_type public.item_type NOT NULL DEFAULT 'venue',
  name text NOT NULL,
  status public.discovery_status NOT NULL DEFAULT 'DISCOVERED',
  discovery_method text NOT NULL,
  discovery_query text,
  external_ref text,
  source_url text,
  domain text,
  official_website_url text,
  events_page_url text,
  confidence numeric NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_entity_type public.item_type,
  linked_entity_id uuid,
  linked_source_id uuid REFERENCES public.ingestion_sources(id) ON DELETE SET NULL,
  notes text,
  last_error text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_discovery_candidates_identity ON public.discovery_candidates (discovery_method, lower(name), COALESCE(domain, ''));
CREATE INDEX idx_discovery_candidates_status ON public.discovery_candidates (status, next_check_at);
CREATE INDEX idx_discovery_candidates_domain ON public.discovery_candidates (domain);

CREATE TABLE public.discovery_source_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  url text NOT NULL,
  domain text,
  kind text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'candidate',
  has_structured_data boolean NOT NULL DEFAULT false,
  structured_kinds text[] NOT NULL DEFAULT '{}',
  validation_notes text,
  http_status integer,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, url)
);

CREATE INDEX idx_discovery_source_candidates_candidate ON public.discovery_source_candidates (candidate_id);

CREATE TABLE public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  entity_type public.item_type,
  entity_id uuid,
  platform text NOT NULL,
  handle text,
  profile_url text NOT NULL,
  source_type public.ingestion_source_type NOT NULL DEFAULT 'social_api',
  verification_state public.verification_state NOT NULL DEFAULT 'UNVERIFIED',
  authorised_api boolean NOT NULL DEFAULT false,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, profile_url)
);

CREATE TABLE public.field_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.item_type NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  value_text text,
  source_record_id uuid REFERENCES public.source_records(id) ON DELETE CASCADE,
  source_name text,
  source_type public.ingestion_source_type,
  source_url text,
  authority_level integer,
  confidence numeric NOT NULL DEFAULT 0,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field, source_name)
);

CREATE INDEX idx_field_provenance_entity ON public.field_provenance (entity_type, entity_id);

CREATE TABLE public.field_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.item_type NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  conflicting_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution text,
  UNIQUE (entity_type, entity_id, field)
);

CREATE INDEX idx_field_conflicts_status ON public.field_conflicts (status, detected_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_candidates TO authenticated;
GRANT ALL ON public.discovery_candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_source_candidates TO authenticated;
GRANT ALL ON public.discovery_source_candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_profiles TO authenticated;
GRANT ALL ON public.social_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_provenance TO authenticated;
GRANT ALL ON public.field_provenance TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_conflicts TO authenticated;
GRANT ALL ON public.field_conflicts TO service_role;

ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_source_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage discovery candidates" ON public.discovery_candidates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage discovery source candidates" ON public.discovery_source_candidates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage social profiles" ON public.social_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage field provenance" ON public.field_provenance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage field conflicts" ON public.field_conflicts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_discovery_candidates_updated_at BEFORE UPDATE ON public.discovery_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();