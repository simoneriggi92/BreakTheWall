# Verification

Base: main `c9bcd56`; branch `codex/guided-source-reading`. Tests use original/public repository sources only.

## Automated checks

- `npm run check`: strict TypeScript succeeds; 30 test files / 407 tests pass.
- `npm run build`: production renderer and Electron bundles succeed. The bundler reports size and dependency `use client` warnings; no dependency or packaging change was made.
- `git diff --check`: clean before delivery.
- `source-reading.test.ts`: contiguous complete coverage, preambles/blank lines/trailing headings, indivisible long fences/lists/tables/blockquotes, headingless/code fallbacks, source order, absolute rendered line offsets, citation-derived context, legacy/invalid/revised saved state.
- `guided-reading.test.tsx`: default first reading, free jumps and final passage, back/forward, source highlights and reader outline/focus, mode changes and remount, old notes and overview restoration, English UI, multiple sources and explicit material outside the question.
- `progress-store.test.ts`: the existing atomic desktop round trip now includes the reading position alongside notes, open hierarchy and Run state, loaded by a new store instance.
- Existing overview and source-reader tests explicitly choose Overview to continue testing their former interaction paths. Their assertions were preserved.

## Actual renderer in a local browser

Served with `npm run dev:web` on loopback, using the actual branch, separately from the private prototype.

- Atlas: 14 fixed passages, position 7/14 restored after reload. All six original overview part numbers remain unchanged; its two visible detail plates retain numbers 2 and 3 and both icons.
- Mill: 5 fixed passages, argument joint and both icons shown; Run → Reassemble → Bill of materials → Exploded view returns to the reading location. This uses the same reading view, not subject modes.
- At widths 1280, 960, 720 and 390 px, document scroll width equals viewport width. Below 960 px the source and its drawing stack alongside the vertical navigation.
- Paper and Blueprint inspected. The drawing uses the same minor/major drafting grid as the overview.
- Source citation moves focus to the reference. The full reader highlights the same passage (9 focused blocks in the inspected Atlas passage); Escape returns to reading.
- Browser console: no runtime exceptions observed. A development favicon request returns 404; it is unrelated to the reading flow.

Screenshots remain local and are not repository assets. No private source was used for these checks.

## Limits

### Owner-requested pane correction

The guided source now reuses the existing keyboard/pointer splitters and device-local pane sizes. Its height is adjustable above the source; the vertical divider adjusts its width against the drawing. Explicit hidden rules fix the source expansion button being overridden by flex/grid display rules. Expanded source hides the passage and drawing and restores both without losing the location.

Follow-up verification: TypeScript and all 408 tests pass, including a regression for keyboard resize, remembered dimensions and expand/restore. Actual browser pointer drags at 1280×800 increased source height from 296 to 386 px and width from 594 to 670 px; full expansion reached 1029 px, then restored the prior size. At 390 px the horizontal divider remains usable and document width stays at 390 px. The same production build command was rerun successfully.

The central passage is original source, not a generated lesson. Passage boundaries follow original blocks and headings; they do not prove semantic or pedagogical completeness. Oversized indivisible blocks and code files can remain long. Drawing details use existing citations and relations as context, not a claim that every displayed relation is asserted in the currently highlighted interval.

New sessions start in reading; old progress keeps the overview until the learner chooses Reading. Navigation position is persisted, not a completion score or per-pixel scroll position.

The desktop progress store and production bundles were verified. A packaged Electron install, live provider generation, account access and learning effectiveness were not tested. Owner judgement of the implemented UI remains a separate review.
