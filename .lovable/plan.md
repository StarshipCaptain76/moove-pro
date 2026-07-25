## Goal
On the quote editor (`/doc/$id` when `doc.type === "quote"`), add a status stepper at the top so the user can instantly advance:
Draft → Awaiting acceptance → Accepted → Invoice.

## Change

**`src/routes/doc.$id.tsx`** — header area (right after the existing title row):

- Render a `QuoteStatusStepper` only when `doc.type === "quote"`, replacing the plain status badge for quotes.
- Four clickable pills mapped to actions:
  - **Draft** → `update({ status: "draft" })`
  - **Awaiting** → `update({ status: "sent" })`
  - **Accepted** → `update({ status: "accepted" })`
  - **Invoice** → calls existing `convert()` (creates invoice number, flips type to `invoice`, status `accepted`)
- Current step highlighted (primary background); prior steps show as completed (muted with check); future steps are outlined.
- Any pill is clickable — user can jump backward or forward. `flushSync()` runs on each change (already wrapped inside `update`/`convert`).
- For invoices, keep the existing status badge as-is (no stepper).

No other files change. Mapping used for "current step":
- `draft` → 0, `sent` → 1, `accepted` → 2, `paid`/`cancelled` unchanged (invoice path).
