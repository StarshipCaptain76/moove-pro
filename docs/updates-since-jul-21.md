# MOOVE — updates since 21 July 2026

Chronological log of every change shipped from 21 July 2026 onward, written as
phased instructions so the same work can be reproduced in a similar project.

## How to use

Work through one phase at a time, in order. Each phase is self-contained:
paste the **Prompt** into the other project's AI builder (or hand it to a dev),
then use **Verify** to confirm before moving to the next phase.

Stack assumed: React + TanStack Start, Tailwind + shadcn/ui, zustand store with a
cloud (Supabase/Postgres) mirror, Google Maps connector, `sonner` toasts.

---

## Phase 1 — Planner month view: unpaid as a small dot

**Prompt**
> In the Planner month view, unpaid invoices/jobs are covered by a big red "UNPAID"
> badge so you can't see the customer or the job at all. Replace that badge with a
> small red dot indicator used consistently in Agenda, Week and Month views, so
> unpaid items show exactly the same information as paid ones.

**What changes**
- A single `PaymentIndicator` component renders a small red dot for unpaid items.
- No text label anywhere; the dot sits alongside the job title/number.
- Month cells keep customer name, job type and number fully visible.

**Files** `src/routes/planner.tsx`

**Verify** Month view: an unpaid job shows its name/number with a small red dot; a
paid job looks identical minus the dot.

---

## Phase 2 — Simplify the job card

**Prompt**
> Simplify the job card. For documents of type "job" you really only need the
> customer name, the address, what needs to be done, and the date. Hide line items,
> totals, deposit, route/distance calculation and the share/PDF actions for jobs.
> Relabel the Notes field to "What needs to be done".

**What changes**
- Document editor branches on `doc.type === "job"`:
  - hides items list, catalog picker, totals, deposit %, payment method
  - hides the route card and distance calculator
  - hides share / WhatsApp / email / PDF actions
- Notes textarea label becomes "What needs to be done".

**Files** `src/routes/doc.$id.tsx`

**Verify** Create a new job: only name, address, date/time, category and the
"What needs to be done" box are shown.

---

## Phase 3 — Optional phone and email back on the job card

**Prompt**
> On the job card, bring the phone number and email fields back — they may be
> available when a customer calls or emails to book the next day or a shuttle date.
> Mark them optional for jobs.

**What changes**
- Phone and Email inputs render for job type again, labelled "(optional)".
- Values still save onto the customer record and sync to the cloud.

**Files** `src/routes/doc.$id.tsx`

**Verify** Job editor shows Phone (optional) and Email (optional); saving a job
with them filled and reopening keeps the values.

---

## Phase 4 — Signed-out gate

**Prompt**
> If the user is not signed in, the app must show no data and no actions. Hide the
> nav menu, the mobile tab bar and all page content, and show a "SIGN IN REQUIRED"
> prompt with a link to the sign-in page instead.

**What changes**
- The app shell checks the auth session before rendering children.
- Signed out: header actions, sidebar/menu and bottom tab bar are not rendered;
  a centred "SIGN IN REQUIRED" panel with a sign-in button replaces the page.
- Signed in: unchanged behaviour.

**Files** `src/components/app/Shell.tsx`

**Verify** Sign out → every route shows the prompt only, with no cached expenses,
invoices or nav visible.

---

## Phase 5 — Optional start time + due-job reminders

**Prompt**
> When creating a job/quote, allow setting an optional start time. The time must be
> picked with sliders/rollers, never typed. In settings, let me set a warning lead
> time (e.g. 30 min); when a job is nearly due, fire a device notification.

**What changes**
- `Doc.scheduledTime` ("HH:mm", optional) added to the type and store.
- New `WheelSelect` — vertical snap-scroll wheel, haptic tick on change.
- New `TimePicker` — bottom sheet with hour (0–23) and minute (5-min steps)
  wheels, plus Now / Clear / Done buttons.
- Document editor shows the picker under the date; PDF header prints the time
  when set.
