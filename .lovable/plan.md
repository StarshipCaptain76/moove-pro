# Two-way Google Calendar sync

Keep the planner and Dylan's Google Calendar in step: scheduled jobs, invoices and quotes appear as calendar appointments, and new Google events come back as Job cards.

## How it works

- Connect the Google Calendar account once (single-user app, Dylan's account) via the Google Calendar connector.
- In Settings, a new "Google Calendar" card lets Dylan pick which calendar to sync to from a dropdown of his Google calendars, plus an on/off switch and a "Sync now" button.
- Outbound: any doc (job, invoice or quote) with a scheduled date is written to that calendar as an event. Multi-day jobs span start..end; if a start time is set the event is timed (default 2h), otherwise it's an all-day event.
  - Title: `{number} — {customer name}` (plus job category for jobs)
  - Location: from/to addresses and stops
  - Description: notes, distance, total, and a link back to the doc in the app
  - Editing or deleting a doc updates/removes its event.
- Inbound: events on the chosen calendar that the app did not create become Job cards (customer name from the event title, address from location, notes from description, scheduled date/time from the event). Events the app created are skipped so nothing duplicates.
- Conflicts: most recent edit wins — the doc's `updated_at` is compared with the Google event's `updated` timestamp, and the newer side overwrites the older.
- Sync runs when the planner or settings page opens, after a doc is saved, and on "Sync now". Deletions on either side propagate.

## Technical outline

1. **Connector**: link the `google_calendar` App connector; server-side calls go through the Lovable gateway base `https://connector-gateway.lovable.dev/google_calendar/calendar/v3`.
2. **Schema** (migration, with GRANTs + RLS scoped to `auth.uid()`):
   - `docs`: add `gcal_event_id text`, `gcal_synced_at timestamptz`, `gcal_etag text`.
   - New `calendar_settings` (owner_user_id pk, calendar_id, enabled, sync_token, last_sync_at).
3. **Server functions** in `src/lib/calendar.functions.ts`, all behind `requireSupabaseAuth`:
   - `listCalendars` — for the settings dropdown.
   - `saveCalendarSettings`.
   - `syncCalendar` — one function doing both directions:
     - push: for each owned doc with a scheduled date and not archived/cancelled, insert or patch its event when `updated_at > gcal_synced_at`; delete events for removed/unscheduled docs.
     - pull: incremental `events.list` with the stored `syncToken` (full list fallback on 410); skip events whose id matches a doc's `gcal_event_id` unless the Google `updated` is newer than the doc — then patch the doc; create new Job docs for unknown events; mark docs deleted when their event is cancelled.
     - returns counts `{ pushed, pulled, created, deleted }` and stores the new sync token.
4. **Mapping helpers** in `src/lib/calendar-map.ts` (pure, unit-testable): doc -> Google event body, and Google event -> Job doc fields.
5. **UI**:
   - `src/routes/settings.tsx`: Google Calendar card (connect state, calendar dropdown, enable switch, Sync now, last-synced text, result toast).
   - `src/routes/planner.tsx`: sync on mount when enabled, and a small sync status/refresh control in the header.
   - `src/lib/sync.ts`: after a doc push, trigger a debounced calendar sync so calendar stays current.
6. Google events created by the app carry `extendedProperties.private.mooveDocId` so both sides can be matched even if an id is lost.

## Notes

- Requires the Google Calendar connector to be linked before sync works; until then the Settings card shows a "Connect Google Calendar" state.
- Inbound events become Jobs with no line items or price — Dylan can convert them to a quote/invoice as usual.
