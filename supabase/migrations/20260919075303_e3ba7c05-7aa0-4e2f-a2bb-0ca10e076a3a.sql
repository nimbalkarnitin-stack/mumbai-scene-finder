-- Scheduling for the ingestion pipeline: pg_cron triggers the authenticated
-- ingestion endpoints over pg_net using a secret stored in Vault.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurable base URL for the app that hosts the ingestion endpoints.
INSERT INTO public.ingestion_settings (key, value, description)
VALUES (
  'ingestion_endpoint',
  jsonb_build_object('base_url', 'https://project--9a9f454f-a341-49b1-9de2-76970e72077e-dev.lovable.app'),
  'Base URL the scheduler calls for /api/public/ingestion/* tasks.'
)
ON CONFLICT (key) DO NOTHING;

-- One-time scheduler token: plaintext kept in Vault, only its hash in the table.
DO $$
DECLARE v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ingestion_cron_tokens WHERE label = 'pg_cron') THEN
    v_token := encode(gen_random_bytes(32), 'hex');
    PERFORM vault.create_secret(v_token, 'ingestion_cron_token', 'Bearer token pg_cron uses for ingestion endpoints');
    INSERT INTO public.ingestion_cron_tokens (label, token_sha256)
    VALUES ('pg_cron', encode(digest(v_token, 'sha256'), 'hex'));
  END IF;
END $$;

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

  SELECT net.http_post(
    url := v_base || '/api/public/ingestion/' || _task,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_token),
    body := _body,
    timeout_milliseconds := 55000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_ingestion(text, jsonb) FROM PUBLIC, anon, authenticated;

-- Recreate schedules idempotently so redeploys never duplicate jobs.
DO $$
DECLARE v_job text;
BEGIN
  FOREACH v_job IN ARRAY ARRAY['sceneai-ingest-near-term','sceneai-ingest-daily-full','sceneai-expire-events','sceneai-ingest-health'] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job) THEN
      PERFORM cron.unschedule(v_job);
    END IF;
  END LOOP;
END $$;

-- Near-term refresh: every 2 hours.
SELECT cron.schedule('sceneai-ingest-near-term', '0 */2 * * *', $$SELECT public.trigger_ingestion('orchestrate', '{"mode":"near"}'::jsonb);$$);
-- Full source refresh: 03:00 Asia/Kolkata = 21:30 UTC.
SELECT cron.schedule('sceneai-ingest-daily-full', '30 21 * * *', $$SELECT public.trigger_ingestion('orchestrate', '{"mode":"full"}'::jsonb);$$);
-- Expiry cleanup: hourly.
SELECT cron.schedule('sceneai-expire-events', '15 * * * *', $$SELECT public.trigger_ingestion('expire-events');$$);
-- Health aggregation: 04:00 Asia/Kolkata = 22:30 UTC.
SELECT cron.schedule('sceneai-ingest-health', '30 22 * * *', $$SELECT public.trigger_ingestion('health');$$);