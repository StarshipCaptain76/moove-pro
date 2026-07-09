
# MOOVE Quote & Invoice App

A single-user local-first web app for MOOVE Moving Company. No login. Data stored in the browser (Lovable Cloud enabled for optional cross-device sync later; v1 uses local storage for zero-friction).

## Branding

- Logo: uploaded MOOVE truck logo (uploaded as CDN asset).
- Colors sampled from moove.durable.site + logo: black `#0A0A0A`, MOOVE red `#E11D2E`, off-white `#FAFAFA`, muted grey `#6B6B6B`.
- Typography: bold condensed display (Bebas Neue) for headings, Inter for body — matches transport/logistics feel.
- Company details baked into settings defaults: MOOVE, Stilbaai, contact from Google Business profile.

## Core screens (5 routes, minimum-tap flow)

```text
/              Dashboard: [+ New Quote] big CTA, recent docs, today's jobs
/doc/$id       Quote/Invoice editor (single screen — the whole flow)
/planner       Calendar with drag-drop jobs
/results       Analytics: pie charts, MoM, YoY
/settings      Products/services catalog, KM rate, banking, deposit %, company info
```

## New quote → sent in minimum steps

Single-page editor at `/doc/$id`:

1. Auto-fills company + banking from settings.
2. Customer: name, phone (WA-ready), email — 3 inputs, autocomplete from past customers.
3. Line items: pick from catalog dropdown OR add "KM billing" row (enter km × rate from settings, or paste pickup+dropoff to auto-calc via optional Google Maps).
4. Deposit %: slider/input (defaults from settings), auto-shows deposit amount + balance.
5. One row of action buttons — the whole "send" flow is one tap each:
   - **Send WhatsApp** → opens `https://wa.me/<phone>?text=<pre-filled message + link to hosted PDF>`
   - **Email PDF** → opens `mailto:` with PDF attached (generated client-side, downloaded + attached via `mailto` body link to hosted PDF)
   - **Download PDF**
   - **Convert to Invoice** (if quote) / **Mark Paid** (if invoice)

Payment marking: single button opens a small sheet → Cash / EFT / Card + optional "Deposit paid" toggle. No extra screens.

## KM billing

- Settings holds default rate/km (e.g. R15/km) and base callout fee.
- Line item type "Distance": manual km entry by default; optional "Calc from addresses" button uses Google Maps Distance Matrix if a key is added (asked for on first use, stored as secret). Falls back to manual if not configured.

## Planner (`/planner`)

- Week view (7 day columns) + month strip toggle.
- Any invoice/quote marked "Accepted" auto-appears as a job card in its scheduled day.
- Drag between days to reschedule; drag within a day to reorder (uses `@dnd-kit`).
- Click a card → jumps to the underlying doc.

## Results (`/results`)

- Filters: date range, this month, YTD.
- Cards: revenue, outstanding, deposits held, jobs completed.
- Charts (Recharts):
  - Pie: revenue by payment method (Cash/EFT/Card).
  - Pie: revenue by service type (from catalog).
  - Bar: MoM revenue (12 months).
  - Bar: YoY comparison (current vs previous year by month).

## Settings (`/settings`)

Tabs:
- **Company**: name, address, phone, email, logo (pre-filled MOOVE).
- **Banking**: pre-filled with the FNB details you provided.
- **Catalog**: CRUD list of products/services (name, default price, unit).
- **Billing**: default rate per KM, base callout, default deposit %, VAT %, doc number prefixes, next quote/invoice number.
- **Integrations**: optional Google Maps API key.

## PDF generation

Client-side with `@react-pdf/renderer` — branded template (logo top-left, red accent bar, banking block at bottom, deposit + balance summary). Same template renders quotes and invoices with different headers/watermark. Generated PDF is downloaded locally AND uploaded to Lovable Assets to get a shareable URL for the WhatsApp deeplink.

## Data model (localStorage via a small store)

```text
company, banking, billingSettings, catalog[], customers[], documents[], jobs[]
```

`documents[]` holds both quotes and invoices (typed). `jobs[]` is derived from accepted documents + a scheduled date + ordering index per day.

## Tech choices

- TanStack Start routes as listed.
- Zustand (persisted) for local store.
- shadcn/ui + Tailwind for UI.
- `@dnd-kit/core` + `@dnd-kit/sortable` for planner drag-drop.
- `recharts` for analytics.
- `@react-pdf/renderer` for PDFs.
- `date-fns` for date math.
- Google Maps Distance Matrix (optional, key stored via `add_secret` on first use; called through a server function so the key stays server-side).

## Out of scope for v1 (can add later)

- Multi-user / login.
- WhatsApp Business API auto-send (using deeplink instead as chosen).
- Email SMTP auto-send with real attachment (using mailto + hosted PDF link).
- Cloud sync (data is local; can be added by turning on Lovable Cloud + a sync toggle).

## Build order

1. Design system (colors, fonts, logo asset), shell layout with nav.
2. Settings page + persisted store with all defaults (banking, catalog seed, KM rate).
3. Dashboard + document editor + PDF template + payment marking.
4. WhatsApp deeplink + mailto send.
5. Planner with dnd-kit.
6. Results with Recharts.
7. Optional Google Maps KM auto-calc.
