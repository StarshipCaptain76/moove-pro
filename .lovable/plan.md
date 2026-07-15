## Root cause

Expense categories are being mutated implicitly by the **Import historical / Import bank** buttons on Settings, not by explicit edits.

- `importHistorical` in `src/lib/store.ts` (line 328) calls
  `for (const c of p.newExpenseCategories) catNames.add(c)` and then
  `p.newExpenseCategories.forEach(pushExpenseCategory)`.
- The historical JSON injects `"Bank Fees"` and `"Insurance"`; the bank-import JSON injects `"Bank Charges"`. These land alongside the defaults, so the user ends up with near-duplicates like **Bank Fees** vs **Bank Charges**.
- Nothing else writes to `expenseCategories` outside of the explicit `addExpenseCategory` / `renameExpenseCategory` / `deleteExpenseCategory` actions. Receipt AI parsing and sync merges are already constrained to the existing list.
- Confirmed against the cloud DB: 17 rows, no true duplicates — the 3 extras are all from imports.

## Fix

**1. Stop imports from touching the category list**
In `src/lib/store.ts` → `importHistorical`:
- Remove the `catNames.add(...)` loop and drop `expenseCategories` from the returned `set(...)` payload.
- Remove the `p.newExpenseCategories.forEach(pushExpenseCategory)` push.
- For any imported expense whose `category` is not already in the user's current list, remap it to `"Other"` before insert, so the pie/legend stay consistent.

Result: importing (or re-importing) historical/bank data never adds, renames, or removes categories. Only the three explicit user actions do.

**2. Clean up the 3 orphan categories already created**
Add a one-shot migration in `initSync` (runs once per signed-in user, tracked via a `localStorage` flag like `moove:categories-pruned-v1`):
- For each of `"Bank Charges"`, `"Bank Fees"`, `"Insurance"`: if present in the user's `expenseCategories`, remap linked expenses to `"Other"` and delete the category via the existing `deleteExpenseCategory` action (which also removes the cloud row).

If the user actually wants any of these three kept, they can re-add them via Settings → Categories after the cleanup. Alternative: skip the auto-cleanup and let the user remove them manually in Settings — happy to do that instead.

**3. No changes required to**
- `sync.ts` `loadAll` (cloud is already the source of truth on sign-in).
- `expenses.functions.ts` (already picks only from allowed list).
- Settings category editor (already case-insensitive dedupe on add).

## Files touched

- `src/lib/store.ts` — trim `importHistorical`; add one-shot cleanup helper.
- `src/lib/sync.ts` — call the one-shot cleanup once per user after `loadAll`.

## Open question

Do you want step 2 (auto-remove the 3 orphan categories and remap their expenses to "Other") — or leave them and just prevent future imports from ever adding categories, so you can delete the extras yourself in Settings?