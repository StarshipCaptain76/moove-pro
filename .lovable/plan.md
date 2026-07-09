## Feature

On the doc edit screen (`/doc/:id`), add an **"Import from Contacts"** button next to the Customer name input that opens the phone's native contact picker, lets the user pick one contact, and pre-fills Name / Phone / Email on the current doc. Every field stays editable after import.

## Approach

Use the browser-native **Contact Picker API** (`navigator.contacts.select`). It's supported on Chrome/Edge Android and Samsung Internet, which is the target for this mobile PWA. It requires:
- Secure context (HTTPS) — Lovable preview & published are both HTTPS, so fine.
- A user gesture — we call it inside the button's `onClick`.
- No permissions to pre-declare; the OS shows its own picker + permission prompt.

If the API is missing (desktop, iOS Safari), we hide the button and show a small inline hint the first time it would appear on those platforms — no crash, no error toast.

## Scope

Only two files:

1. **New**: `src/components/app/ContactImportButton.tsx`
   - Small button (icon + "Contacts") using the same `Button` primitive.
   - Feature-detects `"contacts" in navigator && "ContactsManager" in window`. If unsupported, renders `null`.
   - On click:
     ```
     const [c] = await (navigator as any).contacts.select(
       ["name", "tel", "email"],
       { multiple: false }
     );
     ```
   - Wraps in try/catch. User-cancel resolves to `[]` — silently no-op. Any other throw → `toast.error("Could not open contacts")`.
   - Calls `onPick({ name, phone, email })` with the first non-empty entry from each array.

2. **Edit**: `src/routes/doc.$id.tsx`
   - Import the new component.
   - Render it in the Customer card, in the same row as the Name label (right-aligned), so it sits above the CustomerCombobox.
   - `onPick` merges into `doc.customer` via the existing `upsertDoc({ ...doc, customer: { ...doc.customer, ...picked } })` — same shape as the combobox's `onPick`, so fields remain editable and downstream customer autofill (`customers` list) works unchanged.
   - If the picked contact has no phone but the doc already has one, we don't overwrite (only fill fields the picker returned).

## Out of scope

- No changes to the store, no new "Contacts" table, no persistence of the OS contact list.
- No iOS/desktop fallback UI beyond hiding the button.
- No bulk import.

## Verification

- On Chrome Android (or Chrome DevTools "Emulate mobile" with the Contact Picker flag) at `/doc/:id`: tap **Contacts** → OS picker appears → pick one → Name / Phone / Email populate → each field is still editable → Save / WhatsApp / Email work.
- On desktop Chrome / iOS Safari: the Contacts button is hidden, nothing else changes.
