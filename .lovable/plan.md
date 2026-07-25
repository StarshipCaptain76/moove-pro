## Goal
On /home, the "Paid" invoices tile currently counts every paid invoice ever (401, including bank-imported history). Restrict it to invoices paid in the current calendar month.

## Changes

**`src/lib/doc-buckets.ts`**
- Update the `inv-paid` matcher to require `status === "paid"` AND `paidAt` (fallback `updatedAt` if `paidAt` missing) falls within the current month (same year + month as today).
- Update the label/title to reflect the scope: badge label stays "Paid"; `bucketTitle["inv-paid"]` becomes "Paid invoices this month" so the filtered docs list header on /docs makes sense.

**`src/routes/docs.tsx`** (if it uses `bucketMatch` for the filter, no code change needed — the tighter matcher automatically narrows the list). Verify during build; no other edits planned.

## Notes
- Imported historical paid invoices have `paidAt` set to the bank import date, so month-scoping naturally excludes them from prior months.
- Other buckets (draft/unpaid/overdue) are unchanged.
