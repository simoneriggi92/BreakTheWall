---
id: P-20261029-ui-workbench
title: A lighter workbench - one row of chrome, claim and source side by side, the prediction first in Run
version: 1
state: completed
current_task: none
last_evidence: U1-U9 verified - 32 measured combinations, keyboard paths, 408 tests, CI green on macOS and Windows at 27a4764, owner's positive judgement of the built app
next_action: Owner merges pull request 35; graph layout legibility (Mill plate titles 10.3 px) needs its own plan
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
- **U2 verified (2026-10-29).** The top bar holds the mark with "Library" (its accessible name is still "Back to your library"), the title, the path, the four modes, the save status and the preferences, in 56 px. The path shows only inside a sub-assembly, because at the top the title block already names the whole. The question is one muted line under the bar, with its full text on hover; it wraps below 960 px. The save status is visually hidden once saved, appears only if a save takes longer than 0.6 s, and shows in the error colour when a save fails, next to the existing banner with "Retry". It keeps `role="status"`. The origin moved to the overview: "Prepared disassembly", "Generated disassembly · ChatGPT · model", or "Written by your assistant · client version". Below 1100 px the word "Library" hides and the mark stays, with the same accessible name.
- **U3 verified (2026-10-29).** The canvas has no card, toolbar or footer. Zoom out, fit, zoom in and focus float in the top-right corner as icon buttons with names and tooltips, and the level-up button floats top-left. The run hint ("Watch the structure while you test a connection") was the footer's only other content and is removed from both languages. The reassembly canvas also lost its bar with the whole's name, ahead of U6, because U3's styles removed that bar's rules.
- **Evidence for U2–U3.**
  - Automated tests: `tests/disassembly-player.test.tsx` gains three tests. They check home, title and the four modes in the bar; the question once; the whole's name once outside the drawing; the hint once; the drawing tools inside the canvas; the origin in the overview and not in the bar; and the save status quiet when saved and marked when a save fails, with "Retry". `tests/studio.test.tsx` now looks for the origin in the overview (for ChatGPT, a local model, a two-model setup, a resumed generation, and the assistant). Checks: `npx tsc --noEmit -p .local/tsconfig.check.json` passed, and `npx vitest run` passed with 28 files and 406 tests.
  - Integration check on the built app (`vite build`, `build-desktop`, then Electron with an empty data folder, measured over the DevTools protocol), Atlas in English at 1440×900: the top bar is 56 px and the drawing starts at 93 px (≤ 110 required; it was 329 px). The drawing area is 781 px tall (≥ 700 required; it was 504 px). The whole's name appears once outside the drawing, and the hint once. At 1024×700, the top bar fits in one row in English and in Italian ("Esploso", "Fai girare", "Rimonta", "Distinta base"), with the title not truncated.
- **U3 fix after the owner's trial (2026-10-29).** The owner widened the reading panel, and the drawing did not shrink; it kept its size and scrolled. Cause: Codex's zoom stored the drawing's height as a share of the window (`btw:panes:v1`), which in the earlier layout was the handle between the drawing and the panel below it. In this layout any stored value, including one saved by version 0.3, fixed the sheet's height. A single zoom-in step took Atlas from 886 to 1502 px wide inside a 396 px column. The fix, agreed with the owner ("Sì, correggi"):
  - zoom is a scale over the fitted sheet, 100% to 300% in steps of 25%, and lasts only for the session; reopening a disassembly starts fitted;
  - while zoomed, the fit button shows the scale ("125%"), and zoom-out is disabled at 100%;
  - the zoomed sheet takes its size from the fitted one (measured with `ResizeObserver`) and sits centred in its area, so no blank paper appears above it;
  - the drawing-height handle under the drawing is removed. In this layout it was a second, hidden zoom. The height share is no longer stored, and a value saved by an earlier version is ignored. `PANES` keeps only the reading column's width;
  - `t.d.panes.drawing` is removed from both languages.
  - Evidence. Automated tests: the D17 tests now expect only the reading-panel splitter in Exploded view and Run, and remember its width after reopening. A new test starts from a stored `drawing: 0.85` and checks fit, two zoom steps (`--zoom` 1.5, label "150%"), one step back, the return to fit, and a fit again after reopening. `tests/split-pane.test.tsx` checks that the old drawing value is ignored and drives the splitter on the source pane. Checks: typecheck passed, and 28 files with 406 tests passed. Integration check on the built app, starting with `drawing: 0.85` in storage: the sheet fits at 886 px, follows the widened panel to 606 px without a scrollbar, zooms to 757 px at 125% with a horizontal scrollbar, and returns to 606 px on fit. At 175% the sheet is centred, and selecting "deploy-staging" scrolls it into view.
  - Observed limit: Atlas's sheet is limited by the canvas width, not its height, so the extra height leaves paper above and below the sheet rather than enlarging the plates. Larger plates depend on the column split, which U4–U5 set; U9 measures plate size.
