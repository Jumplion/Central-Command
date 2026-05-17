## Plan: Codebase Audit and Refactoring Recommendations

TL;DR: Review the current Central Command repo for repeated patterns and structural complexity, then recommend targeted refactors in shared IPC/storage layers, renderer state/API, and widget code. The goal is to reduce duplication, make code easier to maintain, and keep performance overhead low.

**Steps**

1. Audit shared backend IPC and storage code.
   - Review `src/main/ipc.ts` for repeated validation wrappers and handler registration patterns.
   - Review `src/main/storage/json.ts` and `src/main/storage/sqlite.ts` for duplicated path/construction logic and storage helpers.
   - Recommend extracting common helpers for widget path resolution and safe argument validation.

2. Audit renderer-side widget infrastructure.
   - Review `src/renderer/src/plugins/api.ts` for repeated wrapper methods around `window.cc` and duplicated `google.shared` helper logic.
   - Review `src/renderer/src/plugins/registry.ts` and `src/renderer/src/state/dashboard.ts` for repeated state patching patterns.
   - Propose unifying `WidgetSettingsPanel.tsx` field rendering and `WidgetHost.tsx` wrapper semantics.

3. Audit widget plugin code and shared widget utilities.
   - Review the attached `src/widgets/job-tracker` widget and identify repeated form suggestion logic and inline styling.
   - Review the shared widget area in `src/widgets/_shared` for existing reusable components and opportunities to add shared form/input primitives.
   - Recommend moving repeated UI patterns and helper functions into shared widget utilities.

4. Produce concrete recommendations for code simplification and maintainability.
   - Suggest explicit files/components to extract.
   - Recommend moving repeated inline styles into shared CSS classes or style utility helpers.
   - Identify low-risk refactors that preserve current behavior while reducing code paths.

5. Validate recommendations by connecting them to actual files and architecture.
   - Confirm shared utilities align with existing repo conventions from `.github/copilot-instructions.md`.
   - Verify that recommended refactors would not violate renderer/main separation or widget authoring rules.
   - Verify no proposed refactor introduces a cross-process dependency between renderer and main.

**Relevant files**

- `src/main/ipc.ts` — repeated IPC handler validation and registration helpers.
- `src/main/storage/json.ts` and `src/main/storage/sqlite.ts` — duplicated widget path management.
- `src/renderer/src/plugins/api.ts` — repeated API wrapper generation and Google shared auth logic.
- `src/renderer/src/components/WidgetSettingsPanel.tsx` — repeated settings field renderers.
- `src/renderer/src/state/dashboard.ts` — repeated active-dashboard patch/update patterns.
- `src/renderer/src/components/Dashboard.tsx` — repeated layout item mapping and widget lookup.
- `src/widgets/job-tracker` — repeated suggestion/autocomplete logic and inline styles.
- `src/widgets/_shared/StackedBarChart.tsx` — existing shared component that can be expanded.

**Verification**

1. Confirm the audit against actual code structure by reviewing the above files and existing patterns.
2. Use repository conventions from `.github/copilot-instructions.md` to ensure recommendations fit project architecture.
3. Verify no proposed refactor introduces a cross-process dependency between renderer and main.
4. Optionally run `npm run typecheck` and `npm test` after actual refactors to ensure no regressions.

**Decisions**

- This audit is focused on architecture and maintainability, not on implementing changes.
- It covers main IPC/storage, renderer state/api, and widget/plugin code, with special attention to the attached `job-tracker` widget.
- I am not proposing large architectural rewrites; instead, the emphasis is on extracting shared helpers and removing repeated patterns.
