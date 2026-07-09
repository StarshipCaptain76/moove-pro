# Bank statement import (May – Jul 2026)

Extend the existing Settings importer to load a second batch — bank-statement data from the FNB business account (63098866280) into the app store.

## 1. Source selection & dedup
- **Primary source**: CSV in `transaction_history_Moove_Stilbaai_1.zip` — covers 5 May → 9 Jul 2026 (291 rows).
- **Fill 1–4 May 2026 gap** from PDF statement #23 (parsed with `pdftotext -layout`).
- PDF statements #22 (mid-Mar → mid-Apr), and the overlapping portions of #23/#24 with the CSV, are **ignored** to avoid double-counting April historical + already-present CSV rows.
- Ignore anything on/before 30 Apr 2026.

## 2. Bank charges (new expenses)
Add two "Bank Charges" expenses (new category, auto-created):
- 15 May 2026 — R 104.72 (Service Fees R 92.64 + VAT R 12.08) from statement #23.
- 15 Jun 2026 — R 247.83 (R 217.04 + VAT R 30.79) from statement #24.
- (July statement not yet issued; skipped.)

## 3. Expenses (all debits)
Every negative amount → one `Expense` row:
- `date` = transaction date
- `amount` = |value|
- `vendor` = raw description (trimmed, e.g. "ENGEN STILBAAI")
- `paymentMethod` = `card` for card-style descriptors ("491050*4699", "Yoco", "S2S*", "AP *", "SMART-AP", "FNB APP PREPAID"), `cash` for "ATM CASH", else `eft`.
- `category` derived by keyword rules against existing categories:
  - ENGEN / FUEL → Diesel/Fuel
  - AIRTIME / PREPAID → Data/Airtime
  - TANI / SPAR / OK FOODS / WIMPY / SUPERMARKET / PHARMACY → Food
  - STEYNS / SSK / AGRILAND / HARDWARE → Maintenance
  - ATM CASH → Other
  - SALARY / LABOUR / DYLAN pay → Labour
  - LODGE / ACCOM → Accommodation
  - anything else → Other
- Category matching is case-insensitive; unmatched → Other. New categories only added if absolutely required (only "Bank Charges" here).

## 4. Income (all credits) — prior-year same-month % allocation
Each positive amount → one paid `Doc` (invoice):
- `type=invoice`, `status=paid`, `paidAt` = txn date, `paymentMethod`=`eft`
- `customer.name` = raw description
- `number` = `INV-BNK-<yyyymmdd>-<seq>`
- Assign a single line item whose **description** is chosen so the month's totals match the prior-year same-month service mix:
  - Read historical `docs` from `src/data/historical.json` filtered by month `2025-05`, `2025-06`, `2025-07`.
  - Build `{itemDescription → %}` for each target month.
  - Within each 2026 month, allocate credits greedily (largest-first) to the service with the biggest remaining target amount until the mix matches.
- Fallback if prior-year same month is missing or has <2 items: use **trailing 3-month average mix** from `2025-{m-3..m-1}` of historical.
- Line item: `qty=1`, `price=amount`, `unit=job`.

## 5. Delivery
- **New file** `src/data/bank-import-2026.json` containing the pre-computed `expenses[]`, `docs[]`, `newExpenseCategories: ["Bank Charges"]`, `newCatalogItems: []`, `maxInvoiceNo: 0`.
- **Settings page** gets a second button, styled like the existing historical import: "Import bank statements (May–Jul 2026)" with the same idempotency guard (uses `bank-` ID prefix so re-clicks are no-ops) and a matching "Clear bank import" action.
- Reuse the existing `importHistorical` store action — no store changes needed beyond a small `bank-` prefix in `clearHistorical` (extend filter to strip both `hist-` and `bank-`).

## 6. Implementation steps
1. Python script (sandbox) parses CSV + PDF #23 gap + PDF fee lines → `src/data/bank-import-2026.json`.
2. Load `historical.json` in the same script to compute prior-year mix and pre-assign line items so the app doesn't need runtime allocation logic.
3. Add "Import bank statements" button + "Clear bank import" to `src/routes/settings.tsx`.
4. Extend `clearHistorical` in `src/lib/store.ts` to also match `bank-` ID prefixes.

## Out of scope
- Editing/removing the existing historical import.
- Reconciling against existing invoices (no matching by amount).
- Parsing bank statements older than 30 Apr 2026 or newer than 9 Jul 2026.
- Any UI beyond the two Settings buttons.
