## Goal

Let you transfer the workspace from preview to published (or vice versa) with one link, so both sides show the same catalog, docs, customers, banking, and settings.

## What changes

**Settings → General:** add a "Sync link" section with:
- A read-only field showing the current workspace sync URL (includes `?w=<id>&t=<token>`).
- A **Copy sync link** button.
- Short helper text: *"Open this link once in your other site (preview or published) to load this workspace there. Anyone with the link can edit — treat it like a password."*

**Sync loader (`src/lib/sync.ts`):**
- On load, if the URL contains `?w=<id>&t=<token>` **and** localStorage already has a different workspace, the app currently silently overwrites. Change it to prompt: *"Load workspace from link? This will replace the local one."* Confirm → adopt id+token, refetch, done. Cancel → keep local workspace, strip params from URL.
- Fix a subtle bug uncovered while reviewing: when a link with `?w=` but no `?t=` is opened today, the code writes the id to localStorage but has no token, and the next load can't authenticate. Change it to ignore incomplete links (id without token) and show a small toast: *"Sync link is missing its token. Copy a fresh link from Settings."*

**No changes** to database, RLS, RPCs, or the catalog sort logic — the sort is already correct; it will look correct on published once the data matches.

## How you use it

1. Open preview → Settings → copy the sync link.
2. Open the published site once with that link.
3. Published site adopts the same workspace. From then on both sides read/write the same data live (via the existing realtime-less push loop already in `sync.ts`).

Reverse works too: copy from published, open in preview.

## Security note

The link contains the secret token. Anyone with the link has full read/write to that workspace. If you ever leak one, you can rotate it — but that's not in this change; ask separately if you want a "regenerate token" button.

## Out of scope

- Real accounts / login (offered separately).
- Automatic cross-origin sync without a link (not possible without login).
- Multi-device conflict resolution beyond the current last-write-wins.
