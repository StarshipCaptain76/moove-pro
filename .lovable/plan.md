## Goal

Produce a single markdown file listing every change made since 21 July 2026, in chronological order, written as phased, copy-paste-able instructions so the same changes can be applied to a similar project.

## Output

`/mnt/documents/moove-updates-since-jul-21.md` (also saved into the repo as `docs/updates-since-jul-21.md` so it stays with the project).

## Structure of the file

```text
# MOOVE — updates since 21 July 2026

## How to use
One phase at a time; each phase is a self-contained prompt.

## Phase 1 — <theme>
Date: 2026-07-2X
Prompt: "<verbatim-style instruction to paste into the other project>"
What changes: bullet list of behaviour
Files/areas touched: ...
Database: SQL if any
Verify: what to click/see to confirm
```

Phases follow the real chronological order of the work, grouped only where consecutive edits belong to one feature (e.g. the stops feature and its follow-ups).

## Phases to be documented (chronological)

1. Planner month view — unpaid shown as a small red dot instead of a badge that hides job details.
2. Job card simplification — job type hides items/totals/deposit/route/share; notes relabelled "What needs to be done".
3. Job card — optional phone and email fields restored.
4. Signed-out gate in the app shell — no data, no nav, "Sign in required" prompt.
5. Optional start time + reminders — `scheduled_time` column, `WheelSelect`/`TimePicker` roller components, reminder lead-time setting, web notification scheduler.
6. Start time shown on Agenda, Week and Month planner cards.
7. Reorderable extra route stops — `stops` jsonb column, sync mapping, Routes API intermediates, editor stop list with add/remove/reorder, PDF + share message + planner map.
8. Promote a stop (or the To address) into an empty From field.
9. Distance calculation shows estimated trip value at the settings per-km rate, on-screen only (never printed on quote/invoice).

## Technical notes

- Content sourced from the chat history from 21 July onward plus the current state of the touched files, so each phase's SQL and behaviour description matches what actually shipped.
- SQL is written as idempotent `alter table ... add column if not exists` statements with the existing owner-scoped RLS left unchanged.
- No application code changes — this task only writes the markdown file.
