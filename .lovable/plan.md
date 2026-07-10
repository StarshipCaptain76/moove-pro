
# Move workspace data to cloud tables

## Why
Today the whole workspace (company, banking, billing, catalog, customers, docs, expenses, categories, density) is one big JSON blob:
- Kept in `localStorage` via zustand `persist`.
- Pushed to the `workspaces` table as one `jsonb` column with `save_my_workspace`.
Every save overwrites the entire blob, so a slightly stale tab / device / offline edit silently wipes newer changes from another session. That is the "randomly overwritten" behaviour.

## Target shape
Each entity becomes its own row in its own table, scoped to the signed-in user. Writes touch only the row that changed, so concurrent edits stop clobbering unrelated data.

Tables (all `owner_user_id uuid` = `auth.uid()`, RLS locked to owner):
- `company_profile` — 1 row per user (company + banking + billing settings + density).
- `catalog_items`
- `customers`
- `docs` — one row per quote/invoice; line items stored as `jsonb items` on the row (they're always edited together with the doc, no concurrency benefit to splitting).
- `expenses`
- `expense_categories` — one row per (user, name).

All tables get `id uuid pk`, `owner_user_id uuid`, `created_at`, `updated_at` + trigger. Grants: `authenticated` full CRUD, `service_role` all. RLS: `owner_user_id = auth.uid()` for select/insert/update/delete.

## Sign-in requirement
Cloud-only storage means the app needs a signed-in user to work. Today anonymous workspaces are supported via `create_workspace` / share links. This plan drops that path — first launch routes through sign-in (email/password + Google, per Cloud defaults) before the app renders. Existing anonymous workspace share links stop working.

## Data access layer
Replace `useStore` (zustand + persist) with TanStack Query hooks backed by `createServerFn` handlers using `requireSupabaseAuth`:
- `useCompanyProfile()`, `updateCompanyProfile(patch)`
- `useCatalog()`, `upsertCatalogItem`, `deleteCatalogItem`
- `useCustomers()`, `upsertCustomer`
- `useDocs()`, `useDoc(id)`, `upsertDoc`, `deleteDoc`, `nextDocNumber(type)` (atomic RPC that increments the counter on `company_profile`)
- `useExpenses()`, `upsertExpense`, `deleteExpense`
- `useExpenseCategories()`, `addExpenseCategory`, `renameExpenseCategory`, `deleteExpenseCategory`
- `importHistorical`, `clearHistorical` — server fns doing bulk inserts/deletes.

`nextDocNumber` moves to a Postgres function so two devices can't hand out the same number.

## Migration of existing data
One-time migration on first cloud-mode load:
1. If the user has a legacy `workspaces.data` blob AND their new tables are empty, copy every entity into the new tables.
2. Mark the workspace row migrated (new column `migrated_at`) so we don't re-run.
3. Leave the old `workspaces` table in place for one release as a safety net, then drop in a follow-up.

Local `moove-store-v1` in `localStorage` is cleared after successful cloud load.

## Files to change
- New: `supabase` migration creating the six tables, grants, RLS, `next_doc_number` RPC, `migrate_workspace_blob` RPC.
- New: `src/lib/data/*.functions.ts` per entity (server fns).
- New: `src/lib/data/hooks.ts` — Query hooks + mutation wrappers with cache invalidation.
- Rewrite: every consumer of `useStore` (12 files listed) to use the new hooks.
- Delete: `src/lib/store.ts` zustand store, `src/lib/sync.ts` blob sync, sync badge UI, `create_workspace` / `update_workspace` / `save_my_workspace` / `get_workspace` / `get_my_workspace` / `claim_workspace` RPCs (kept only long enough for the migration RPC to read the blob).
- Route gating: put all app routes under `_authenticated/`; keep `/auth` public.

## Rollout order
1. Migration + RPCs (schema only, no code change yet).
2. New data layer + hooks, unused.
3. Auth gating + one-time blob → tables migration on first authed load.
4. Swap consumers file-by-file to the new hooks; delete zustand + blob sync when the last consumer is migrated.
5. Follow-up release: drop `workspaces` table and legacy RPCs.

## Trade-offs
- Every read is a network round-trip; offline stops working. If you want offline-tolerant, we'd need to add per-row `updated_at` conflict resolution on top — say the word and I'll fold that in.
- Anonymous / share-link workspaces are gone. Sharing becomes "invite by email" (out of scope for this plan).
