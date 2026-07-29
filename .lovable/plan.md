## Goal

Let a job/quote/invoice optionally carry a start time, set a global "warn me X minutes before" setting, and get a device notification when a scheduled job is nearly due.

## 1. Optional time on the document

- Add an optional `scheduledTime` (HH:mm) alongside the existing scheduled date. Currently the docs table only stores `scheduled_date` — a new nullable `scheduled_time` column is needed, plus mapping in the sync layer.
- In the document editor, next to the date picker, add a "Start time (optional)" control with a clear button.
- Picker is roller-based, no typing: a bottom sheet with three snap-scroll wheel columns (hour 00–23, minute in 5-minute steps, plus a quick "Now / Clear" row). Same visual language as the existing date picker button (outline button showing e.g. "08:30" or "Set time").
- Time shows on the planner job cards (agenda, week, month) before the customer name, and on the quote/invoice PDF line where the scheduled date already appears.

## 2. Reminder lead time in Settings

- New "Reminders" card in Settings:
  - Toggle: enable job reminders.
  - Lead time chosen with a roller (5, 10, 15, 30, 45, 60, 90, 120 minutes) — no typing.
  - Button to grant device notification permission, showing current status (granted / blocked / not asked).
- Stored with the rest of the billing/company profile settings so it syncs to the cloud.

## 3. Notification behaviour

- A small scheduler runs while the app is open: every 30s it checks jobs with a date+time today, and fires one notification per job when now is within the lead window and the job hasn't fired yet.
- Uses the browser Notification API (title = customer name, body = job type + address), falling back to an in-app toast if permission isn't granted.
- Fired reminders are remembered per document per day so the same job doesn't re-notify on every refresh or tab focus.

## Technical notes

- DB migration: `ALTER TABLE public.docs ADD COLUMN scheduled_time text` (nullable); no policy changes needed.
- New `src/components/app/TimePicker.tsx` (wheel sheet) and `src/components/app/WheelSelect.tsx` shared by the settings lead-time roller.
- New `src/lib/reminders.ts` holding the check loop; mounted once in `Shell.tsx` so it runs on every page.
- Reminder settings extend `BillingSettings` in `src/lib/store.ts` (`remindersEnabled`, `reminderLeadMin`) and are pushed via the existing `pushCompanyProfile()` path.

## Limitation to be aware of

Web notifications only fire while the app is open in a browser tab (or installed to the home screen and running). True background push while the app is fully closed needs a service worker plus push service — not included here unless you want that as a follow-up.
