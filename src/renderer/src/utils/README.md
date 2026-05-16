# `src/renderer/src/utils/` — Utility Functions

This folder holds small, general-purpose functions that are useful in the renderer but don't belong in a specific component or hook.

## Files

| File | What it does |
| --- | --- |
| `csv.ts` | Re-exports CSV parsing/formatting utilities from `src/shared/csv.ts` |

---

## `csv.ts`

This file is a thin re-export of the CSV utilities defined in `src/shared/csv.ts`. Having it here under `@renderer` means renderer code can import from `@renderer/utils/csv` without needing to reference `@shared` directly — a small convenience that keeps imports consistent within the renderer.

See `src/shared/README.md` for documentation on what the CSV functions actually do.

---

## Adding new utilities

If you write a helper function used by more than one component or widget, put it here. Good candidates:

- Date formatting helpers
- String manipulation (truncation, slugification)
- Number formatting (percentages, file sizes)

If the utility is needed in both the renderer *and* the main process, put it in `src/shared/` instead.
