# `src/widgets/_shared/` — Shared Widget Components

This folder holds React components that are used by more than one widget. Rather than copy-pasting the same component into multiple widget folders, it lives here and is imported by any widget that needs it.

## Why the underscore prefix?

The folder is named `_shared` (with a leading underscore) instead of `shared` so it is sorted to the top in file explorers and clearly distinguished from actual widget folders. The plugin registry's glob pattern (`src/widgets/*/index.tsx`) only picks up folders that have an `index.tsx` — since `_shared` has no `index.tsx`, it will never be treated as a widget.

## Files

| File | What it provides |
|---|---|
| `StackedBarChart.tsx` | A horizontal stacked bar chart rendered with plain HTML/CSS |

---

## `StackedBarChart.tsx`

A reusable chart component that renders a horizontal bar divided into colored segments, with an optional legend. Used by `media-tracker` to visualize status breakdowns (e.g., how many books are Want vs. In Progress vs. Done).

### Why not a charting library?

Charting libraries (Chart.js, Recharts, etc.) are large dependencies that add significant bundle size. A simple stacked bar — colored `<div>` elements with flex layout — achieves the same visual result with zero additional dependencies and is much easier to style to match the app's dark theme.

### Usage

```tsx
import { StackedBarChart } from '@widgets/_shared/StackedBarChart';

<StackedBarChart
  segments={[
    { label: 'Want',        count: 12, color: '#5b8af0' },
    { label: 'In Progress', count:  4, color: '#f0a05b' },
    { label: 'Done',        count: 28, color: '#5bf090' },
  ]}
  total={44}
/>
```

- `segments` — array of `{ label, count, color }` objects, one per bar section
- `total` — the sum of all counts (used to calculate percentages for bar widths)

Segments with a `count` of 0 are hidden automatically.

---

## Adding new shared components

If you write a component that two or more widgets use, add it here. Keep the interface generic — shared components should not know about any specific widget's data model. Accept plain data as props.
