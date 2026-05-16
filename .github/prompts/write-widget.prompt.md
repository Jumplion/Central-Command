---
name: "Write Widget"
description: "Scaffold a new widget plugin"
agent: "agent"
model: "Claude Sonnet 4.5"
tools: ["read", "edit", "search/codebase"]
---

Create a new widget at `src/widgets/${input:id}/index.tsx`.

Requirements:

- Widget id: `${input:id}` (must match folder name, satisfy `^[a-z0-9][a-z0-9-]{0,63}$`)
- Widget name: `${input:name}`
- Description of behavior: `${input:description}`

Follow `.github/instructions/react-widgets.instructions.md` exactly:

- Use the minimal widget skeleton as the starting point
- Initialize any SQL tables with `CREATE TABLE IF NOT EXISTS` in `useEffect`
- Parameterize all SQL queries
- Catch all async errors and surface with `setError`
- Set `manifest.permissions` only for capabilities the widget actually uses
