## Plan

1. **Make login adopt the current preview workspace**
   - When Dylan signs in, if the browser already has an anonymous sync workspace ID/token, call the existing backend `claim_workspace` function.
   - This transfers that exact workspace to Dylan’s account instead of creating/using a different empty or older account workspace.

2. **Make auth sync prefer the latest local workspace when needed**
   - Update the sync flow so a signed-in session can claim the stored local workspace before loading account data.
   - If the account workspace is empty but local preview has data, keep the existing “seed cloud from local” behavior.

3. **Expose a clear sync state in the UI**
   - Keep the current login/cloud icons, but make the underlying behavior deterministic: signed in = Dylan’s shared workspace; signed out = link/token workspace.
   - No new manual sync steps unless the backend rejects the claim.

4. **Validation**
   - Verify that after signing in, preview and published both resolve to the same account workspace and the catalog/invoice counts come from the same data source.

## Technical notes

- The backend function `claim_workspace(p_id, p_token)` already exists; the app currently doesn’t call it, which is why login can leave preview and published on separate workspaces.
- I’ll only change the auth/sync path, not catalog sorting or invoice counting.