- New reminder scheduler: polls on an interval, and for each scheduled job whose
  start time is within the lead window fires a Web Notification (falls back to a
  toast when permission isn't granted). Fired reminders are de-duplicated per day
  in `localStorage`.
- Settings gains a "Job reminders" card: enable toggle, lead-time selector, and a
  button to request notification permission (shows current status).

**Database**
```sql
alter table public.docs add column if not exists scheduled_time text;
```
(existing owner-scoped RLS unchanged; add `scheduled_time` to the sync push/pull
mapping)

**Files** `src/components/app/WheelSelect.tsx` (new),
`src/components/app/TimePicker.tsx` (new), `src/lib/reminders.ts` (new),
`src/lib/store.ts`, `src/lib/sync.ts`, `src/routes/doc.$id.tsx`,
`src/routes/settings.tsx`, `src/lib/pdf.ts`

**Verify** Set a job for 15 minutes from now with reminders on and a 30-min lead →
a notification/toast appears; reloading doesn't fire it twice.

---

## Phase 6 — Show start time on planner cards

**Prompt**
> Add the time, if set, to the agenda, week and month cards for the applicable jobs.

**What changes**
- The month view `MiniJob` gains a compact time badge.
- Agenda and Week cards render the same `HH:mm` badge, so the start time is
  visible in all three views.

**Files** `src/routes/planner.tsx`

**Verify** A job with a time shows `08:30` on its card in Agenda, Week and Month.

---

## Phase 7 — Reorderable extra route stops

**Prompt**
> Quotes and invoices have a From and To address used to calculate distance. Allow
> extra stops to be added between them, calculate the total distance across the
> whole route, and let the stops be reordered.

**What changes**
- New `RouteStop` type: `{ id, address, coords? }`; `Doc.stops?: RouteStop[]`.
- Route card in the editor lists From, each stop (same Google address
  autocomplete as From/To), then To, with `+ Add stop`, up/down reorder arrows and
  a remove button per stop.
- Distance is computed for From → Stop 1 → … → To as one total, so reordering
  changes the result.
- PDF route block and the WhatsApp/email share message list the stops in order.
- Planner map draws the stops as waypoints/markers on the job route.
- Jobs keep the simplified card (no route/distance) from Phase 2.

**Database**
```sql
alter table public.docs add column if not exists stops jsonb not null default '[]'::jsonb;
```

**Server function** `routeDistance` gains an optional `stops` array (max 23),
passed to the Google Routes API `intermediates` field; it still returns the summed
`distanceMeters`.

**Files** `src/lib/store.ts`, `src/lib/sync.ts`, `src/lib/maps.functions.ts`,
`src/routes/doc.$id.tsx`, `src/lib/pdf.ts`, `src/lib/share-message.ts`,
`src/components/app/PlannerMap.tsx`

**Verify** Add two stops, calculate → total exceeds the direct distance; swap the
stops → the total changes; PDF and share text list From, Stop 1, Stop 2, To.

---

## Phase 8 — Promote a stop into an empty From

**Prompt**
> If there is no From address, let me move any of the other addresses up into the
> From slot.

**What changes**
- When From is empty, the first stop's up-arrow promotes that address (and its
  coords) into From and removes it from the stop list.
- An up-arrow also appears next to the To address in that state, promoting To
  into From.
- When From is filled, the arrows behave as ordinary reorder controls.

**Files** `src/routes/doc.$id.tsx`

**Verify** Clear From, press the up-arrow on Stop 1 → it becomes the From address.

---

## Phase 9 — Show the trip value next to the distance

**Prompt**
> When clicking "Calculate distance", show — after the distance — what the trip
> would be billed at using the per-km rate from settings. This is only for my own
> reference: it must not be added to the quote/invoice and must not print on the PDF.

**What changes**
- After calculating, the route card shows e.g. `38.4 km · ≈ R 576.00 at R 15/km`.
- Value is derived from `billing.ratePerKm`; nothing is written to line items,
  totals, the PDF or the share message.

**Files** `src/routes/doc.$id.tsx`

**Verify** Calculate a distance → the estimate appears on screen; generate the PDF
→ no such figure anywhere on it.

---

## Notes

- All SQL is idempotent (`add column if not exists`) and leaves the existing
  owner-scoped RLS policies untouched.
- Every new `docs` column must also be added to the sync push and pull mapping,
  otherwise the value is silently dropped on the next cloud refresh.
