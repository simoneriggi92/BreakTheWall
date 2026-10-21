# Player phase verification

Date: 2026-10-21. Scope: T1–T3 only. Toolchain: Node 22.23.2, npm 10.9.8, macOS arm64.

## T1 — desktop toolchain

Exact dependency versions are in package.json and the lockfile. `npm ci` exited 0. `npm run build` exited 0. Electron 45.0.0 launched on macOS arm64; the native accessibility tree showed “Break the Wall” at `btw://app/`. This is a local launch, not installer distribution.

## T2 — contracts

18 contract tests: missing/out-of-range/inexact evidence, source hash mismatch, dangling map/frame references, invalid activity solutions, source text resembling instructions or executable markup, guided gates, and revision-bound state restoration.

## T3 — two prepared lessons in one player

Both original fixtures (request flow in code, thermostat feedback loop without code) render through the same components; the renderer has no topic-specific branch.

| Check | Level | Result |
|---|---|---|
| `npm run check` (strict TypeScript + Vitest) | automated test | exit 0, 36 tests: 18 contract, 15 player interaction, 3 desktop progress store |
| `npm run build` | targeted build | exit 0. Rolldown warns that a dependency's `"use client"` directive is not preserved; no effect on this bundle |
| Player interaction, per lesson (`tests/player.test.tsx`, jsdom + Testing Library) | automated test | Map node selection shows the node's evidence; every sequence frame moves the highlighted lines to that frame's evidence; a wrong prediction shows that option's specific feedback and keeps the guided gate and later pages locked; the correct one opens the gate; order reconstruction names the first wrong step, then succeeds after reordering with the move buttons; exploration mode unlocks every page; page, attempts and notes resume after the lesson is closed and reopened |
| Keyboard operation | automated test | Space selects an option and Enter submits it, in both lessons. A manual screen-reader pass has not been done |
| Desktop persistence (`tests/progress-store.test.ts`) | automated test | Atomic round trip of page, attempts and notes; an unreadable file is preserved with a notice and the session restarts; an unknown revision is rejected |
| Desktop flow on the production build | integration check (scripted through the DevTools protocol, isolated `BTW_USER_DATA_DIR`) | First launch: runtime shows “DESKTOP · LOCALE”; thermostat page 2 gate closed; wrong answer → specific feedback, gate still closed; right answer → gate open; a note is saved and `workspaces/thermostat-loop/v1.json` holds the page, 2 attempts and the note. Second launch: the lesson reopens on the same page with the note, an open gate and “2 tentativi registrati”. No errors in the app log |
| Layout | witnessed in the browser renderer (`npm run dev:web`) | All 10 pages of both lessons, with every disclosure open, at 375, 720, 1024 and 1440 px: no document overflow outside the scroll containers for code lines, comparison tables and the narrow page index. Screenshots inspected for clarity at 375, 720, 1024 and 1440 px |

Defect found and fixed during T3: `ProgressStore.save` passed the whole learner state to the strict progress-key schema, so every desktop save would have failed. The store test caught it.

Known limitations, recorded rather than resolved in this phase:

- The Electron window background is light (`#f3f5ef`); in dark system mode a brief light frame can appear before the dark renderer paints.
- The renderer was inspected for layout in a browser, not in the Electron window at every width. Electron's minimum width is 720 px, which is covered by the browser sweep.
- On narrow screens the course title in the top bar is truncated, and the page index becomes a horizontally scrolling strip.
- Visiting pages or solving activities is recorded, but it is not evidence of understanding; the UI says so.

No provider authentication or inference, source import, learning-efficacy validation, or external participant session has occurred. Only original fixtures and project files are included; private prototype snapshots are excluded.

## Verification run — player phase

Run on 2026-10-21 after implementation, on branch `feature/t3-player`.

| Required check | Command or method | Result |
|---|---|---|
| No topic-specific renderer branch | `grep` of `src/renderer` for lesson identifiers and topic words | passed: only the generic `thermometer` entry of the icon vocabulary matches |
| Strict types | `npm run typecheck` | passed, exit 0 |
| Automated tests | `npm test` | passed, 36/36 |
| Clean install | `npm ci` | passed, exit 0, 0 vulnerabilities reported |
| Production build | `npm run build` | passed, exit 0 |
| Desktop launch and resume | scripted two-launch flow on the production build (see T3 table) | passed |
| Keyboard flow, code lesson | witnessed in the browser renderer with real key presses: Tab to the lesson card, Enter opens it, Tab to a map node, Enter selects it (line 12 highlighted), Enter on “Prossima tappa”, Tab to frame 3, Space selects it (line 11 highlighted), Space selects answer A, Tab and Enter submit it (specific feedback, gate closed), Down selects B, Enter submits it (gate open) | passed |
| Keyboard flow, thermostat lesson | witnessed in the browser renderer: Enter opens the lesson, Enter selects “Esplora”, Enter opens page 4, Enter on the move buttons reorders the steps, Enter submits (success feedback). Focus was placed on these controls programmatically between steps rather than reached with Tab | passed, with that limitation |
| Layout at 375, 720, 1024, 1440 px | browser renderer sweep and screenshots | passed |

Verdict: T1, T2 and T3 meet their acceptance criteria at the stated evidence levels. Not covered: a manual screen-reader pass, a person using the Electron window directly, and any learner beyond the owner. The generation phase (T4–T6) has not started.
