## Goal
Fix the WhatsApp and email share text on quotes/invoices, and attach the PDF when emailing.

## Changes

### 1. Shared message builder (`src/lib/share-message.ts` — new)
One helper `buildShareMessage(doc, company, banking, currency)` returning a string used by both WA and email:

```
Hi {customer},

Here is your {quote|invoice} {number} from {company}.

Items:
- {qty} × {name} @ {price} = {lineTotal}
- ...

Subtotal: {subtotal}
VAT: {vat}
Total: {total}
[Deposit ({pct}%): {deposit}]   ← only if depositPct > 0 AND deposit > 0

Banking:
{bank} • Acc {acc} • Branch {branch}
Ref: {number}

Thanks!
{company}
```
The deposit line is omitted entirely (no blank line) when `depositPct === 0` or `t.deposit === 0`.

### 2. WhatsApp send in `src/routes/doc.$id.tsx` and `src/routes/doc..tsx`
Replace the inline `msg` template with `buildShareMessage(...)`. No other WA behaviour changes.

### 3. Email send in both doc routes
- Build the same message via `buildShareMessage`.
- Generate the PDF blob using the existing `src/lib/pdf.ts` helper.
- Try `navigator.share({ files: [pdfFile], title, text })` first (mobile Safari/Android supports file share to Mail/Gmail).
- Fallback: trigger a PDF download (`saveAs`-style anchor click) AND open `mailto:` with the message body — toast tells the user "PDF downloaded — attach it to the email".
- Desktop path therefore always yields the PDF locally plus a pre-filled mail draft; true attachment isn't possible with `mailto:` alone.

### 4. No other UI, data, or backend changes.

## Technical notes
- `mailto:` cannot carry attachments per RFC — the download+mailto fallback is the standard workaround.
- Line-item formatting uses existing `fmtMoney` and `doc.items[]` (qty, name/description, unitPrice/price, total) — will match the field names already used in the PDF renderer.
- Deposit omission check: `doc.depositPct > 0 && t.deposit > 0`.
