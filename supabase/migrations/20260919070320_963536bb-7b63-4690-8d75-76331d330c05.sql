CREATE POLICY "No app access to cron tokens" ON public.ingestion_cron_tokens
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
COMMENT ON TABLE public.ingestion_cron_tokens IS 'Service-role only: sha256 hashes of scheduler tokens. No app-user access by design.';