# `src/renderer/src/styles/` — Global CSS

This folder contains the application-wide CSS that styles the shell of Central Command (the sidebar, dashboard grid, widget chrome, and utility classes).

## Files

| File          | What it does                                                   |
| ------------- | -------------------------------------------------------------- |
| `globals.css` | Every CSS rule for the app shell — imported once in `main.tsx` |

---

## How CSS is loaded

`globals.css` is imported at the top of `src/renderer/src/main.tsx`:

```ts
import "./styles/globals.css";
```

Vite processes this import: in development it injects the styles into the page via a `<style>` tag; in production it bundles the CSS into a `.css` file that `index.html` links to.

The `"sideEffects": ["**/*.css"]` entry in `package.json` tells bundlers that CSS imports have side effects (they change the page) and should never be tree-shaken away even if the import isn't referenced.

---

## What's styled here vs. in widgets

**`globals.css` styles:**

- CSS custom properties (variables) for colors, spacing, and typography
- The overall app layout (`.app`, `.sidebar`, `.main`)
- Widget chrome (`.widget`, `.widget-header`, `.widget-body`, `.widget-actions`)
- Common UI utilities (buttons, empty states, error states)
- The drag-and-drop grid layout overrides for `react-grid-layout`

**Widget-specific styles:**
Widgets are responsible for their own internal styles. They can:

- Use inline styles (`style={{ color: 'red' }}`)
- Import a CSS module (`import styles from './styles.module.css'`)
- Use the CSS custom properties defined here for consistent colors and spacing

Widget styles apply _inside_ `.widget-body`, so they can't accidentally affect the rest of the dashboard.

---

## CSS custom properties

The app uses CSS variables (custom properties) to define its design tokens. These are defined on `:root` and can be referenced anywhere:

```css
/* Defined in globals.css */
:root {
  --bg: #0e0f12;
  --surface: #16171c;
  --border: #2a2b31;
  --text: #e2e4ea;
  --text-dim: #7a7d8a;
  --accent: #5b8af0;
}

/* Used anywhere */
.widget-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
```

Using variables means changing the color scheme in one place updates it everywhere.
