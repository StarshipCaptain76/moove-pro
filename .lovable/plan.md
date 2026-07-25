## Goal
Add a third creation option on Home (and the + FAB) called **New Job** — a lightweight job card that captures the essentials (schedule, customer, address, work type, notes) before pricing is known. A job card can later be converted into a Quote or straight into an Invoice, and appears in the Planner alongside quotes/invoices with its own identifier.

## Concept: "job" as a third DocType
Reuse the existing `docs` table + editor rather than build a parallel system. Extend `DocType` to `"quote" | "invoice" | "job"`, so jobs benefit for free from sync, planner, editing, address autocomplete, and multi-day scheduling.

### Data model (additive, no destructive migration)
- `DocType` gains `"job"`.
- New optional `jobCategory` on `Doc`: `"furniture" | "garden_rubble" | "grass_treatment" | "trimming" | "other"`.
- New numbering series in `BillingSettings`: `jobPrefix` (default `"JOB"`) + `nextJobNo` (default 1).
- DB: add `job_category text` and `job_prefix`/`next_job_no` to `company_profile`; `docs.type` check constraint widened to include `'job'`.

### New Job creation flow
- Shell FAB sheet gets a third option **"New Job"** (above Quote/Invoice, since it's the earliest stage).
- Creating a job routes to `/doc/$id` with `type: 'job'`, `status: 'draft'`, number `JOB-1`, no items required.
- Doc editor, when `type === 'job'`:
  - Shows a **Work type** selector (Furniture / Garden rubble / Grass treatment / Trimming / Other) bound to `jobCategory`.
  - Requires **Scheduled date** and **Customer name + address** up front (rest optional).
  - Line items + totals section collapses to an optional "Estimated price" single-line entry (stored as one line item so conversion is seamless). No deposit/VAT UI.
  - Header actions: **Convert to Quote** and **Convert to Invoice** (in addition to existing Save/Delete). Conversion flips `type`, assigns the next quote/invoice number, keeps everything else, and navigates to the same doc.

### Home page
- Add a third primary create button so users don't need to open the FAB: `[New Job] [New Quote] [New Invoice]` row above the stat grid. Same actions from the FAB sheet.
- Optional: a small "Open jobs" count on the stat grid (jobs not yet converted).

### Planner integration
- Jobs are included in agenda/week/month views using `scheduledDate` (+ optional end date) just like invoices/quotes.
- Job cards are color-coded by `jobCategory` (distinct palette from existing status colours):
  - Furniture — indigo, Garden rubble — amber, Grass treatment — emerald, Trimming — lime, Other — sky (reuses current "other" style).
- Card label shows the JOB number as the unique identifier plus category + customer, matching the current three-line card layout.
- Google Maps pins in Agenda view include jobs (uses existing `fromCoords`).
- Job status stays `draft` until converted; once converted, the doc's `type` changes and it renders as a quote/invoice card.

### Buckets & status
- Home status panels (Invoices/Quotes) unchanged. Jobs are not counted in either panel — they're pre-quote work.
- Auto-cleanup effect in `src/routes/index.tsx` skips jobs (jobs don't need customer+total to leave draft; a job's whole purpose can be schedule-only).

### PDF / share
- Jobs are not printed/emailed as quotes; the Share / PDF buttons in the editor are hidden for `type === 'job'` (they reappear after conversion).

## Files touched
- `src/lib/store.ts` — extend `DocType`, add `jobCategory`, add `jobPrefix`/`nextJobNo` to billing, extend `nextDocNumber` for `"job"`.
- `src/lib/sync.ts` + `src/integrations/supabase/types.ts` awareness — persist new fields.
- Migration — widen `docs.type` check; add `job_category` column; add `job_prefix`/`next_job_no` to `company_profile`.
- `src/components/app/Shell.tsx` — third button in the create sheet; wires to `create("job")`.
- `src/routes/index.tsx` — add top row of three create buttons; skip jobs in auto-promote/auto-delete effect.
- `src/routes/doc.$id.tsx` — job-mode UI (work type selector, simplified totals, Convert to Quote/Invoice actions, hide PDF/share).
- `src/routes/doc..tsx` — mirror for the "new" route if it also renders the editor.
- `src/routes/planner.tsx` — include jobs in all views, colour-code by category, show JOB number, include in map.
- `src/lib/doc-buckets.ts` — ensure job-type docs are ignored by invoice/quote buckets.

## Out of scope
- No jobs bucket panel on Home (kept minimal); can be added later.
- No separate jobs table; reusing `docs` keeps sync + planner code paths single-sourced.
- No changes to expenses/settings other than the JOB numbering row in Settings → Billing (mirrors existing quote/invoice numbering).
