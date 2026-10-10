DROP POLICY IF EXISTS "Monetisation settings are readable" ON public.monetisation_settings;
CREATE POLICY "Public monetisation config keys readable" ON public.monetisation_settings FOR SELECT TO anon, authenticated
  USING (key IN ('ranking_weight','attribution','disclosure'));

DROP POLICY IF EXISTS "Areas public read" ON public.areas;
CREATE POLICY "Areas public read active" ON public.areas FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Categories public read" ON public.categories;
CREATE POLICY "Categories public read active" ON public.categories FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Cities public read" ON public.cities;
CREATE POLICY "Cities public read active" ON public.cities FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'));