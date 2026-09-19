ALTER TYPE public.verification_state ADD VALUE IF NOT EXISTS 'PARTIALLY_VERIFIED';
ALTER TYPE public.ingestion_source_type ADD VALUE IF NOT EXISTS 'discovery';