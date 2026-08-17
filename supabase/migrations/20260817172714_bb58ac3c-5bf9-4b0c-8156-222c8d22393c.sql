CREATE TABLE public.calendar_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  calendar_name text,
  sync_token text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, calendar_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_sources TO authenticated;
GRANT ALL ON public.calendar_sources TO service_role;

ALTER TABLE public.calendar_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own calendar_sources" ON public.calendar_sources
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

ALTER TABLE public.docs ADD COLUMN IF NOT EXISTS gcal_calendar_id text;

INSERT INTO public.calendar_sources (owner_user_id, calendar_id, calendar_name)
SELECT owner_user_id, calendar_id, calendar_name
FROM public.calendar_settings
WHERE calendar_id IS NOT NULL
ON CONFLICT DO NOTHING;