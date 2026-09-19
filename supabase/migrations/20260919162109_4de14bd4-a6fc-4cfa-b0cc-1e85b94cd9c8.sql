-- 1. Query registry -------------------------------------------------------
CREATE TABLE public.google_discovery_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area text NOT NULL,
  category text NOT NULL,
  query_text text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 3,
  last_run_at timestamp with time zone,
  last_result_count integer,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_discovery_queries TO authenticated;
GRANT ALL ON public.google_discovery_queries TO service_role;
ALTER TABLE public.google_discovery_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage google discovery queries" ON public.google_discovery_queries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER google_discovery_queries_updated_at BEFORE UPDATE ON public.google_discovery_queries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_gdq_enabled_priority ON public.google_discovery_queries (enabled, priority, last_run_at NULLS FIRST);

-- 2. Request log ----------------------------------------------------------
CREATE TABLE public.google_api_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text NOT NULL,
  http_status integer,
  query_id uuid REFERENCES public.google_discovery_queries(id) ON DELETE SET NULL,
  place_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.google_api_requests TO authenticated;
GRANT ALL ON public.google_api_requests TO service_role;
ALTER TABLE public.google_api_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read google api requests" ON public.google_api_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_google_api_requests_created ON public.google_api_requests (created_at DESC);

-- 3. Candidate columns ----------------------------------------------------
ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS google_maps_uri text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_candidates_google_place
  ON public.discovery_candidates (google_place_id) WHERE google_place_id IS NOT NULL;

-- 4. Seed the AREA x CATEGORY registry -----------------------------------
WITH areas(area, tier) AS (
  VALUES
    ('Colaba',1),('Fort',1),('Kala Ghoda',2),('Nariman Point',2),('Marine Drive',2),('Churchgate',2),('Cuffe Parade',2),
    ('Mahalaxmi',2),('Worli',1),('Lower Parel',1),('Bandra',1),('Bandra West',1),('Bandra East',2),('Khar',2),
    ('Santacruz',2),('Juhu',1),('Vile Parle',2),('Andheri West',1),('Andheri East',2),('Powai',1),('Goregaon',2),
    ('Malad',2),('Kandivali',2),('Borivali',2),('BKC',1),('Kurla',2),('Ghatkopar',2),('Navi Mumbai',2),('Vashi',2),('Thane',1)
), cats(category, core) AS (
  VALUES
    ('restaurants',true),('cafes',true),('bars',true),('rooftop restaurants',false),('rooftop bars',true),('cocktail bars',true),
    ('breweries',true),('wine bars',false),('dessert cafes',false),('brunch',false),('fine dining',false),('casual dining',false),
    ('nightlife',false),('nightclubs',true),('lounges',false),('live DJ',false),('live music',true),('music venues',true),
    ('jazz',false),('acoustic music',false),('concert venues',false),('comedy clubs',true),('theatre',true),('performing arts',false),
    ('cinema',false),('cultural venues',false),('art galleries',true),('exhibitions',false),('museums',false),('workshops',true),
    ('cooking classes',false),('pottery',false),('art workshops',false),('wellness experiences',false),('immersive experiences',false),
    ('escape rooms',false),('gaming',false),('adventure',false),('parks',false),('beaches',false),('cycling',false),('trekking',false),
    ('outdoor experiences',false),('nature activities',false),('family activities',false),('kids activities',false),('bowling',false),
    ('indoor games',false),('social activities',false),('sports venues',false),('padel',false),('badminton',false),('football',false),
    ('cricket',false),('swimming',false),('fitness experiences',false),('things to do',true),('weekend activities',false),
    ('experiences',true),('attractions',false)
)
INSERT INTO public.google_discovery_queries (area, category, query_text, enabled, priority)
SELECT a.area, c.category, c.category || ' in ' || a.area || ', Mumbai',
       (c.core AND a.tier = 1),
       CASE WHEN c.core AND a.tier = 1 THEN 1 WHEN c.core THEN 2 ELSE 3 END
FROM areas a CROSS JOIN cats c
ON CONFLICT (query_text) DO NOTHING;