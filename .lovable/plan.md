## Root cause

In `src/routes/index.tsx`, the four home stats (Outstanding, Paid (month), Quotes, Invoices) are computed from `visible = docs.filter((d) => !d.archived)`. The 391 imported bank invoices in `src/data/bank-import-2026.json` are all stored with `archived: true`, so every stat that depends on `visible` reads 0 — while `Results` reads from the full `docs` array and correctly shows R 8,850 for July 2026 and 6 paid invoices.

The `archived` flag exists to declutter the Today / Recent list (auto-archive of stale quotes, plus imported historical rows), not to hide real income from the dashboard.

## Fix

Change only `src/routes/index.tsx`. Compute stats from the full `docs` array; keep the Today / Recent lists on `visible`.

- `stats.outstanding`: `docs.filter(d => d.type === "invoice" && d.status !== "paid").reduce(...)`
- `stats.paidThisMonth`: `docs.filter(d => d.status === "paid" && (d.paidAt ?? d.createdAt)?.startsWith(YYYY-MM)).reduce(...)` (already using the createdAt fallback)
- `stats.quotes`: count all `d.type === "quote"` (not just visible)
- `stats.invoices`: count all `d.type === "invoice"` (not just visible)

Keep unchanged:
- `todayJobs` still uses `visible` (archived rows should stay out of Today).
- The Recent tab still uses `visible.slice(0, 15)`.
- The "Show archived quotes (N)" panel still uses `archived`.

## Verification

On the home page for July 2026:
- **Paid (month)** ≈ R 8,850 (matches Results).
- **Invoices** shows the total imported + created invoices (391+ range), not 0.
- **Outstanding** shows the sum of any unpaid invoices across all docs.
- Today / Recent lists look identical to before (still hide archived rows).
- Results page is unchanged.

## Out of scope

- No changes to the import data or the store (per prior preference: leave source data alone; adjust the reading page).
- No change to auto-archive behavior for stale quotes.
