
ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_type_check;
ALTER TABLE public.docs ADD CONSTRAINT docs_type_check CHECK (type = ANY (ARRAY['quote'::text, 'invoice'::text, 'job'::text]));
ALTER TABLE public.docs ADD COLUMN IF NOT EXISTS job_category text;
