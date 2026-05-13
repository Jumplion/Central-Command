---
name: 'Testing'
description: 'Test conventions for this project'
applyTo: '**/*.test.{ts,tsx}'
---

## Conventions

- Test files live next to the source file they test (`foo.ts` → `foo.test.ts`)
- Run all tests: `npx vitest run`
- Run a single file: `npx vitest run src/widgets/job-aggregator/api.test.ts`
- Path aliases (`@shared`, `@renderer`, etc.) are resolved via `vitest.config.ts` — use them in tests

## Style

- Name tests with `it('does X when Y')` — concrete inputs and expected outputs
- Prefer unit tests over integration tests for widget logic; mock `api.kv`, `api.sql`, `api.shell` at the boundary
- No snapshot tests unless the output format is the actual contract being tested