- **U4 verified (2026-10-29).** `WorkbenchInspector.tsx` becomes `ReadingColumn.tsx`. Exploded view has no tabs: the explanation is on top, the source below, and a horizontal splitter ("Height of the explanation", kept per device as `reading`, 55% by default) sits between them. Selecting a part shows its explanation and highlights its first citation in the source. Clicking a citation highlights its lines and leaves the explanation in place. The column has no card; it reaches the window's right and bottom edges, with a hairline on its left. Three things changed along the way:
  - the citations moved from the end of the part card to just under its lead, so the way to the source stays in view in the upper half of the column;
  - the source still widens to the whole work area (as before, it then hides the drawing and the explanation) rather than to the column only, as the plan's text said. The behaviour is the one already tested, and the full-window reader is still there;
  - two defects showed up once the source was always visible, and are fixed. Lines marked "cited" carry an absolutely positioned text for screen readers, which made the page itself 4552 px tall; `.source-text` now positions them. And the scroll to a citation measured `offsetTop`, which then counted from the wrong element; it now measures positions on screen (as `SourceDocument` already did).
- **U4 adjustment after the owner's trial (2026-10-29).** The owner found that explanation and source read as one block ("sembra un tutt'uno che inganna l'occhio"). The boundary now has:
  - an ink rule (the ink colour at 60%), 1.5 px, like the sheet's frame lines;
  - a sunk band for the splitter;
  - a header in the sunk tone that names the source ("SOURCE · release-runbook.md");
  - the lines on the paper tone, a step darker than the explanation above.
  The run's folded source header uses the same rule and tone, and the open source then does not repeat the label. Checked in the built app in paper and blueprint at 1440×900, from screenshots.
- **U5 verified (2026-10-29).** A run has its own column width (`activity`, 50% by default, kept per device). In a scenario run the panel shows what just happened, then the next step and its prediction, then the situation and the instruments. The source in a run is folded to a header ("Source · release-runbook.md"), which opens on a click or when the learner follows a citation. The step button stays in the footer under the options.
- **U6 verified (2026-10-29).** Reassemble keeps the drawing with the tray beside it, without a card, and the bill of materials keeps the table with the source beside it. The tab labels "Part" and "Activity" are removed from both languages.
- **Evidence for U4–U6.**
  - Automated tests:
    - a new test checks that there are no tabs, that the explanation stays the same element and stays visible after a citation, and that the source highlights lines 30–33 and then 100;
    - a new test checks, in a scenario run, that the prediction comes before the situation and the instruments, that the source starts folded and opens after a citation in the step's feedback, and that it folds again;
    - the D17 test now expects two splitters in Exploded view and one in a run, a run width of 0.5, and the explanation's height remembered after reopening;
    - the note and the Lines/Document choice survive a switch to the bill of materials and back;
    - the source-document tests no longer open a tab.
    Checks: typecheck passed, and 28 files with 408 tests passed.
  - Integration check on the built app, in English with an empty data folder:
    - Atlas at 1440×900 with part 4 selected: the first citation is inside the part card's visible area and the highlighted line 30 is inside the source's visible area. After clicking "ll. 100–115", the heading is still in view and line 100 is highlighted in view. The page itself does not scroll;
    - runs at 1440×900 and at 1280×800: every element of the question and its options is inside the run panel's visible area without scrolling, for Atlas (scenario: 5 elements, new case: 4) and Mill (load test: 5, new case: 5);
    - Reassemble and the bill of materials: no element wider than 300 px has a rounded full border (no cards), and the page does not scroll.
