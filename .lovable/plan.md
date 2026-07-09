## What's in the CSV

9 rows, 1–9 Jul 2026, Gold Business Account 63216547993.

| Date | Amount | Description | Handling |
|---|---:|---|---|
| 2026/07/09 | +1000.00 | FNB APP PAYMENT FROM MOOVE NEW BANK | **Skip** (own-account transfer) |
| 2026/07/09 | +550.00 | FNB APP PAYMENT FROM A. GROBLER | Income |
| 2026/07/09 | −969.00 | DAWIE & JULIUS LOAN | Expense → **Labour** |
| 2026/07/08 | +1200.00 | christa | Income |
| 2026/07/07 | +2400.00 | christa | Income |
| 2026/07/04 | +1200.00 | christa | Income |
| 2026/07/03 | +2400.00 | ABSA BANK Kiewiet Enterprises | Income |
| 2026/07/02 | +1100.00 | FNB APP PAYMENT FROM ANNEKIE | Income |
| 2026/07/01 | +200.00 | FNB APP PAYMENT FROM MOOVE NEW BANK | **Skip** (own-account transfer) |

**Net:** 6 income credits totalling **R 8,850.00**, 1 expense of **R 969.00**, 2 skipped transfers.

## Income allocation (July 2025 mix)

Same-month prior-year split:

- Garden Waste Removal — 38.7%
- Sand/Stone Delivery — 29.5%
- Furniture Removal — 21.3%
- Building Rubble Removal — 10.5%

Each of the 6 credits will be split into 4 line items on a paid invoice using these percentages (rounded to 2dp, final line balances to the total).

## Steps

1. **Rewrite `src/data/bank-import-2026.json`**
   - Drop every existing `bank-` entry (expenses + docs) with a `2026-07` date.
   - Append 1 new expense: `2026-07-09`, R 969.00, category **Labour**, description "Dawie & Julius", paymethod `eft`.
   - Append 6 new paid invoices (one per credit) dated 2026-07-01/02/03/04/07/08/09, each with 4 line items allocated per the July 2025 mix, `status: "paid"`, `paidAt` = credit date, `paymentMethod: "eft"`.
   - Skip the 2 "MOOVE NEW BANK" transfers.
   - IDs prefixed `bank-2026-07-…` so re-imports dedupe cleanly via existing `bank-` filter in `store.ts`.

2. **No code changes** — the existing Settings → "Bank statements" import button already re-imports this file; counts will update automatically. The store's `isImported()` / `clearHistorical()` treats `bank-` IDs uniformly, so users can re-run the import.

3. **Verify** — typecheck, then load `/settings` and confirm the Bank import card shows the new totals (6 docs / 1 expense for July replaced).

## Files touched

- `src/data/bank-import-2026.json` — regenerated July 2026 slice, May/June rows untouched.
