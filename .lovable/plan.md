## Reduce keyboard input — pickers, sliders, tumblers everywhere

### 1. Shared `DatePicker` component
Extract the existing `ScheduledDatePicker` (duplicated inline in `doc.$id.tsx` and `doc..tsx`) into a reusable **`src/components/app/DatePicker.tsx`** — shadcn Calendar in a Popover, "EEE, d MMM yyyy" label, `pointer-events-auto`.

Props: `value?: string (yyyy-MM-dd)`, `onChange(iso)`, optional `placeholder`, `clearable?: boolean`.

Replace every `<Input type="date">` and both inline `ScheduledDatePicker` copies with this component.

### 2. Date field replacements
| File | Field | New control |
|---|---|---|
| `src/routes/expenses.tsx` | Expense date | `<DatePicker>` |
| `src/routes/doc.$id.tsx` | Scheduled date | shared `<DatePicker>` |
| `src/routes/doc..tsx` | Scheduled date | shared `<DatePicker>` |

Result: no `type="date"` remains in the app; every date entry is a tap-to-open calendar.

### 3. Numeric field replacements
Reuse the existing **`InlineTumbler`** (already used for qty/price on doc items) for all remaining numeric entry.

| File | Field | Control |
|---|---|---|
| `src/routes/expenses.tsx` | Amount (R) | `InlineTumbler` (step 10, fine 1, min 0) |
| `src/routes/doc.$id.tsx` | Deposit % | `<Slider>` 0–100 step 5 with big value readout (replaces number input) |
| `src/routes/doc.$id.tsx` | Distance km | `InlineTumbler` (step 5, fine 1, min 0) |
| `src/routes/doc..tsx` | Deposit %, distance km | same as above |
| `src/routes/settings.tsx` → Billing | Rate per KM, Base callout, Default deposit %, VAT %, Next quote #, Next invoice # | Deposit % + VAT % → `<Slider>` 0–100. Rate/Callout → `InlineTumbler`. Next # → `InlineTumbler` (step 1). |

### 4. Category / payment method already dropdowns — verify
Confirm `expenses.tsx` category select and payment-method chooser are already tap-only (they are — `<select>` and radio chips). No change needed.

### 5. Keep as keyboard input (intentional)
Free-text fields that inherently need typing stay as `<Input>`:
- Company name/tagline/address/email
- Banking labels
- Customer name/phone/email/address
- Item description, invoice notes
- Category / catalog item names
- Quote/invoice prefix (short text)
- Search boxes (customer combobox, address autocomplete)

### Files touched
- **Add**: `src/components/app/DatePicker.tsx`
- **Edit**: `src/routes/expenses.tsx`, `src/routes/doc.$id.tsx`, `src/routes/doc..tsx`, `src/routes/settings.tsx`

### Out of scope
- Rewriting `NumField` in settings globally beyond the specific billing fields listed.
- Changing text-input fields (names, addresses, descriptions).
- New tumbler animation styles — reusing the existing `InlineTumbler`.