- **U8 verified (2026-10-29), done before U7 so that the refactor could be checked as a refactor.**
  - `workbench.css` is removed. Its rules are merged into the base rules of `disassembly.css`, which is now the player's only stylesheet. A merged rule keeps the winning value of each property.
  - Rules for the old layout are deleted: `.d-side` as a grid, `.d-wide`, `.sized`, `.d-bar`, the ink-bordered mode bar, sticky source panes, and `.disassembly .save-status`.
  - `.study-workbench` remains only where a component also appears in Studio's generation preview (the part card, its points, and the sheet's frame and selected plate), and the file's header says why.
  - The library and Studio sizes that Codex had put in `workbench.css` moved to `clarity.css`.
  - 65 rules in `styles.css` are deleted. They styled classes that no source file uses any more, including template-built names (`tone-*` stays, because `tone-${…}` builds it): remnants of the earlier lesson player and library (`library-intro`, `learning-loop`, `context-dock`, `notes-panel`, `mini-branches`, `goal-card`, `meter`, and others).
  - Renderer CSS: 1094 lines (`styles.css` 408, `clarity.css` 292, `disassembly.css` 394), down from 1244 on the branch at U3 and 1233 on Codex's branch (≤ 1100 required).
  - Evidence (integration check on the built app). A DevTools script drove the app through 17 states and recorded, for every element, its box and 47 computed properties: the library, Studio, the Exploded view (overview, a part, document view, source widened and restored, the reader, a sub-assembly), a scenario run after one step, a new case, Reassemble with one piece placed, the bill of materials, Mill's load test, 800 px and 600 px widths, and blueprint. After the refactor, no element in any state changed position or size. The 40 remaining property differences have no visual effect: grid properties on a flex element, `top` on a static element, a radius on a fieldset without a border. That is fewer than the 47 differences between two runs of the same build, which come from a pulsing animation and focus timing. A first run after removing `styles.css` rules showed layout changes, which turned out to be states captured before the window's resize and the theme switch had landed. The script now dispatches the resize and waits for the theme, and two further runs confirmed the result.
