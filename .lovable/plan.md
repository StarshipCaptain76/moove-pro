## Add swipe navigation to Planner views

Enable touch swipe gestures on `/planner` so the user can navigate through time without tapping the chevron buttons.

### Behavior

- **Agenda view**: swipe left/right shifts the visible window by 1 day (advances/rewinds the "start from today" anchor by ±1 day).
- **Week view**: swipe left/right shifts `weekStart` by ±7 days.
- **Month view**: swipe left/right shifts `monthAnchor` by ±1 month.

Swipe right → previous period. Swipe left → next period. Chevron buttons and Today button remain unchanged.

### Technical details

- Edit only `src/routes/planner.tsx`.
- Add a small local `useSwipe` hook (touch + pointer events) with a horizontal threshold (~50px) and vertical-dominance guard so vertical scrolling isn't hijacked.
- Currently Agenda has no anchor state — it always starts from `new Date()`. Introduce `agendaStart` state (default `new Date()`) and derive the 60-day window from it. Add a "Today" button for Agenda too (only shown when `agendaStart` isn't today) so users can return after swiping.
- Wrap each view's content container with the swipe handlers; dispatch to the correct setter based on active `view`.
- Attach `touch-action: pan-y` to the swipe container so vertical scroll still works while horizontal swipes are captured.
- Ensure swipe handlers don't interfere with existing `@dnd-kit` drag (PointerSensor already requires 8px activation; swipe listens on the container, drag listeners are on job cards — no conflict expected, will verify).

### Files

- `src/routes/planner.tsx` — add `useSwipe`, add `agendaStart` state, wrap the three view containers with swipe handlers.
