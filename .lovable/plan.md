# Plan: Compile edits since 13 July into an actionable MD file

Deliverable: single file at `/mnt/documents/moove-edits-since-jul-13.md` that can be dropped into another app and replayed prompt-by-prompt. No code in this app changes.

Source: user messages #203–#251 (2026-07-14 → 2026-07-15). Grouped where several related prompts can be collapsed into one clear instruction to minimise round-trips.

## File contents (final)

````markdown
# Replay Prompts — edits from 14–15 July 2026

Prompts are ordered by area. Each block is a single self-contained prompt to paste into the target app. Groups collapse follow-up "did not work" iterations into the final intended behaviour.

## 1. Expenses — data loading & display

> Expenses captured today are saved to the DB but disappear from the Expenses page after loading. Two root causes: (a) Zustand `persist` rehydrates from localStorage asynchronously and overwrites the fresh cloud data set by `loadAll()`; (b) the cloud fetch is capped at 1000 rows so newer expenses past the cap never load. Fix both: gate `loadAll()` to run after persist rehydration completes (or merge instead of replace), and paginate the cloud fetch in `src/lib/sync.ts` so all rows are retrieved regardless of count.

## 2. Expenses — visual summary

> On the Expenses page: (1) colour-code each expense row by its category using a deterministic hash → OKLCH hue so colours are stable and theme-friendly; (2) add a donut/pie chart at the top summarising the current month's expenses by category, using recharts. Keep the existing monthly expense list visible directly below the chart — do not let the summary push it off-screen; use a compact chart height and a scrollable list beneath.

## 3. Expense categories — stop phantom duplicates

> Expense categories are silently gaining duplicates. Categories must only mutate when the user explicitly adds, renames, or deletes one. Audit every code path that writes to the categories list (imports, expense upserts, sync merges) and ensure none of them append or create categories as a side effect. Historical/bank imports must map unknown categories to "Other" instead of creating new ones.

## 4. Quotes & Invoices PDF

> On generated quote and invoice PDFs:
> - Add a FROM / TO route block between the customer details and the line-items table, showing the departure and destination addresses in a subtle branded (green) box, with address text wrapped to fit half the page width each.
> - Add a non-intrusive footer on every page reading "Powered by KWOUT.co.za".

## 5. Mobile layout — safe area

> Increase the top buffer of the app shell so the top navigation bar is not overlapped by the phone's status bar (time/carrier), and add matching bottom safe-area padding so the home-indicator line does not sit on top of content. Use `env(safe-area-inset-top/bottom)`.

## 6. Planner — which docs appear

Consolidated fixes for the planner data feed:

> In the planner:
> 1. Show invoices with any status (draft/sent/accepted/paid), not only `accepted`, so newly created invoices appear immediately.
> 2. Respect `archived` — archived docs must never appear in the "Unscheduled jobs" list or on any day.
> 3. Paid invoices without a `scheduledDate` are historical/closed jobs: exclude them from Unscheduled entirely. They should still render on their `paidAt` day in agenda/week/month views, but must not appear in two places at once.
> 4. Add a bulk action on the Unscheduled bar to archive all currently listed unscheduled jobs in one click (used to clear ~394 historical entries).

## 7. Planner — job card design

Consolidated from several iterations. Final target layout for every job card (agenda, week, and month/mini views):

```
Emmerentia                                       [payment dot]
INV-1256 · Versveld st, Still Bay West, Still Bay
FURNITURE                                                R1200
```

> Redesign the planner job card so it matches this three-line layout in agenda, week, and month views:
> - Line 1: customer name, with the payment indicator right-aligned on the same row.
> - Line 2: invoice/quote number, a separator, then the address — truncate with ellipsis, never overflow the card.
> - Line 3: job type/category on the left, price right-aligned on the same row.
> Use `min-w-0` and `truncate` on the flex children so nothing spills outside the card, especially in the narrower agenda column. Apply the same layout everywhere; no view-specific variants.

## 8. Planner — custom/"other" category styling

> When a job's category resolves to "other" (e.g. custom types like INV-1264), do not render the card as a near-black `bg-secondary` tile — it looks broken in dark mode. Use a soft sky/neutral tinted background with readable foreground, matching the palette used for the other category tiles.

## 9. Planner — show notes on "other" jobs

> For jobs whose category is "other", render `doc.notes` inside the job card (2-line clamp, preserve whitespace) so the user can see what the custom job is about without opening it. Only for "other"; skip on the tiny month cards where there isn't room.

## 10. Multi-day jobs

> Allow a job to span multiple days on the planner:
> - Add a "Multi-day job" toggle on the create/edit invoice screen. When on, reveal an end-date picker.
> - Persist `scheduledEndDate` on the doc (new nullable `date` column on the `docs` table; update the store type, sync read/write, and generated types).
> - In the planner, render the job on every day from `scheduledDate` through `scheduledEndDate` inclusive. When a user drags a multi-day job, preserve its span (shift end date by the same delta as start).

## 11. Multi-day jobs — visual linkage

> Multi-day jobs currently look like separate jobs on each day. Add a clear visual indicator that continuation days belong to the same job:
> - Show a "Day X/N" pill with a link/chain icon on every day of the span.
> - Style continuation days (day 2 onward) differently from the first day — dashed left border, slightly muted — so at a glance it's obvious they are the tail of a job that started earlier.
> Apply consistently to agenda, week, and month cards.
````

## Steps

1. Ensure `/mnt/documents/` exists (it does).
2. Write the file above to `/mnt/documents/moove-edits-since-jul-13.md`.
3. Emit a `<presentation-artifact>` tag so the user can download it.

No source files in this project are modified.
