---
name: "TypeScript & React Standards"
description: "Coding conventions for all TypeScript and React files"
applyTo: "**/*.{ts,tsx}"
---

## Imports & aliases

- Always use path aliases (`@shared`, `@main`, `@renderer`, `@widgets`) — never `../../` traversals
- `src/shared/` is compiled under both `tsconfig.node.json` and `tsconfig.web.json`; no Node-only APIs there

## React patterns

- Catch all async errors inside `useEffect`; surface with a local `error` state — never let rejections propagate unhandled
- Pass primitive IDs to memoized components (`WidgetHost` uses `memo()`); avoid fresh object literals as props
- `.widget` has `contain: layout style paint` — `position: fixed` and portals are clipped; don't use them inside widgets
- Open external links with `api.shell.openExternal(url)`, not `window.open`

## Error handling

- IPC calls (`window.cc.*`) return rejected promises on failure — always `.catch()` and show an inline error state
- `api.sql` rejects on schema/constraint errors — always handle in `useEffect` and surface with `setError(e.message)`
- Widget render errors are caught by `WidgetHost`'s error boundary; the rest of the dashboard stays functional

## Style

- No comments unless the WHY is non-obvious (hidden constraint, workaround, subtle invariant)
- No multi-line docstrings or block comments
