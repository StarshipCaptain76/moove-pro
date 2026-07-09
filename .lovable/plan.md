## Expenses feature

Add an expense tracker where you snap a photo of a slip/invoice, AI extracts the details, and it's saved & categorised.

### Categories (editable in Settings)
Seed defaults:
Truck Payment, Diesel/Fuel, Labour, Data/Airtime, Sand/Stone/Trailer Hire, Toll Fee, Accommodation, Advertising, Food, Maintenance, Asset Purchases, Entertainment, Grass Purchase, Other.

### Data model (added to `src/lib/store.ts`)
```
Expense {
  id, createdAt, date (yyyy-mm-dd),
  category, vendor, description,
  amount, vatAmount?,
  paymentMethod?, notes?,
  receiptImage?: string (base64 or object URL),
  linkedDocId?: string  // optional link to a job/invoice
}
```
Store: `expenses[]`, `expenseCategories[]`, `upsertExpense`, `deleteExpense`, `upsertCategory`, `deleteCategory`. Persisted with existing zustand persist (bumped store name to preserve older data via migration merge).

### AI parsing
- Server function `parseReceipt` in `src/lib/expenses.functions.ts` using Lovable AI Gateway (`google/gemini-3-flash-preview`) with the image as `image_url` and a structured `Output.object` schema returning: `date, vendor, total, vat, category (from allowed list), description, paymentMethod`.
- Client compresses camera image (max 1600px, JPEG q0.7) then base64-encodes and calls the server fn.
- Category is matched against the user's current category list; falls back to "Other".

### New route: `/expenses`
Mobile-first, matches existing app style:
- **Header**: Month selector (chevrons), total for month, "+" FAB opens camera.
- **List**: grouped by day, each row: category chip · vendor · amount · thumbnail. Tap = edit sheet.
- **Add flow (bottom sheet)**:
  1. "Take photo" (camera) or "Choose from library" (`<input type=file accept=image/* capture=environment>`).
  2. Show spinner "Reading slip…" while AI parses.
  3. Pre-filled edit form: date, category (select), vendor, amount, VAT, payment method, description, notes. Receipt image preview with retake.
  4. Save.
- Manual add (skip photo) also supported.

### Shell / navigation
Add "Expenses" (receipt icon) to bottom tab bar in `src/components/app/Shell.tsx`. Tabs become: Home · Planner · Expenses · Results · Settings (FAB in centre unchanged).

### Results page
Add an "Expenses" stat card and a small category-breakdown list for the selected period. Net profit = invoiced (paid) − expenses.

### Settings
New "Expenses" tab: manage category list (add/rename/delete, alphabetical, same UX as Catalog editor).

### Storage
Receipt images stored inline as base64 in the persisted zustand store (consistent with the current fully-local architecture — no backend tables added). If a receipt exceeds ~1 MB after compression, we downscale further to stay within localStorage limits.

### Files
- edit `src/lib/store.ts` (types + state + actions + seed categories)
- create `src/lib/expenses.functions.ts` (AI parse server fn)
- create `src/routes/expenses.tsx` (list + add/edit sheet + camera)
- create `src/components/app/ReceiptCapture.tsx` (camera/upload + compress)
- edit `src/components/app/Shell.tsx` (add tab)
- edit `src/routes/settings.tsx` (categories editor tab)
- edit `src/routes/results.tsx` (expense totals + net profit)

### Out of scope
- Multi-user sync / cloud storage of receipts
- Exporting expenses to PDF/CSV (can add later if you want)
- OCR training / custom models — we rely on Gemini vision
