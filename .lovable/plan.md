## Problem

In `src/routes/doc.$id.tsx` the `send("wa" | "email")` handler does this order:

```
await downloadPdf(...)   // async work, ~hundreds of ms
window.open(wa.me, "_blank")  // OR window.location.href = mailto:...
```

Two things break the send:

1. **User-gesture lost after `await`.** On mobile Safari/Chrome (this is a mobile PWA — `/doc/:id` on a 390px viewport), a `window.open(..., "_blank")` that runs *after* an `await` is no longer treated as a direct response to the tap, so the browser blocks the popup and nothing happens. The mailto branch has the same problem: `window.location.href = "mailto:..."` after an `await` is often ignored on iOS.
2. **`window.open("_blank")` for `wa.me`** is the wrong navigation on mobile — even inside a user gesture, iOS frequently no-ops it in standalone PWA mode. Direct top-level navigation to `wa.me` reliably opens WhatsApp (app on mobile, web on desktop).

## Plan

Rework `send` in `src/routes/doc.$id.tsx` only. No other files touched.

### 1. Do the navigation FIRST, inside the tap gesture

- Validate inputs (`customer.name`, and `phone` for WA / `email` for email) synchronously.
- Build the `msg` string synchronously.
- Immediately trigger the channel:
  - **WhatsApp**: `window.location.href = "https://wa.me/<phone>?text=..."` (top-level nav — works in mobile PWA, on iOS Safari, and on desktop where the OS/browser hands it to WhatsApp Web/desktop app).
  - **Email**: `window.location.href = "mailto:..."` (unchanged mechanism, but now inside the gesture).
- Then flip `status: "draft" → "sent"` via `update({ status: "sent" })` right after.

### 2. Move the PDF download to a separate, explicit action

- Add a small **"Download PDF"** button next to the WA / Email buttons in the same actions row.
- `send()` no longer calls `downloadPdf`. The user taps Download PDF when they want the file (they can then attach it in WhatsApp / their mail client).
- This removes the async `await` from the gesture path and also makes the PDF an intentional action rather than a hidden side-effect of "Send".

### 3. Preserve everything else

- No changes to `pdf.ts`, `store.ts`, or the message body.
- ZA phone normalization (`0…` → `27…`) stays.
- `mailto` subject/body encoding stays.

## Verification

On mobile preview at `/doc/:id`:

- Tap **WhatsApp** with a valid customer phone → WhatsApp opens with the prefilled message.
- Tap **Email** with a valid customer email → the OS mail composer opens with subject + body prefilled.
- Tap **Download PDF** → PDF saves as before.
- Missing name / phone / email still shows the corresponding toast.
- Doc status flips from `draft` to `sent` after WA or email is launched.
