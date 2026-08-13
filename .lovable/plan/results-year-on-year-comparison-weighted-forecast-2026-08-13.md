# Results: Year-on-year comparison + weighted forecast

Add two things to the Revenue & Reports page: a same-period-last-year comparison, and a forward forecast for the current month/period that is weighted by what the same period did in previous years.

Data supports it: paid invoices run from Nov 2024 to today, and expenses exist for every month since Nov 2024 — one full year-over-year overlap.

## 1. Year-on-year on the KPI cards

Each stat card (Revenue, Expenses, Gross Profit, Net Profit, Margin, Invoices Paid, Avg Invoice) gets a second, smaller delta line:

```text
REVENUE
R 42 300
+12%  vs prev period
-4%   vs Aug 2025 (YoY)
```

The YoY window is the same calendar range shifted back exactly one year. If there is no data in that window, the YoY line is hidden rather than showing "new".

## 2. Year-on-year overlay on the trend charts

The revenue trend and cash-flow charts get an optional dashed "Last year" line, toggled by a small "YoY" switch on the chart header. Buckets align by position (day 1 vs day 1, Jan vs Jan), so a shifted-by-one-year series plots cleanly against the current one.

## 3. Forecast card (weighted by same-period history)

A new "Forecast" card appears when the selected range includes today (i.e. the period is still running):

- Pace to date: revenue and expenses so far in the period.
- Seasonal projection: scale the to-date figure by how much of the period was typically complete at this point in prior years' equivalent periods.
- Weighting: prior years are blended with an exponential weight (most recent year weighted highest), and a simple flat pro-rata projection is folded in as a fallback so a single sparse prior year cannot dominate.
- Output: projected period revenue, expenses and net, each shown with a confidence hint (High / Medium / Low) based on how many prior periods contributed.
- If there is no comparable prior period, fall back to straight pro-rata and label it "linear pace, no history".

The projection is also drawn on the revenue trend chart as a faded bar for the remaining buckets.

## Technical notes

- New helper module `src/lib/forecast.ts`:
  - `sameRangeLastYear(from, to)` — one-year-shifted window.
  - `seasonalFactors(history, bucket)` — share-of-period completion curve from prior equivalent periods.
  - `weightedForecast({ toDate, elapsedFraction, priorYears })` — exponentially weighted blend returning `{ projected, confidence, basis }`.
- `src/routes/results.tsx`: compute YoY aggregates using the existing `inRange` / `sumRev` / `sumExp` helpers on the shifted window; extend `Stat` to accept an optional second delta; add the YoY toggle state and the forecast card.
- Forecast uses all docs/expenses in the store (not just the filtered window), so no query or schema changes are needed.
- CSV export gains a "YoY" and "Forecast" block mirroring the on-screen figures.

No database changes.
