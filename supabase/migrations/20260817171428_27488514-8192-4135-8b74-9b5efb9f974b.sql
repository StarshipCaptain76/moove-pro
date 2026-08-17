ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS gcal_event_id text,
  ADD COLUMN IF NOT EXISTS gcal_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS gcal_etag text;

CREATE INDEX IF NOT EXISTS docs_gcal_event_id_idx ON public.docs (owner_user_id, gcal_event_id);

CREATE TABLE IF NOT EXISTS public.calendar_settings (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text,
  calendar_name text,
  enabled boolean NOT NULL DEFAULT false,
  sync_token text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_settings TO authenticated;
GRANT ALL ON public.calendar_settings TO service_role;

ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own calendar_settings" ON public.calendar_settings;
CREATE POLICY "own calendar_settings" ON public.calendar_settings
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP TRIGGER IF EXISTS calendar_settings_updated_at ON public.calendar_settings;
CREATE TRIGGER calendar_settings_updated_at
  BEFORE UPDATE ON public.calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();