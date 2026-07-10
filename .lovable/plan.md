## Show historical imported jobs on the planner

### Problem

The 49 imported bank docs are `status: "paid"`, `archived: true`, `paidAt: "2026-05-02"` etc., with no `scheduledDate`. In `src/routes/planner.tsx`, `paidDate(doc)` currently returns `undefined` when a doc is archived and its paid date isn't today, so archived historical jobs never appear on the calendar in any view.

### Change

In `src/routes/planner.tsx`, relax `paidDate()` so any paid doc with a `paidAt` is placed on the calendar on its paid date, regardless of `archived`:

```ts
const paidDate = (doc: Doc) => {
  if (doc.status !== "paid" || !doc.paidAt) return undefined;
  return format(new Date(doc.paidAt), "yyyy-MM-dd");
};
```

Effect: historical imported jobs (and any future archived-after-paid jobs) show up on their paid date in Agenda, Week, and Month views. They remain paid (green dot indicator) and open the job when tapped.

### Side effects

- Agenda view shows days with historical jobs across the full 60-day window from the anchor. Since a user can now swipe backwards (previous plan), they can browse into May 2026 and see the imported history.
- Unscheduled pill logic is unchanged (only affects `accepted` jobs).
- No DB changes, no store changes.

### File

- `src/routes/planner.tsx` — single-function edit to `paidDate`.
