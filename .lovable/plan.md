## Goal
Add a Google Maps panel to the Planner → Agenda tab showing scheduled jobs for the next 7 days, with color-coded pins by job category, pickup→drop-off route lines, and each pickup pin labeled with the scheduled date.

## Scope
- Only affects the Agenda tab of `/planner`.
- Uses the existing Google Maps browser key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`) already in `.env`.
- Uses coordinates already stored on docs (`from.coords` / `to.coords` from `AddressAutocomplete`). Docs missing coords are silently skipped (address-only jobs won't appear on the map).

## Implementation

1. **New component** `src/components/app/PlannerMap.tsx`
   - Loads Maps JS API async via `<script>` injection with `loading=async&callback=...` (per house rules; no `AdvancedMarker`, no `mapId`).
   - Props: `jobs: Array<{ id, date, category, customer, from?: {lat,lng,address}, to?: {lat,lng,address} }>`.
   - Renders `google.maps.Map`, auto-fits bounds to all pins.
   - For each job with `from.coords`:
     - Pickup pin using `google.maps.Marker` with SVG icon colored by category (reuse the same palette as planner cards: Furniture/Rubble/Garden/Sand-Stone/Grass/Other), and a small date label (e.g. "Mon 14") via the marker `label` property.
     - If `to.coords` exists: drop-off pin (same color, hollow/ring style to distinguish) + a `google.maps.Polyline` connecting pickup → drop-off in the same color.
   - Click a pin → `InfoWindow` with customer, invoice #, date, address; clicking it navigates to `/doc/$id`.
   - Height ~320px on mobile, 420px on desktop; rounded card matching existing UI.

2. **Wire into Agenda view** in `src/routes/planner.tsx`
   - Compute the next-7-days job list (jobs whose `plannerDate` or multi-day span falls within today..today+6, excluding cancelled/archived — reuse existing filters).
   - Render `<PlannerMap jobs={next7} />` at the top of the Agenda tab, above the day list. Hidden on Week/Month tabs.
   - Wrap in `<ClientOnly>` (Maps JS is browser-only).

3. **Category color helper**
   - Extract the existing planner category→color logic into a small exported helper (in `src/lib/utils.ts` or a new `src/lib/planner-colors.ts`) so the map and cards stay in sync. Returns hex codes (map SVG needs hex, not Tailwind classes).

## Technical notes
- No server-side Maps calls needed — pickup/drop-off coords are already stored on docs; no geocoding required. Jobs without coords are skipped with a small "N of M jobs shown on map" caption.
- Route lines are straight polylines between pickup and drop-off (not driving routes) to avoid per-render Routes API cost. Can upgrade to real driving routes later if desired.
- Script loader is idempotent (checks `window.google?.maps` before injecting) so tab switches don't reload.

## Out of scope
- Real driving-route polylines via Routes API (straight lines only).
- Geocoding historical jobs that lack coords.
- Map on Week/Month tabs.
