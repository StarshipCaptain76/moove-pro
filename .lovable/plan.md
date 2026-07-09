## Diagnosis

Dec 2025 salary currently sums to only R 5,717 because the Results-page keyword rule (`salary|wage|owner|drawing|food|grocer|restaur|entertain|personal|househ|leisure`) only matches the `category` string, and the CSV importer put most owner draws under `Other`, `Labour`, or `Asset Purchases`.

Reclassifying by keyword using **category + vendor + description** brings Dec 2025 to ~R 15.8 k (all confirmed inclusions):

| Bucket | R | Source signal |
|---|---:|---|
| Food + Entertainment (already) | 5,717 | category |
| ATM Cash / Card Cashback | 2,901 | vendor: `atm cash`, `card cashback`, `geld trek` |
| Send Money / Salary Dylan | 1,800 | vendor: `dylan potgieter`, `salary dylan` |
| Personal services | 1,050 | vendor: `u beauty`, `karlien van zyl` |
| Temu retail | 4,000 | vendor: `temu` |
| Stilbaai Kelders (bottle store) | 219 | vendor: `kelder` |
| **Total Dec 2025** | **≈ 15,700** | |

R 25 k target likely also includes small groceries/eatery variants already covered; the current best-effort matching should get close without dragging in real business expenses (truck, fuel pumps, insurance, Nadia's labour). If a gap remains it's residual mis-classified `Other` cash items — will surface once the rule runs.

## Fix (Results page only, per user choice)

Rewrite the `isSalaryCat` helper in `src/routes/results.tsx` so it evaluates against **category + vendor + description**, not just category:

```ts
const isSalary = (e: Expense) => {
  const cat = (e.category || "").toLowerCase();
  const txt = `${e.vendor ?? ""} ${e.description ?? ""}`.toLowerCase();
  if (/^(food|entertainment|salary|wages?)$/.test(cat)) return true;
  if (/salary|dylan potgieter|send money.*dylan|owner|drawing|personal/.test(txt)) return true;
  if (/atm cash|card cashback|geld trek/.test(txt)) return true;             // owner cash draws
  if (/beauty|karlien van zyl/.test(txt)) return true;                       // personal services
  if (/temu/.test(txt)) return true;                                         // personal retail
  if (/supermarket|checkers|shoprite|pick n pay|woolworths|spar|tani|ok foods/.test(txt)) return true;
  if (/restaurant|pub|lounge|bistro|cafe|kelder|seekombuis|plato|puffies|cigar/.test(txt)) return true;
  return false;
};
```

Update every call site currently using `isSalaryCat(x.category)`:

1. `sumSalary` → filter with the new `isSalary(e)`.
2. Per-bucket `Salary` series in `cashflow` → `exp.filter((x) => x.date.startsWith(key) && isSalary(x))`.
3. Gross Profit stays `revenue − (totalExp − salary)` — no formula change.

Rename the helper from `isSalaryCat` to `isSalary` to reflect that it now takes the full `Expense` row.

## Verification steps

1. Load `/results`, set range to **Dec 2025**, confirm the new **Salary** point on the Revenue trend chart is ≈ R 15–17 k (was ≈ R 6 k). Gross Profit shifts up by the same delta.
2. Scan a few other months in the trend chart — the salary line should now track higher than before across the whole history without touching real business expenses.
3. Typecheck.

## Out of scope

- No changes to `src/data/historical.json`, `src/data/bank-import-2026.json`, or the store — the underlying category on each expense stays as-is (per user preference "Leave source data alone; only expand the Results-page keyword rules").
- Expenses page will still show these rows under their original categories (Food / Other / Labour / etc.).

## Files touched
- `src/routes/results.tsx` — expand salary matcher, rename helper, update two call sites.
