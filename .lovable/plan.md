## Historical data import from `MOOVE_Staat.xlsx`

### Source structure (confirmed)

9 monthly sheets: `Des2024`, `Jan2025`, `Feb2025`, `March2025 to 15Apr2025`, `15May2025`, `15Jun2025`, `15Jul2025`, `15Aug2025` (+ Instructions / Key Metrics settings).

Each monthly sheet, from row 12 downward, columns C–J:

| Col | Field |
|---|---|
| B | invoice # (on some deposit rows) |
| C | Datum (date) |
| D | Tipe (`Kaart` / `Kontant`) |
| E | Beskrywing (description) |
| F | Kategorie (Afrikaans) |
| G | Betaling (money out → expense) |
| H | Deposit (money in → income) |
| I | Balans |
| J | PAID flag (`y` = cleared) |

### Category mapping (AF → EN)

**Expenses:**
`Trokkie Paaiement`→Truck Payment · `Diesel`→Diesel/Fuel · `Arbeid`/`Salaris`→Labour · `Data/Airtime`→Data/Airtime · `Onderhoud`→Maintenance · `Bate Aankope`→Asset Purchases · `Entertainment`→Entertainment · `Food`→Food · `Advertising`→Advertising · `Sand/Klip`→Sand/Stone/Trailer Hire · `Versekering`→**Insurance** (new) · `Bank Fooi`→**Bank Fees** (new)

**Income (revenue lines on Deposit rows):**
`Trek Meubels` · `Tuin Vullis` · `Bou Rommel` · `Sand/Klip Aflewer` — each becomes a catalog service and an invoice line.

Unmapped/blank categories → `Other` (Afrikaans name kept in note).

### Deliverables

1. **Parser script** (build-time, run once) — `scripts/parse-moove-staat.ts`
   - Reads `/mnt/user-uploads/MOOVE_Staat.xlsx`, iterates every monthly sheet, walks rows from 12 to end while column C holds a date.
   - Rows with `Betaling > 0` → **Expense** object (stable id `hist-{sheet}-{row}`).
   - Rows with `Deposit > 0` → **Doc** object: type `invoice`, status `paid`, one line item (description = category, qty 1, price = deposit), paidAt = row date, number = `INV-{invnum}` if col B present else `INV-H{sheet}-{row}`, customer name = description.
   - Writes `src/data/historical.json` (checked in, ~200 KB estimated).

2. **Bundled JSON** — `src/data/historical.json`
   ```
   { "expenses": Expense[], "docs": Doc[], "newExpenseCategories": ["Insurance","Bank Fees"], "newCatalogItems": CatalogItem[] }
   ```
   Every item carries a stable `id` prefixed `hist-` so re-import is idempotent.

3. **Store additions** — `src/lib/store.ts`
   - New action `importHistorical(payload)` that:
     - Adds any `newExpenseCategories` not already present.
     - Adds any `newCatalogItems` not already present (dedupe by name).
     - Merges `expenses` by id (skip existing).
     - Merges `docs` by id (skip existing).
     - Bumps `nextInvoiceNo` past the highest historical number.
   - New action `clearHistorical()` — removes any expense or doc whose id starts with `hist-`, plus imported categories/catalog items that are unused.

4. **Settings UI** — new "Data" section in `src/routes/settings.tsx`
   - **Import historical data** button → runs `importHistorical`, toast with counts (`Imported 312 expenses, 148 invoices`).
   - **Clear imported data** button (destructive, confirm) → runs `clearHistorical`.
   - Shows current counts of `hist-` records so user sees state.

### Data flow after import

- Home dashboard stat cards (Outstanding / Paid this month / Quotes / Invoices) automatically reflect imported invoices.
- Results page revenue / expenses / net profit will populate historically for Dec 2024 – Aug 2025.
- Expenses page groups by month; existing month navigator works unchanged.
- Auto-archive (10-day rule) will hide these old invoices from Home except accepted/paid ones; paid invoices stay visible in Results.

### Out of scope

- Balance-sheet reconciliation ("Bank Balaans", "Kontant" counts) — the app has no bank-balance model.
- Cash-counting tumbler / "CASH COUNT" columns.
- Fixed-expense recurring schedules from the right-hand summary blocks.
- Ongoing sync — this is a one-time import from the shipped snapshot.

### Files touched

- **Add**: `scripts/parse-moove-staat.ts`, `src/data/historical.json`
- **Edit**: `src/lib/store.ts` (2 actions), `src/routes/settings.tsx` (Data section)
