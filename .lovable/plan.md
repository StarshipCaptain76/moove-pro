## Goal

On quotes and invoices, allow adding extra stops between the pickup (From) and drop-off (To) addresses, calculate the total distance across the full route, and let stops be reordered.

## What it looks like

In the Route card of the quote/invoice editor:

```text
From:  [ 12 Main Rd, Stilbaai        ]
Stop 1 [ 5 Beach Rd                  ] [↑] [↓] [x]
Stop 2 [ Warehouse, Riversdale       ] [↑] [↓] [x]
       [ + Add stop ]
To:    [ 44 Church St, Mossel Bay    ] [Disposal site]
       [ Calculate distance ]   38.4 km
```

- Each stop uses the same Google address autocomplete as From/To.
- Up/down arrows move a stop in the route order; the x removes it.
- Distance is calculated for From → Stop 1 → Stop 2 → To as one total, so reordering changes the total.
- Jobs keep the simplified card (no route/distance), unchanged.

## Where stops appear

- PDF: the route block lists From, each stop in order, then To, with the total distance.
- WhatsApp/email share message: same ordered list.
- Planner map: stops added as waypoints on the drawn route for that job.

## Technical notes

- New `stops jsonb not null default '[]'` column on `docs` (array of `{ address, coords? }`), with the existing owner-scoped RLS unchanged; add `stops?: Array<{address: string; coords?: {lat:number;lng:number}}>` to the `Doc` type and to the sync push/pull mapping in `src/lib/sync.ts`.
- `routeDistance` in `src/lib/maps.functions.ts` gains an optional `intermediates` array, passed to the Routes API `intermediates` field (Routes API supports up to 25); returns the summed `distanceMeters` as today.
- Editor changes in `src/routes/doc.$id.tsx`: stop list state driven off `doc.stops`, reorder via index swap, calculation passes stops through in order.
- `src/lib/pdf.ts`, `src/lib/share-message.ts`, and `src/components/app/PlannerMap.tsx` read the ordered stops.
