## Change

In `src/routes/planner.tsx` `JobCard`, when `jobMaterialCategory(doc) === "other"` and `doc.notes` is non-empty, render the notes below the summary line (`jobSummary`) as a small 2-line clamped block. Other categories are unchanged.

- Line: `{jobMaterialCategory(doc) === "other" && doc.notes && (<div className="opacity-80 line-clamp-2 whitespace-pre-wrap">{doc.notes}</div>)}`
- No other files touched. Same treatment applies to the smaller `MonthJobCard` at line 552 area? Confirming: month view uses a different tiny card that only shows the customer name — I'll leave that alone (too tight for notes). Only the agenda/week `JobCard` shows the notes.

## Files

- `src/routes/planner.tsx` — one added block inside `JobCard`.