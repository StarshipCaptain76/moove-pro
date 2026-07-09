## Mobile-first overhaul

Target: one-handed use on a phone. Every primary action reachable with the thumb; secondary actions tucked behind sheets/menus; no horizontal scroll; no tiny hit targets (min 44px).

### Global shell (`src/components/app/Shell.tsx`)
- Slim sticky top bar: MOOVE wordmark left, sync dot + overflow menu right. Drop the desktop nav row entirely on mobile.
- New **bottom tab bar** (fixed, safe-area padded): Dashboard · Planner · New · Results · Settings. Center "New" is a raised FAB that opens a sheet to pick Quote or Invoice.
- Desktop (≥md): keep the current top nav, hide the bottom bar.
- Main content: `pb-24` on mobile so nothing hides under the tab bar.

### Dashboard (`/`)
- Compact hero: smaller display headline, single-line greeting.
- Stats grid: 2×2 on phone, edge-to-edge cards with big numbers, tiny labels.
- Merge "Today's jobs" + "Recent" into a single tabbed list (Today / Recent) — one card, less scrolling.
- Remove the top-right dual New Quote/Invoice buttons (moved to the FAB).
- Each list row: full-width tappable, chevron affordance, status pill.

### Document editor (`/doc/$id`) — the most-used screen
This is where the biggest wins live. Rework into a **stepper/section layout** optimized for typing on a phone:

- Sticky compact header: back · doc number · status pill · overflow menu (delete, duplicate).
- **Sticky bottom action bar** with the primary send actions (WhatsApp big & green, Email, PDF as icons). Always thumb-reachable while scrolling long forms.
- Sections stack vertically as collapsible cards, opened by default in this order:
  1. **Customer** — name combobox full-width; phone + email stacked (not side-by-side on phone); big touch inputs (`h-11`).
  2. **Route** — From / To autocompletes stacked; Disposal chip inline; "Calculate distance" button full width; km readout as pill.
  3. **Line items** — each row becomes a mini-card: description on top row, qty × price on second row with `inputMode="decimal"`, trash icon right. "+ Catalog / KM / Blank" as a segmented action row.
  4. **Totals & deposit** — sticky summary card with big total, deposit slider/steppers instead of a number field (with quick chips 0/25/50/100%). Deposit-paid as a switch.
  5. **Schedule** — date picker button full-width.
  6. **Notes** — collapsed by default.
- Convert-to-invoice / Mark-paid move into the overflow menu; Mark-paid opens a bottom sheet with big Cash/EFT/Card buttons.

### Planner (`/planner`)
Week view of 7 columns is unusable on 390px. Replace with mobile-specific view:

- **Mobile default:** vertical "agenda" — a scroll list of upcoming days (Today, Tomorrow, then dated). Each day is a section header with the date + job count; jobs are full-width cards with category color stripe, customer, total, and a drag handle. Long-press to drag between days; tap to open.
- Toolbar as a **segmented control**: Agenda · Week · Month. Week/Month still available but Week becomes horizontal-scroll snap columns; Month keeps the 7-col grid (already dense but readable).
- Unscheduled jobs collapse into a pill at the top ("3 unscheduled ▾") that expands into a drop zone.
- Prev/next/today become icon buttons with the date range as a tap-to-open month sheet.

### Results (`/results`)
- Stat grid 2×2 on phone with tighter padding.
- Charts stack full-width; reduce heights to ~200px for mobile; hide `<Legend>` where the pie already labels slices; add a period selector (30d / 3m / 12m / YTD) as a segmented control instead of always showing all four charts.
- Wrap in a horizontal snap-scroll strip for the two pies so the fold isn't half-charts.

### Settings (`/settings`)
- Tabs already OK; make the tab strip horizontally scrollable and sticky under the header.
- Company / Banking / Billing forms: single column, `h-11` inputs, inputMode hints on numbers.
- Catalog: already redesigned last turn — verify the collapsed rows keep 44px hit targets and the add/search row stacks on narrow widths.

### Design tokens & primitives
- Add `--safe-bottom` env-aware padding utility for the bottom bar.
- New `MobileTabBar`, `BottomSheet` (wrap shadcn `Sheet`), and `SegmentedControl` components.
- Standardize input height: `h-11` on mobile, `h-9` on desktop via a `.field-input` utility.
- Set `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (already there) — add `theme-color` matching the header for PWA feel.

### Out of scope (unless asked)
- Turning this into a real PWA (manifest, service worker, install prompt).
- Offline queueing beyond the existing local store + debounced sync.
- Deep gesture work (swipe-to-delete rows, pull-to-refresh).

### Build order
1. Shell + bottom tab bar + FAB sheet.
2. Doc editor rework (biggest daily-use win).
3. Planner agenda view.
4. Dashboard condensation.
5. Results + Settings polish.
