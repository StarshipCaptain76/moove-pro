## Four small improvements

### 1. Auto-archive old quotes (Home)
- Add `archived?: boolean` to `Doc` in `src/lib/store.ts`.
- On Home load, sweep once: any quote with `type === "quote"`, `status` in `{draft, sent}`, and `createdAt` older than 10 days → set `archived: true` (via `upsertDoc`). Accepted quotes and invoices are never touched.
- Home lists filter out `archived === true`. Planner + Results untouched (accepted quotes still show).
- Small "Archived (n)" link at the bottom of Home → shows the archived list in-page with an "Unarchive" button per row.

### 2. Quote validity note on PDF
- In `src/lib/pdf.ts`, for `type === "quote"` add a line under the totals block: **"This quote is valid for 7 days from the date of issue."**
- Also render "Valid until: {createdAt + 7 days, formatted}" beside it.
- No change to invoices.

### 3. Non-negative numeric inputs on Quote/Invoice
- In `src/routes/doc.$id.tsx` every numeric input for qty, price, deposit %, distance km:
  - `min={0}` on the input,
  - `onChange` clamps `Math.max(0, Number(v))`,
  - `inputMode="decimal"` retained (already there).
- Apply the same clamp to the new tumbler component (below) and to deposit quick-chips.

### 4. Inline horizontal tumbler for line-item qty & price
New component `src/components/app/InlineTumbler.tsx`:
- Renders the current value large in the middle with faint neighbouring values on either side (ticks style, MOOVE-Fit vibe).
- Swipe left/right (pointer events) to change the value; snaps to `step` (qty: 1, price: configurable — default R10 with fine mode R1 on long-press).
- Tap the number → opens a keypad drawer (existing `Input`) for exact entry. Long-press → toggles fine/coarse step.
- Clamped to `min = 0`, optional `max`.
- Wired into the line-item rows in `doc.$id.tsx`: qty uses step 1; price uses step 10 (fine step 1). Existing plain inputs become the fallback shown inside the tap-to-edit drawer.
- Purely pointer + touch events, no external lib. Haptic `navigator.vibrate(5)` on step change when available.

### 5. Density presets (Settings → Appearance)
- Add a new "Appearance" tab in `src/routes/settings.tsx` with three buttons: **Compact / Normal / Comfortable**.
- Persist `density: "compact" | "normal" | "comfortable"` in the zustand store.
- Apply by setting `data-density` on `<html>` in `__root.tsx` (and reading the persisted value on mount).
- In `src/styles.css` add:
  ```
  :root { font-size: 16px; }
  html[data-density="compact"]      { font-size: 13px; }
  html[data-density="normal"]       { font-size: 15px; }
  html[data-density="comfortable"]  { font-size: 17px; }
  ```
  Because Tailwind's spacing/sizing is rem-based, this rescales spacing + type together → real density change, not just fonts.
- Also drop the default base to 15px so the app is denser out of the box (Normal preset).

### Files touched
- edit `src/lib/store.ts` (archived field, density state)
- edit `src/routes/index.tsx` (auto-archive sweep, archived list)
- edit `src/lib/pdf.ts` (quote validity)
- edit `src/routes/doc.$id.tsx` (non-negative clamps, use InlineTumbler for qty/price)
- create `src/components/app/InlineTumbler.tsx`
- edit `src/routes/settings.tsx` (Appearance tab)
- edit `src/routes/__root.tsx` (apply data-density)
- edit `src/styles.css` (base font-size + density variants)

### Out of scope
- No animated iOS-wheel picker (you chose inline horizontal tumbler).
- No per-user cloud sync of density.
- No changes to invoice PDF or archived flow for invoices.
