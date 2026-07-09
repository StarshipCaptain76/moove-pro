## Diagnosis

Checked the live store: `moove-store-v1` has **1,454 expenses but 0 with `bank-` IDs**. All months after April 2026 are empty because the user only ever clicked "Import historical data" in Settings — they never clicked "Import bank statements", so `src/data/bank-import-2026.json` (236 expenses + 49 docs across May–Jul 2026) was never merged into the persisted Zustand store.

The bank file itself is correct:
- expenses by month: May 112, Jun 123, Jul 1
- docs by month: May 21, Jun 22, Jul 6

The issue is purely wiring: the imports are user-triggered, and one was missed.

## Fix

Auto-import both bundled datasets on app boot so users can't end up in this half-imported state.

1. **`src/routes/__root.tsx`** (or the `Shell` component if `__root` is minimal) — add a `useEffect` that runs once per mount and calls `importHistorical(historical)` then `importHistorical(bankImport)`. Both are already idempotent (dedupe by `id`), so re-runs are safe and cost nothing after the first successful import.
2. Guard against SSR: wrap in `useEffect` (client-only) and skip if `docs.some(d => d.id.startsWith('bank-'))` is already true, to avoid a tiny wasted pass on every navigation.
3. Leave the manual buttons in Settings intact — they remain useful for a clean re-import after `clearHistorical()`.

That's the entire change; no store, schema, or JSON edits needed. Once the effect runs the user's browser will pick up all May–Jul 2026 bank transactions and the Expenses page will show them under the correct months.

## Files touched
- `src/routes/__root.tsx` — add one small `useEffect` and two imports.
