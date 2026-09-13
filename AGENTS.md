# AGENTS.md — Dida 365 Raycast Extension

## Project boundaries

- This is a strict TypeScript Raycast extension for Dida365/TickTick.
- Treat `src/` as source. Do not hand-edit `dist/`, `node_modules/`, or generated files.
- Keep command entry files thin; reuse shared UI from `src/components/`, domain logic from `src/lib/`, API wrappers from `src/api/`, and shared models from `src/types/`.
- Prefer the smallest change that fixes the root cause. Reuse existing helpers before adding abstractions or dependencies.

## API and data safety

- Use only documented public Open API endpoints. Do not add private endpoints, scraping, or undocumented authentication flows.
- Route HTTP calls through `src/api/client.ts`; keep China/international base URLs and token access in `src/lib/preferences.ts`.
- Never log, hard-code, commit, or expose the API token.
- Preserve documented request limits: project/completed-task reads max 200; batch task operations max 50 items per documented group.
- Keep task `id` and `projectId` handling explicit. Updates, moves, completion, and deletion depend on both.
- Serialize API dates with the existing helpers and respect the configured IANA timezone. Do not rely on UTC or the machine timezone accidentally.
- After mutations, invalidate every affected cache prefix. Destructive UI actions require confirmation and should refresh the visible data after success.
- Do not invent missing API capabilities. Keep local-only behavior in Raycast `LocalStorage` and label approximations or limits clearly.

## Code and UX conventions

- Follow existing TypeScript, React, and Raycast patterns; keep strict typing and avoid `any` unless an external boundary makes it unavoidable.
- Keep user-facing errors actionable. Preserve useful API status context, but never include credentials or raw sensitive payloads.
- Put parsing, date, recurrence, storage, and caching logic in testable non-UI modules.
- Keep Chinese and English wording consistent with the surrounding command instead of translating unrelated copy during a focused change.
- Add no dependency when the standard library, Raycast API, or an installed package already covers the need.

## Verification

- Use TDD for features and bug fixes: agree on the public behavior/seam, write one focused failing test, confirm it fails for the intended reason, add only enough code to pass, then repeat in vertical slices. Refactor only after the tests are green.
- Test observable behavior through public interfaces. Avoid tests coupled to implementation details, private methods, or tautological assertions.
- Add or update one focused test for non-trivial logic and bug fixes, especially API payloads, date handling, quick-add parsing, recurrence, cache, and storage behavior.
- Run the narrowest relevant check while iterating, then before handoff run:

```powershell
rtk npm test
rtk npm run lint
rtk npm run build
```

- Do not regenerate or commit `dist/` unless the task explicitly requires distributable build output.
- Report any check that could not run and why; do not claim success from inspection alone.

## Change discipline

- Inspect all callers before changing shared helpers or API contracts.
- Preserve unrelated user changes and avoid broad formatting or cleanup.
- Update `README.md` and `package.json` only when behavior, setup, commands, preferences, or public API coverage actually changes.

## Agent responsibilities

- The main agent owns planning, task decomposition, coordination, final integration, verification, and communication with the user.
- Delegate independent research, implementation, testing, and review tasks to subagents when parallel work is useful.
- Give each subagent a narrow scope, clear expected output, and non-overlapping file ownership. Subagents must not redefine the overall plan or expand scope.
- The main agent must review and verify subagent results before accepting or integrating them; delegation does not transfer accountability.
