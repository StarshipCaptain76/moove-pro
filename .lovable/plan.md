# Revenue page: date range + richer reporting

Upgrade `src/routes/results.tsx` so all KPIs and charts respect a user-selected period, and add more useful reporting angles.

## 1. Period selector (top of page, sticky under header)
Tap-only chips (no keyboard):
- **This month** (default), **Last month**, **This quarter**, **YTD**, **Last 12 months**, **This year**, **Last year**, **All time**, **Custom…**
- **Custom…** opens a popover with two shared `DatePicker`s (from/to) — reuses `src/components/app/DatePicker.tsx`.
- Also: a **Year** tumbler (◀ 2026 ▶) and **Month** tumbler visible when the "Month" or "Year" granularity is chosen.
- Persist last selection to the store (add `reportRange` to settings slice) so it survives navigation.

## 2. Scope everything through the range
Compute `from`/`to` ISO dates from the selection, then filter:
- `paid` invoices by `paidAt`
- `expenses` by `date`
- Outstanding stays "as of today" (labelled)
- All KPIs, pie charts and category list use the filtered sets.

## 3. Expanded KPI row
Two rows of stat tiles:
- Revenue, Expenses, **Net Profit**, **Margin %**
- **Invoices paid** (count), **Avg invoice value**, **Outstanding (all-time)**, **Overdue** (invoices past due date & unpaid)
Each tile shows a small **Δ vs previous period** (same length window immediately before) in green/red.

## 4. Charts (all respect range)
- **Revenue trend** — line/bar auto-bucketed by range length: ≤ 62 days → daily; ≤ 18 months → monthly; longer → yearly. Replaces the fixed 12-mo MoM.
- **Year-over-Year** — keep, but compare selected year vs previous year (driven by year tumbler).
- **Revenue by payment method** — pie + legend with amounts and %.
- **Revenue by service** — horizontal bar chart (top 8) instead of pie, easier to read on mobile; shows amount + % of total.
- **Expenses by category** — keep list, add % of expenses bar inline.
- **New: Cash flow** — grouped bar per bucket: Revenue vs Expenses, with Net line overlay.
- **New: Top customers** — table (top 5) by revenue in range, count of jobs, avg value.

## 5. Export / share
Add a small **Export CSV** button (period + all filtered rows: paid invoices and expenses in two sections). Client-side blob download, no backend.

## 6. Small polish
- Rename page title/heading to **"Revenue & Reports"**.
- Update route `head()` title/description accordingly.
- Show the active range as a subtle caption under the heading ("1 Jul – 31 Jul 2026 · vs Jun").

## Technical notes
- File touched: `src/routes/results.tsx` (main), `src/lib/store.ts` (add `reportRange` persisted setting, small helper `filterByRange`).
- New tiny component `src/components/app/RangePicker.tsx` encapsulating chips + custom popover + year/month tumblers, reusing existing `DatePicker` and `InlineTumbler`.
- CSV export helper inline in `results.tsx` (no new dep).
- No backend changes; all derived from existing `docs` / `expenses` in the Zustand store.

## Out of scope
- Persisting reports server-side.
- PDF export.
- Editing invoices/expenses from this page.
