## Plan: stop the default service duplicates from coming back

I checked the live backend data and the duplicates are in `catalog_items`, not `expense_categories`:

- `Extra Labour (per hour)` appears 14 times
- `Local Move (up to 3 rooms)` appears 13 times
- `Packing Service (per hour)` appears 13 times
- `Storage (per month)` appears 13 times

The category table currently does not contain these service names, so the fix should target the catalog/service list.

## Changes to make

1. **Stop reseeding default catalog rows repeatedly**
   - Update the sync merge logic so the app does not treat the built-in default catalog rows as “local-only rows” that must be pushed back to the backend on every sign-in/load.
   - Only real user-created or backend-loaded catalog items should be saved.

2. **Deduplicate the catalog in the app state**
   - Add a catalog dedupe step when loading/merging data.
   - Collapse duplicate catalog items by normalized service name.
   - Keep one row per service name, preferring the backend/user row over the built-in default duplicate.

3. **Clean the existing duplicated backend rows**
   - Run a safe backend cleanup migration/query that removes duplicate `catalog_items` rows for the same owner and normalized name, keeping one copy.
   - This will remove the repeated default rows that already exist.

4. **Keep expenses categories separate**
   - Do not delete `Insurance`, `Bank Charges`, `Bank Fees`, or any real expense categories.
   - Do not remap expenses to `Other`.

5. **Verify**
   - Re-query the backend to confirm each of the four default services exists only once.
   - Check the settings/catalog list no longer shows repeated service rows after reload/sync.