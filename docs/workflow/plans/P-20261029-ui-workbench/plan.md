---
id: P-20261029-ui-workbench
title: A lighter workbench - one row of chrome, claim and source side by side, the prediction first in Run
version: 1
state: implementing
current_task: U2
last_evidence: U1 verified - Codex redesign merged onto main (4c342e1), typecheck and 403 tests pass
next_action: Owner runs "implement P-20261029-ui-workbench v1 --phase chrome"
approval: approved
---

# A lighter workbench

## Outcome

The player keeps what Codex's redesign gained and loses the weight it added:
- **Less chrome, more drawing.** At 1440×900, the drawing starts at most 110 px from the top of the window (now 329 px). It sits on the paper with no card, toolbar bar or footer around it.
- **Claim and evidence together.** With a part selected, its explanation and its cited source lines are both on screen. Clicking a citation highlights its lines and never hides the explanation.
- **Run starts with the question.** At step 1, the prediction and its options are visible without scrolling, at 1440×900 and at 1280×800.
- **One voice for text.** At most 6 text sizes outside the drawing, sentence case for labels, and each name or hint shown once. Uppercase technical lettering stays inside the drawing, where it is the sheet's identity.
- **Lighter code.** The override layer goes: the player's rules live in one place, and the renderer's CSS shrinks.

Nothing changes in `src/core`, in the stored formats, or in generation.

## Evidence

