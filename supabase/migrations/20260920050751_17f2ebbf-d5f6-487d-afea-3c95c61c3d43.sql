ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organiser text;

-- Backfill from the event's own linked source record (normalised payload) where present.
UPDATE public.events e
SET organiser = sr.normalised->>'organiser'
FROM public.source_records sr
WHERE e.source_record_id = sr.id
  AND e.organiser IS NULL
  AND NULLIF(sr.normalised->>'organiser', '') IS NOT NULL;