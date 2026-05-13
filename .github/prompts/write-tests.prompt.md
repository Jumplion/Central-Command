---
name: 'Write Tests'
description: 'Generate unit tests for a source file'
mode: 'agent'
model: 'Claude Sonnet 4.5'
tools: ['read', 'edit']
---

Write unit tests for `#file:${input:file}`.

Follow `.github/instructions/testing.instructions.md`:
- Place the test file next to the source file
- Use `it('does X when Y')` naming with concrete inputs and outputs
- Mock `api.kv`, `api.sql`, `api.shell` at the boundary — do not test Electron internals
- Use path aliases (`@shared`, `@renderer`, etc.) — they are wired in `vitest.config.ts`
- Run `npx vitest run <path>` to verify tests pass before finishing
