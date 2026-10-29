# Research: the focus workbench, measured

Date: 2026-10-29. Question: the owner finds Codex's redesign of the player (branch `codex/ui-focus-workbench`, commits `7ec439b` and `1f09169`, based on `e637524`) a clear improvement, but still heavy. What makes it heavy, what did it improve, and what did it lose?

## Method

Both versions were built and started with separate, empty data folders (`BTW_USER_DATA_DIR`) and driven over the Chrome DevTools Protocol: `main` at `a366d62` and the Codex branch at `1f09169`. The prepared examples Atlas (a chain of 6 parts) and Mill (a graph of 7 parts) were opened in Exploded view, Run and Reassemble, at 1440×900, 1280×800 and 1024×700, in the paper theme and in English. Heights and text styles were read from the DOM (`getBoundingClientRect`, `getComputedStyle`). The blueprint theme, Italian, the keyboard and widths below 1024 were not checked.

## What the redesign improved

- **The chain is readable.** `src/renderer/disassembly/workbench-layout.ts` folds a simple chain of 4 or more parts into rows of up to 3 plates. In Atlas at 1440×900, plate titles grow from about 10 px to about 14 px on screen (estimated from the screenshots). Ids, joint direction and reading numbers are unchanged (tested in `tests/workbench-layout.test.ts`).
- **The drawing has a fixed place** on the left, with zoom and fit controls. The explanation is on the right, at reading size (body 15.5 px, lead 18 px).
- **A way back to the library** in the top bar.
- **Reassemble**: the tray is a vertical list with the part icons.

## What makes it heavy (Atlas, 1440×900, part 4 selected)

| Measure | Value |
|---|---|
| Height above the drawing (top bar, heading, mode tabs, canvas toolbar) | 329 px of 900 (37%) |
| Footer under the drawing ("Select a part…") | 38 px |
| Drawing area | 504 px tall |
| Text sizes outside the drawing | 12 different sizes, 10–30 px, plus 4 uppercase label styles |
| Uppercase labels in the reading panel | "Part 4 · step", "Joints"; in Run "Scenario", "Situation", "Instruments", "Step 1 of 5" |
| The whole's name ("Release chain") | 3 times: breadcrumb, canvas toolbar, title block |
| The selection hint | 2 times: canvas footer and reading panel |
| Top bar badges | "Prepared disassembly" and "Saved on this device", next to "Back to your library" |
| Frames around the drawing | page → bordered card → toolbar bar → grid → double sheet frame → title block |
| Stylesheets | 4; `workbench.css` adds 225 lines, 147 of them override `styles.css`, `clarity.css` and `disassembly.css` under `.study-workbench`. Total renderer CSS: 1008 lines on `main`, 1233 on the branch |

## What it lost

1. **The source is no longer beside the explanation.** `WorkbenchInspector.tsx` puts Part and Source in two tabs of one panel. On `main`, selecting a part showed its explanation and its cited lines side by side. On the branch, the citations sit below the fold (y = 939 px), and clicking one switches to the Source tab, which hides the explanation. A learner can no longer read a claim and check it against its lines at the same time. Being source-linked is part of the [product identity](../../product.md#identity).
2. **In Run, the prediction is below the fold.** The Activity panel (470 px wide) shows the scenario, the situation, the instruments and "Step 1 of 5"; the question "Before you run it: what happens?" and its options need scrolling, while "Run the step" is visible but disabled. The drawing keeps about 2/3 of the width while the learner's task is to answer. On `main` the question was visible.
3. **Graphs are not helped.** Mill is not a simple chain, so it keeps the original layout; at 1280×800 its plate titles are about 9 px on screen (estimated from the screenshot).

## Constraints

- `src/core` (state, layout, contracts) must not change for presentation; `workbench-layout.ts` is a renderer-only projection.
- Tests that cover the player: `tests/disassembly-player.test.tsx`, `tests/player.test.tsx`, `tests/source-document.test.tsx`, `tests/split-pane.test.tsx`, `tests/workbench-layout.test.ts`.
- Pane sizes are kept per device (`usePaneSizes`); notes and the per-source Lines/Document choice must survive layout changes.
- Codex's branch is based on `e637524` and lacks the version commit of `main` (`55d2245`, reached through `a366d62`).
- Codex recorded its work in `docs/ui-workbench.md` as directly authorized by the owner, without a workflow plan.

## Recommendation

Planning is justified. Keep Codex's gains (the folded chain, the drawing on the left, the reading sizes, the tray). Remove weight rather than add it: one row of chrome, no cards around panels, one name, one hint, a smaller type scale. Restore claim and evidence side by side, and give Run's prediction the first place in its panel. Measure the result with the same method.