[Research R-20261029-ui-workbench](../../research/R-20261029-ui-workbench.md): the measurements, what the redesign improved, and what it lost (the source behind a tab; Run's prediction below the fold). Screenshots were taken locally and are not committed.

## Owner's decisions (2026-10-29)

- The redesign on `codex/ui-focus-workbench` is the starting point: the owner finds it a clear improvement.
- The interface is part of the learning experience, not a secondary concern: "in questo [prodotto] la UI, leggibilità, chiarezza è parte dell'esperienza".
- It must be improved and made lighter: "voglio che lo migliori, e che lo alleggerisci, perché al momento mi sembra un po' pesante".

## Scope

Included: the player (top bar, Exploded view, Run, Reassemble, Bill of materials, the source pane and reader), in both themes and both languages, from 960 px wide upwards, with the existing stacked layout below 960 px kept working.

Not included:
- the library, Studio and the "Use with Claude" panel (only the top bar they share, where it changes);
- the drawing's own geometry for graphs (`src/core/layout.ts`). Mill gains from the larger drawing area only. If its plate titles remain under 11 px on screen at 1440×900, a separate plan follows;
- new features. Every control on the branch today stays reachable.

## Preconditions

- **One plan implementing.** On approval, P-20261024-disassembly moves to `blocked` ("waiting for the owner's witnessed checks (D8, D10); D11–D12 gated"). It returns to `implementing` when this plan completes or the owner resumes it.
- **The Codex branch is frozen at `1f09169`.** This plan merges that commit. Later work on the Codex branch is not included unless the plan is revised.
- **No new dependency**, no change to `src/core`.
- **External actions** (push, pull request, merge) only on the owner's confirmation when reached.

## The target layout (Exploded view, 1440×900)

```
┌ top bar (≈56 px) ─────────────────────────────────────────────────────────────────────┐
│ ▤ Library │ Releasing Atlas Reader to staging › Release chain   [Explode│Run│Reassemble│BOM]  ⚙ │
│ How do you release a new version…? (one line, muted)                                   │
├──────────────────── drawing on the paper ───────────────┬──── reading column ───────────┤
│                                                         │ 4 · deploy-staging            │
│   folded chain, title block, balloons                   │ lead, points, joints, cites    │
│                                                         ├──── splitter ─────────────────┤
│                                    [− fit + ⤢] floating │ release-runbook.md Lines│Doc ⤢ │
│                                                         │ highlighted lines 100–115      │
└─────────────────────────────────────────────────────────┴───────────────────────────────┘
```

A vertical hairline (the splitter) is the only border between the drawing and the reading column. The source sits under the explanation with its own horizontal splitter; both sizes stay per device.

## Tasks

### Phase `base`

**U1. Bring the redesign onto `main`.** Create `feature/ui-workbench` from `origin/main` and merge `codex/ui-focus-workbench` at `1f09169`. Keep `docs/ui-workbench.md` as Codex's record, with a line that links this plan.

Acceptance: `npm run check` passes; the version in `package.json` is `0.3.0-alpha`.

### Phase `chrome`

**U2. One row of chrome.**
- The top bar holds: the mark with a "Library" link (the existing back action), the disassembly's title and the breadcrumb path on one line, the mode switch, and the preferences.
- The question goes on one muted line under the bar. Its full text shows on hover and wraps when the window is narrow.
- "Saved on this device" is shown only while saving or after a failure. The status keeps `role="status"`, so screen readers still hear it. The origin ("Prepared disassembly", "Generated with…", "Written by your assistant") moves to the reading column's overview (U4), where it is still visible.

Acceptance: at 1440×900, chrome above the drawing ≤ 110 px; the title, the path and the four modes fit at 1024 px in English and Italian; a test finds the origin text in the overview and the save failure banner.

**U3. The drawing on the paper.** No card, toolbar bar or footer around the drawing. The zoom, fit and focus controls float in a corner of the drawing. The level-up button floats in the opposite corner. The whole's name appears only in the title block and the top bar's path. The selection hint appears once, in the reading column's overview.

Acceptance: a test finds the whole's name once outside the drawing, and the hint once; the drawing area at 1440×900 is at least 700 px tall (now 504 px).

### Phase `reading`

**U4. Explanation and source together.**
- The reading column stacks the explanation over the source, with a horizontal splitter between them. There are no Part/Source tabs in Exploded view.
- With nothing selected, it shows the overview: the whole, its summary, the origin and the hint.
- Selecting a part shows its explanation and moves the source to its first citation, as before. Clicking a citation highlights its lines in the source below, and the explanation stays.
- The source can still widen to the full column (it then covers the explanation until closed) and open in the full-window reader. Notes and the per-source Lines/Document choice survive all of this.

Acceptance: tests check that after a citation click the explanation is still rendered and visible, and the cited lines are marked; that notes and the Lines/Document choice survive mode switches; at 1440×900 with part 4 of Atlas selected, the first citation and the highlighted lines are both inside the window.

**U5. Run starts with the question.**
- In Run, the reading column is wider by default (half the window). Its width is kept per device separately from Exploded view's.
- The activity panel shows, in order: the run choice, the scenario title, the prediction (question and options), the step action. The situation and the instruments follow, compact. The source below is collapsed to its header, and opens when the learner clicks a citation.
- The step button stays where it is now, under the options.

Acceptance: a test checks the DOM order (prediction before situation and instruments). At 1440×900 and 1280×800, the first view of every run in Atlas (scenario, new case) and Mill (load test, new case) shows its question or instruction and every option without scrolling.

**U6. Reassemble and Bill of materials match.** The same column, without cards: Reassemble keeps the drawing with the tray in the reading column; the Bill of materials keeps the table with the source beside it.

Acceptance: the existing reassembly and bill tests pass; screenshots in both modes show no card borders around the panels.

### Phase `type`

**U7. One voice for text.** One scale for everything outside the drawing: 12, 14, 16, 20 and 26 px, plus 18 px for a part's lead. Labels such as "Joints", "Situation", "Instruments" and "Step 1 of 5" are sentence case, 12 px semibold in the muted colour. Uppercase monospace lettering stays inside the drawing and the title block.

Acceptance: in each mode at 1440×900, a DOM measurement finds at most 6 text sizes and no uppercase label outside the drawing.

**U8. Lighter code.** The player's rules move into `disassembly.css`. Rules that only undo another stylesheet's rule are deleted, not overridden. `workbench.css` is removed, or keeps only rules that override nothing.

Acceptance: no `.study-workbench` selector re-declares a property for an element that another stylesheet already styles in the player; renderer CSS totals at most 1100 lines (1233 on the Codex branch, 1008 on `main`).

### Phase `verify`

**U9. Measured and witnessed.**
1. The research's method again, on the plan's result: Atlas and Mill, Exploded view, Run, Reassemble and Bill of materials, at 1440×900, 1280×800 and 1024×700, plus one stacked width (800 px); paper and blueprint; English and Italian. Every acceptance number above is recorded, with Mill's plate title size before and after.
2. Keyboard: plates, Enter, Escape and Alt+↑, the splitters' arrow keys, the run options, and the reassembly tray.
3. `npm run check` on macOS; CI on macOS and Windows.
4. The owner uses the built app and judges readability and weight. That judgement decides whether the plan completes or gets a version 2.

## Risks

- **Two splitters in one column** may feel fiddly. Their sizes are kept per device and they reset on double-click. If the owner finds them heavy, the source can get a fixed share instead: that would be a version 2.
- **Moving the origin out of the top bar** makes it less prominent. It stays in the overview and in the library card. MCP attribution ("Written by your assistant") must stay visible, and U2's test checks it.
- **Italian labels are longer** ("Rimonta", "Distinta base"). The 1024 px check covers them; below that the mode switch wraps as it does now.
- **Codex keeps working on its branch.** That work would diverge from this plan. The plan merges only `1f09169`.
- **Graphs stay small.** The plan only enlarges their area. A layout change for graphs is a separate plan, and U9 measures whether it is needed.

## Verification strategy

- Automated: `npm run check` (TypeScript and Vitest). The player tests gain the checks named in each task.
- Measured: a DOM measurement script run against the built app over the DevTools protocol, as in the research. It lives in the scratchpad, not the repository.
- Witnessed: the owner's use of the built app (U9.4).

## Approval

Approve with: `Approve P-20261029-ui-workbench v1`. Then implement with a separate command, for example `implement P-20261029-ui-workbench v1 --phase base`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-ui-workbench v1`.
- Approved plan/version: `P-20261029-ui-workbench` / `1`.
- Recorded at: `2026-10-29T08:25:47+01:00` (Europe/Rome).
- Approved scope: phases `base` (U1), `chrome` (U2–U3), `reading` (U4–U6), `type` (U7–U8) and `verify` (U9), on a new branch `feature/ui-workbench` from `origin/main` with `codex/ui-focus-workbench` merged at `1f09169`.
- Approved-content SHA-256: `77850ba9381010b08a5c98cc7f124994bed212edf3cf8fb1dc33344d7086735a`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# A lighter workbench` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v1. Pushing, pull requests and merges need the owner's confirmation when reached. No change to `src/core`, no new dependency.

## Progress

- **U1 verified (2026-10-29).** Branch `feature/ui-workbench` from `origin/main` (`a366d62`), upstream unset so it cannot push to `main` by accident. Merge commit `4c342e1` brings in `codex/ui-focus-workbench` at `1f09169`, with no conflicts. `docs/ui-workbench.md` links this plan. `package.json` is at `0.3.0-alpha`. Checks (automated test): `npx tsc --noEmit -p .local/tsconfig.check.json` passed, and `npx vitest run` passed with 28 files and 403 tests. `npm run typecheck` itself is not usable in this checkout, because untracked iCloud copies named `* 2.ts` break it; the local config only leaves those out.

