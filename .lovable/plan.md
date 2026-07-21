## Home page: Invoices & Quotes status panels

Add two side-by-side cards to `/` (above the today/recent tabs) that mirror the reference: each row shows a status label with a colored count badge, and tapping a row opens `/docs` pre-filtered to that bucket.

### Layout
```text
┌─────────────────────┐  ┌───────────────────────────┐
│ INVOICES            │  │ QUOTES                    │
│  Draft            0 │  │  Draft                  0 │
│  Unpaid           0 │  │  Awaiting acceptance    0 │
│  Overdue          0 │  │  Accepted               0 │
│  Paid             0 │  │  Declined               0 │
└─────────────────────┘  └───────────────────────────┘
```
Two columns on mobile side-by-side (stacked below `sm` if too tight). Rows have divider lines. Count badge colors:
- Draft → amber
- Unpaid / Awaiting → blue
- Overdue / Declined → red
- Paid / Accepted → green

The four existing summary tiles (Outstanding, Paid month, Quotes month, Invoices month) stay above these panels — they show money/totals, the new panels show pipeline status counts.

### Status rules (from clarifications)

**Invoices**
- Draft: `type=invoice`, `status=draft`
- Unpaid: `type=invoice`, `status ∈ {sent, accepted}`, not paid, created ≤14 days ago
- Overdue: `type=invoice`, unpaid, created >14 days ago
- Paid: `type=invoice`, `status=paid`
- (Sent to accounting tile skipped)

**Quotes**
- Draft: `type=quote`, `status=draft`, not archived
- Awaiting acceptance: `type=quote`, `status=sent`, not archived
- Accepted: `type=quote`, `status=accepted`
- Declined: `type=quote`, `status ∈ {cancelled}` OR (draft/sent AND created >10 days ago). This absorbs the existing "auto-archive after 10 days" quotes so they show as Declined instead of silently disappearing.

Archived quotes still appear under the existing "Show archived quotes" section unchanged.

### Navigation

Each row is a `<Link to="/docs">` with search params. Extend `/docs` (`src/routes/docs.tsx`) `validateSearch` to accept a `bucket` param:

`bucket` ∈ `inv-draft | inv-unpaid | inv-overdue | inv-paid | quote-draft | quote-awaiting | quote-accepted | quote-declined`

`docs.tsx` maps `bucket` to the same filter predicates used on the home page (shared helper in `src/lib/doc-buckets.ts`) so counts and list stay in sync. The page title reflects the bucket (e.g. "Overdue invoices", "Declined quotes"). Existing `type` / `status=unpaid` params keep working for the summary tiles above.

### Files touched
- `src/lib/doc-buckets.ts` — new shared predicates + labels + colors, single source of truth.
- `src/routes/index.tsx` — render the two panels above the existing tabs card, sourcing counts from the shared helper.
- `src/routes/docs.tsx` — accept `bucket` search param, apply matching predicate, set title.

No schema or store changes — all buckets derive from existing fields (`type`, `status`, `createdAt`, `paidAt`, `archived`).
