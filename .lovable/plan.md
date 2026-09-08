# Per-task pickup and drop-off addresses

Today a quote or invoice has one route: a From address, optional stops, and a To address. When several tasks are billed on one document, each task can actually run between different places. This adds an optional pickup and drop-off address to every line item.

## What changes for the user

- Each line item on a quote or invoice gets a small "Addresses" area with an optional **Pickup** and **Drop-off**, both using the same Google address search already used elsewhere.
- Blank task addresses simply fall back to the document's main From / To, so nothing changes for simple single-route jobs.
- **Calculate distance** builds one combined route: main pickup, the existing stops, then each task's pickup and drop-off in the order the tasks appear, ending at the main destination. Duplicate consecutive addresses are skipped so the total stays sensible. The result still lands in the single "Transport (x km)" line and the internal estimated trip value.
- On the printed quote and invoice, a task that has its own addresses prints a light grey line beneath its description: `From … → To …`. Tasks without their own addresses print as they do now.
- Jobs (job cards) are unaffected; they have no line items.

## Technical notes

- `LineItem` in `src/lib/store.ts` gains optional `fromAddress`, `toAddress`, `fromCoords`, `toCoords`. Items are already stored as JSONB in `docs.items`, so no database migration is needed.
- `src/routes/doc.$id.tsx`: add a collapsible address block per item using `AddressAutocomplete` wired through the existing `updateItem`. Extend `calcDistance` to assemble the ordered waypoint list (main from, doc stops, each item's from/to, main to), de-duplicate consecutive identical addresses, and drop empties before calling `distanceFn`.
- The Routes API waypoint limit is 23 intermediates (`src/lib/maps.functions.ts`). If the assembled route exceeds it, keep the first 23 and show a toast explaining that later task legs were left out of the total.
- `src/lib/pdf.ts`: in the items table loop, when an item carries its own addresses, render an extra wrapped small-text line under the description and grow that row's height accordingly, keeping the existing page-break handling intact.
- Share/WhatsApp text stays as-is (main route only).
