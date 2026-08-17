DELETE FROM public.docs
WHERE type = 'job'
  AND gcal_event_id IS NOT NULL
  AND created_at > now() - interval '3 hours'
  AND items = '[]'::jsonb;

UPDATE public.docs
SET gcal_event_id = NULL, gcal_etag = NULL, gcal_synced_at = NULL
WHERE gcal_event_id IS NOT NULL;

UPDATE public.calendar_settings
SET enabled = false, calendar_id = NULL, calendar_name = NULL, sync_token = NULL, last_sync_at = NULL;