- **U7 verified (2026-10-29).**
  - Outside the drawing, sizes come from one scale: 12 (labels, notes, hints), 14 (controls, run tabs, buttons), 16 (reading text, run actions, feedback, the bill's check), 18 (a part's lead) and 20 (headings, from 23 and 21). 26 is not used yet.
  - Labels ("Joints", "Situation", "Instruments", "Step 1 of 5", "Before you run it", "Parts to put back", "Optional", the run types, the bill's column heads, "Source") are sentence case, 12 px, semibold, muted, in the body face. "Optional" loses its pill. Uppercase monospaced lettering stays in the drawing and the title block. The source's own page breaks are part of the source.
  - Evidence (integration check on the built app, Atlas at 1440×900, every text element in the header and the work area except the drawing, the source text and the closed preferences menu): Exploded view with a part selected has 5 sizes, Run 4, Reassemble 4, and the bill of materials 3. No uppercase label is found in any mode (before: 9, 8, 8 and 6 sizes, with 3 to 6 uppercase labels).
  - U4 and U5 were measured again after the change: the first citation and the highlighted lines are in view together, and every run's question and options fit without scrolling at 1440×900 and at a confirmed 1280×800, for Atlas and Mill. The page does not scroll.
  - Automated tests: typecheck passed, and 28 files with 408 tests passed.
- **U9, points 1–3 (2026-10-29).**
  1. **The measurements again** (integration check on the built app, at `0bfda27`). One DevTools session measured 32 combinations: Atlas and Mill; 1440×900, 1280×800, 1024×700 and 800×900; paper and blueprint; English and Italian.
     - Chrome: the bar is 56 px and the drawing starts at 93 px at every wide size (≤ 110). The drawing area is 807 px tall at 1440×900 (≥ 700).
     - The whole's name appears once outside the drawing, and the hint once, everywhere.
     - Claim and source: the first citation and the highlighted lines are in view together, and a citation keeps the explanation in view, at 1440, 1280 and 1024, for both examples, in every theme and language.
     - Runs: every question and its options are in view without scrolling at 1440×900 and 1280×800, for all four runs. At 1024×700, Atlas's scenario needs scrolling to reach its last option; the plan sets no requirement at that size. In every run the source starts folded.
     - Type: 5 sizes in Exploded view, 4 in Run, 4 in Reassemble and 3 in the bill of materials, and no uppercase label, in every combination.
     - No cards in Reassemble or the bill of materials. The page itself does not scroll, sideways or, above 960 px, down.
     - The title is not truncated at 1024 px, in English and Italian.
     - At 800 px the layout stacks: the bar wraps to 99 px with the modes on a second row, and the page scrolls by design, so the "in view" checks do not apply there.
     - Plate size on screen, from the sheet's scale (13 px plate titles, 11 px joint labels in the layout):

       | | Codex `1f09169` | `0bfda27` |
       |---|---|---|
       | Atlas plate titles, 1440×900 | 13.3 px | 13.7 px |
       | Atlas plate titles, 1280×800 | 11.7 px | 12.1 px |
       | Mill plate titles, 1440×900 | 10.1 px | 10.3 px |
       | Mill plate titles, 1280×800 | 8.8 px | 9.1 px |
       | Mill joint labels, 1440×900 | 8.5 px | 8.7 px |

       Mill stays under 11 px at 1440×900, so, as the scope states, graph layouts need a separate plan. The space gained here is height, and Mill's sheet is limited by its width.
  2. **Keyboard** (integration check with real key events over the DevTools protocol, Atlas at 1440×900):
     - Tab moves from plate 1 to plate 2 in reading order. Enter selects the plate and moves the focus to its card's heading, and Tab reaches "Open the sub-assembly anyway". Enter there enters it, and the path shows "Release chain › check". Escape goes back with the focus on plate 2, and so does Alt+↑.
     - The explanation's splitter moves 55 → 60 with ↓. The column's splitter moves 34 → 39 with ←, and Enter resets it to 34.
     - Enter on the "Run" mode opens the run. Space checks a prediction, and Enter on "Run the step" runs it, so the feedback appears.
     - In Reassemble, Enter picks a tray part, and Enter on a slot places it.
  3. **Local checks** (automated tests, macOS): `npx tsc --noEmit -p .local/tsconfig.check.json` passed, and `npx vitest run` passed with 28 files and 408 tests. CI on macOS and Windows needs the branch pushed and a pull request; that waits for the owner's confirmation.
  4. **Owner's judgement**: pending.
- **U9 verified (2026-10-29).**
  - CI on [pull request 35](https://github.com/simoneriggi92/BreakTheWall/pull/35) at `27a4764`: "Types, tests and build" (macOS), "Windows: types, tests and build" and GitGuardian passed.
  - The owner used the built app through the phases and judged it positively on 2026-10-29, so the plan completes without a version 2.
  - Left for other plans: Mill's plate titles stay at 10.3 px at 1440×900, so graph layouts need their own plan; at 1024×700 Atlas's scenario needs scrolling to reach its last option.

