CREATE TABLE public.swiggy_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issuer text NOT NULL,
  redirect_uri text NOT NULL,
  client_id text NOT NULL,
  client_secret text,
  authorization_endpoint text NOT NULL,
  token_endpoint text NOT NULL,
  registration_client_uri text,
  scope text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (issuer, redirect_uri)
);
GRANT ALL ON public.swiggy_clients TO service_role;
ALTER TABLE public.swiggy_clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.swiggy_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  state text NOT NULL UNIQUE,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  client_row_id uuid REFERENCES public.swiggy_clients(id) ON DELETE CASCADE,
  return_path text,
  consumed_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.swiggy_oauth_states TO service_role;
ALTER TABLE public.swiggy_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE INDEX swiggy_oauth_states_user_idx ON public.swiggy_oauth_states (user_id, created_at DESC);

CREATE TABLE public.swiggy_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  token_type text NOT NULL DEFAULT 'Bearer',
  scope text,
  expires_at timestamp with time zone NOT NULL,
  connected_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  last_error_class text,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.swiggy_connections TO service_role;
ALTER TABLE public.swiggy_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.swiggy_call_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  server text NOT NULL,
  tool text NOT NULL,
  outcome text NOT NULL,
  http_status integer,
  duration_ms integer,
  retries integer NOT NULL DEFAULT 0,
  error_class text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.swiggy_call_metrics TO service_role;
ALTER TABLE public.swiggy_call_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX swiggy_call_metrics_created_idx ON public.swiggy_call_metrics (created_at DESC);

CREATE TRIGGER swiggy_clients_updated_at BEFORE UPDATE ON public.swiggy_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER swiggy_connections_updated_at BEFORE UPDATE ON public.swiggy_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();