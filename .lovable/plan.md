## Problem

On the doc edit screen (new quote/invoice):

1. **Customer Name field is unresponsive** — keystrokes don't register. Root cause: `CustomerCombobox` wraps the `<Input>` inside a Radix `PopoverTrigger asChild`. Radix's dismissable-layer + focus management on the trigger swallows key events on the wrapped input (classic Radix-Popover-around-Input pitfall). The AddressAutocomplete inputs work because they use a plain absolute-positioned dropdown, not a Radix Popover.

2. **Address field doesn't feel like a live search / picker.** The component (`AddressAutocomplete`) is actually wired to `placesAutocomplete` (Google Places) and does render a dropdown, but only after a 250 ms debounce with ≥3 chars, and network/auth errors are silently swallowed to `console.error`, so it looks like "nothing happens". We should make the live suggestions visibly reliable and surface any failure.

## Plan

### 1. Rewrite `CustomerCombobox` to match the `AddressAutocomplete` pattern

- Drop Radix `Popover` / `PopoverTrigger` / `PopoverContent`.
- Use a `relative` wrapper `<div>` with a plain `<Input>` and an absolute-positioned dropdown `<div>` beneath it (same shape as `AddressAutocomplete`).
- Keep behavior: show up to 8 matches filtered by name / phone / email; click picks the customer; typing calls `onType`; blur / outside-click closes.
- Preserve the `value / customers / onType / onPick` props so the call site in `src/routes/doc.$id.tsx` doesn't change.

### 2. Make address search visibly work as a picker

- Show a small inline hint under the input while `q.length < 3` (e.g. "Type 3+ characters to search…") so the user knows suggestions are keystroke-driven.
- On autocomplete error, surface a `toast.error("Address search failed")` instead of only `console.error`, so a missing/invalid Maps connector isn't silent.
- Keep the existing debounce (250 ms), Google Places call, and pick-to-fill-address+coords flow — those are already correct.

### 3. Scope guardrails

- No changes to the store, to `maps.functions.ts`, or to any other route.
- Only touch:
  - `src/components/app/CustomerCombobox.tsx` (rewrite internals, same public API)
  - `src/components/app/AddressAutocomplete.tsx` (hint + toast on error)

### Verification

- Open an existing quote at `/doc/:id`, type into **Name** → characters appear, matching past customers show in a dropdown, clicking one fills phone/email.
- Type 3+ chars into **From address** / **To address** → Google Places suggestions render; picking one fills the field and stores coords; "Calculate distance" still works.
