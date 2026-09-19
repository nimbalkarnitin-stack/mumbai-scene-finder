-- pg_net cannot be moved with SET SCHEMA, so reinstall it into extensions.
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_ingestion(_task text, _body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_base text;
  v_token text;
  v_request_id bigint;
BEGIN
  IF _task NOT IN ('orchestrate','ingest-source','normalise-record','deduplicate-records','verify-catalogue','expire-events','health') THEN
    RAISE EXCEPTION 'Unknown ingestion task: %', _task;
  END IF;

  SELECT value->>'base_url' INTO v_base FROM public.ingestion_settings WHERE key = 'ingestion_endpoint';
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'ingestion_cron_token';
  IF v_base IS NULL OR v_token IS NULL THEN
    RAISE NOTICE 'Ingestion endpoint or token not configured; skipping %', _task;
    RETURN NULL;
  END IF;

  SELECT extensions.http_post(
    url := v_base || '/api/public/ingestion/' || _task,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_token),
    body := _body,
    timeout_milliseconds := 55000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_ingestion(text, jsonb) FROM PUBLIC, anon, authenticated;