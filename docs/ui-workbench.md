# Focus workbench UI

Owner-requested implementation, 2026-10-28. Branch: `codex/ui-focus-workbench`.
Based on `origin/main` at `e637524`, including the MCP release. Scope was directly authorized by the owner: implement the local redesign in a branch from main, preserving the technical-sheet identity and existing learning/source tools. This record does not change another plan's approval or status.

Since 2026-10-29 this work, at `1f09169`, is the starting point of plan [P-20261029-ui-workbench](workflow/plans/P-20261029-ui-workbench/plan.md), which makes the workbench lighter and puts the source back beside the explanation. This file records Codex's work as it was merged; the plan records what changed after it.

## Result

The player separates the technical sheet from a reading inspector with Part/Activity and Source tabs. Tabs retain notes and the selected source view. Selecting a part keeps its explanation visible; explicit citations open the source. Run actions stay visible while the explanation scrolls.

The drawing retains icons, reading balloons, typed joints, title block, nested assemblies and keyboard navigation. Simple long chains can fold into rows to keep plates readable beside the inspector; branching graphs keep the existing layout. The projection changes renderer geometry only, preserving core ids, reading order and edge direction. Fit/zoom, panel resizing and canvas/source focus controls remain device-local.

The full Bill of materials retains parts, recursive numbering, line coverage and reasoned exclusions. Sources retain numbered lines, rendered Markdown, source selection and the separate full-window reader. Its outline is reachable at narrow widths. There is no new Markdown editing capability: Document remains a rendered reading view.

Paper and blueprint themes, Italian/English controls, generation, MCP attribution and persistence use the existing contracts. Reassembly retains icons in the tray and filled slots; empty slots do not reveal the answer.

## Verification

- `npm run check`: passed, 28 files / 391 tests, including inspector keyboard navigation, note/view retention, source reader, resize controls and geometry across public fixtures.
- `npm run build`: passed, renderer and desktop bundles. Existing dependency-level `use client` bundler warnings remain non-blocking.
- `git diff --check`: passed.
- Browser checks: paper at 1440px, blueprint at 1280px, layouts at 720px and 390px; no horizontal page overflow in the narrow checks. Source Lines/Document, reader outline navigation and Escape, Bill of materials, scenario prediction/execution feedback and placement in reassembly exercised.
- Compiled Electron smoke test (`btw://app/`, temporary isolated data): opened a prepared example, wrote a note, switched to Markdown, opened/closed the reader, opened the Bill of materials and placed a part in reassembly with icons.
- No screen-reader or independent human usability study was performed. Live AI generation and external MCP clients were not exercised for this visual change; their automated tests passed.

## Try locally

The branch is checked out in the managed worktree:

```sh
cd /Users/simone/.codex/worktrees/ui-focus-workbench/BreakTheWall
npm start
```

The production bundle is already built locally. Use the project's Node 22 / npm 10 versions. For development with live updates, use `npm run dev` instead.

Suggested review: choose a prepared example, open a nested part, compare Lines/Document and the reader outline, run a step, inspect the Bill of materials, then reassemble. Repeat in paper and blueprint. The standalone mockup on port 5188 is separate from this implementation.
