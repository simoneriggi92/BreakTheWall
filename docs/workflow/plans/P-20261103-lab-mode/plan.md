---
id: P-20261103-lab-mode
title: The lab - one representation per source, an object or an atlas, chosen by a metaphor test
version: 1
state: implementing
current_task: L5
last_evidence: Phase core implemented (L1-L4) - the metaphor test, faces from a part's own lines, the bench layout with folding and the atlas layout, in src/core; 15 new tests; tsc, 33 test files with 535 tests and both builds pass
next_action: Implement phase drawing (L5-L7) on a separate command
approval: approved
---

# The lab

## Outcome

In the guided view, every source is drawn as **one whole representation**, chosen by the app:
- a **disassemblable object**, when a coherent metaphor represents the source's parts and documented joints without inventing a link, a cause or a dependency;
- an **atlas** of nested regions, otherwise.

The choice comes from concrete correspondences, not from the subject or from shares of joint types. Context, limits and clarifications are annotations linked to the source, not components. The learner sees why the app chose, and where each analogy ends.

Both representations keep the lab's language:
- the drawing in the centre, the source below it, the path on the left, the card on the right;
- progressive building along the reading;
- opened levels that lift out of the whole;
- a return to the reading point.

Reference: [prototypes/lab-representation](../../../../prototypes/lab-representation/README.md). Nothing changes in the contract or in generation.

## Evidence

- [Research R-20261103-lab-mode](../../research/R-20261103-lab-mode.md), measures 1 to 4. The fourth case is the owner's requirement and its metaphor test:
  - `importer-signals` → object, with 0 breaks;
  - `mill-harm` → atlas: the frame would invent twice;
  - `atlas-release` → object;
  - the owner's 11 generated disassemblies → 5 objects and 6 atlases.
- The prototypes the app's code is taken from (all public, on public fixtures):

  | Prototype | Provides |
  |---|---|
  | [lab-representation](../../../../prototypes/lab-representation/) | the reference: the metaphor test (`metaphor.js`), the bench with its whole components, the atlas, the "why" panel, annotations |
  | [lab-atlas](../../../../prototypes/lab-atlas/) | the atlas layout |
  | [lab-adaptive](../../../../prototypes/lab-adaptive/) | the bench layout, faces from a part's own lines, lifted opening, "Esplori" |
  | [object-lab](../../../../prototypes/object-lab/) | the compact card and the stacked return |

- The owner's statements (2026-11-03):
  - "Mi sembra adesso una buona base di partenza";
  - the four points after the private lab (sub-part identity, lifting the part, a readable source, reading position ≠ explored part);
  - the requirement of one representation per source, the hybrid kept as a separate experiment;
  - "direi di procedere con questo approccio per la parte di implementazione".
- The app today (on `feature/guided-reading`, plan [P-20261102-guided-reading](../P-20261102-guided-reading/plan.md) v4):
  - `src/renderer/disassembly/GuidedReading.tsx` draws the route, the steps, the minimap, the stack of open levels (G17) and the margin;
  - `ObjectSheet.tsx` and `shapes.ts` draw the 2.5D board (G10);
  - `SourcePane.tsx` / `SourceDocument.tsx` already show the source formatted, with every line addressable;
  - `src/core/source-reading.ts` gives the route, the roles and the steps.

## Owner's decisions (2026-11-03)

- **One representation per source.** No mixed composition: the hybrid stays under `prototypes/lab-adaptive`, outside this plan.
- **Object only when the metaphor holds.**
  - A coherent metaphor represents the main functions and the documented relations, and introduces no link, causality or dependency.
  - The decision weighs concrete correspondences and where the analogy ends, not the subject or percentages.
- **Context, limits and clarifications** need no component. They can be annotations linked to the source.
- **The same lab language** for both: the source always below the drawing, guided reading, levels of detail, the return to the reading.
- **Usefulness is the owner's judgement.** This plan delivers the capability to adapt.
- **Question → action → drawing → explanation say the same thing** (after trying Mill's load test in the prototype). In an atlas the run suspends a support and asks which justifications stay explicit in the excerpt. The outcome is the loss of that support, kept apart from whether the conclusion is true.
- **The verdict speaks of the library, not of every object:** "Tra le metafore disponibili, nessuna rappresenta questa fonte senza forzature." The test compares the metaphors it has, and cannot rule out every possible object.

## Scope

Included:
- the metaphor test, the faces extraction and the two layouts, in `src/core`, pure and tested;
- the drawing of the bench (whole components and opened levels with faces) and of the atlas (regions and sub-regions), in `src/renderer`, in SVG with no new dependency;
- in the guided view:
  - the chosen representation replaces the G10 board;
  - lifted opening replaces the G17 stack;
  - "Esplori" separates the explored part from the reading position;
  - the card gains "why this representation" and the analogy's limits;
- both languages and both themes;
- tests.

Not included:
- **the frame (the object for arguments).** In this version the library holds the bench only. Without a frame, an argument is always an atlas. That is the cautious default, and every argument in the research went to the atlas anyway. The frame enters with its own task once a source passes its checks.
- **the hybrid**, and any mixed composition;
- **changes to the contract or to generation.** Icons, kinds and the load test are used as they are. A part kind for "context" is a later contract question (see Risks).
- **an object spec generated by the model** (research option B);
- the overview and Reassemble, which stay as they are; Run changes only in L12;
- the test with people.

## Preconditions

- **P-20261102-guided-reading v4 is closed before L1.**
  - Its G8.3 is recorded with the owner's judgement: the plate stack is not enough, and the lab is the base.
  - Its G9–G17 work is committed on `feature/guided-reading`, on the owner's request.
  - Its state becomes `superseded` by this plan for G10 (the board) and G17 (the stack). G9 and G11–G16 (the regions of the screen, the minimap, the controls, the steps, ↑, the route's title) stay and are reused here.
- **Branch.** A new branch `feature/lab-mode`, from the tip of `feature/guided-reading` after that commit. External actions (push, pull request, merge) only on the owner's confirmation when reached.
- **No new dependency.** The drawing is hand-written SVG with a cabinet projection, as in the prototypes.
- **Stored files stay valid.** No stored field changes. The guided view's object/plates switch (a device preference) is retired: an old value is ignored.
- **Private material stays out.** Tests and examples use the public fixtures only.

## Tasks

### Phase `core`

**L1. The metaphor test** (`src/core/representation.ts`).
- `chooseRepresentation(d)` returns:
  - the view, `object` or `atlas`;
  - the metaphor tried (`bench`);
  - one row per part: its component id, or `annotation`, or a failure code;
  - one row per top-level joint: its connection id, or a failure code;
  - the failures.
- **Library.** Bench components are keyed by `icon`, as in `metaphor.js`. Connections are `sends-to` → cable, `causes` → command, `depends-on` → read cable. Each has a stable id, and the renderer translates it.
- **Annotations.** Parts of kind `limit` are annotations, not components. Their joints are not checked.
- **Rule.** The view is `object` when every non-annotation part has a component and every joint has a connection. Otherwise it is `atlas`.
- Acceptance (unit tests):
  - `importer-signals` → object with 0 failures;
  - `atlas-release` → object;
  - `mill-harm` → atlas, with failures for its argument joints;
  - a part with an icon outside the library → atlas, with that part's failure;
  - the result is deterministic and lists every part and every top-level joint once.

**L2. Faces from a part's own lines** (`src/core/faces.ts`).
- `outlineOf(d, part)` reads the part's cited lines and returns:
  - its headings (with their extent);
  - its table rows (with header and cells, and ⚠);
  - its list items (with continuation lines joined);
  - its numbered code steps;
  - its code lines.
- Lines inside code fences are never headings.
- `faceOf(d, part)` picks the structure each component accepts, as in the prototype. It returns nothing when there is none.
- Acceptance (unit tests on the fixtures):
  - the importer's round gives 5 steps;
  - a part citing only prose gives no face;
  - headings inside code fences are ignored;
  - list continuations are joined.

**L3. The bench layout** (`src/core/bench.ts`).
- **Columns.** Modules stand in columns by flow (senders before receivers, what is depended on before what depends on it), with several modules in a column one behind the other.
- **Order.** Each module is moved next to the modules it is joined to (barycentre ordering).
- **Folding.** Flows longer than three columns fold into a second band behind the first, so the bench never runs wider than about twice its depth.
- **Opened levels.** These use the same layout:
  - one row up to five parts;
  - two rows above five, the back row raised.
- Acceptance (unit tests):
  - no two module footprints overlap;
  - every module is placed;
  - on the importer, the round stands before its registers, and the panel after them;
  - the width-to-depth ratio stays within the bound on every public fixture.

**L4. The atlas layout** (`src/core/atlas.ts`).
- **Centre.** The most joined part is the centre, and the largest.
- **Sides.** The others take the side given by their relation to it:
  - what supports it, in front;
  - what follows from it, behind;
  - limits on the left, attacks on the right;
  - mechanism joints by direction.
- **Distance.** A part joined only to a placed part goes beyond that part. A part with no joint lies apart.
- **Overlaps.** Regions are pushed apart until none overlap.
- **Sub-regions.** These lie inside their region's perimeter, in one row or in two.
- Acceptance (unit tests):
  - no two regions overlap;
  - every sub-region lies inside its parent;
  - on Mill, the claim is the centre, the supporters stand in front, the consequence behind, the limit to the left, the objection to the right, and the rejected part apart.

### Phase `drawing`

**L5. Drawing primitives and the bench** (`src/renderer/lab/`).
- **Primitives.** The cabinet projection, boxes, plateaus and cables, with labels at a readable screen size, as in the prototypes.
- **Whole components.** Each comes from the library:
  - a round track with one station per sub-part;
  - a register with a clock;
  - a tape printer;
  - a key switch;
  - a relay with a dial;
  - a panel with one light per incoming joint, named by that joint;
  - and the others in `metaphor.js`;
  - a plain module when the part has no whole drawing.
- **Annotations.** Points marked ⚠ are pinned to their component as annotations.
- **Labels.** Every label is a part's name or a joint's label. No value is shown that the source does not give.
- Acceptance (component tests): the importer's bench shows 7 parts and 8 cables with their labels, 5 stations on the round and 3 lights on the panel. Every part is a button with its name.

**L6. The atlas drawing.**
- Regions are plateaus. Sub-regions are drawn inside, named when there are three or fewer and counted when there are more.
- Relations are arrows from perimeter to perimeter, with labels.
- A part with no relation is marked "no explicit joint".
- Acceptance (component tests): Mill's atlas shows 7 regions, 6 sub-regions inside two of them, and 5 arrows with their labels.

**L7. Opened levels.**
- A bench module opens into components, with faces from L2 (drawers, dials, holders, file boxes, warnings, switches, checks, a turntable, a screen). A part with no structure stays a plain module.
- A region opens into sub-regions.
- Joints that leave the level run from the sub-part that cites the same lines toward the side of the other part: along the tray's edge on the bench, out of the perimeter on the atlas.
- Each element of a face is a button. Its card shows the row, item or section it comes from, with its lines.
- Acceptance (component tests):
  - the release fixture's opened parts show their faces;
  - Mill's two opened regions show three sub-regions each;
  - pressing a face element shows its lines.

### Phase `reading`

**L8. The guided view draws the chosen representation.**
- The drawing calls L1 and draws the bench or the atlas. This replaces `ObjectSheet` and the object/plates switch.
- The minimap (G11) draws the same representation, small.
- Progressive building follows the existing roles (G2, G13): a part not yet read is a dashed footprint or outline, and a joint appears from the step that cites it.
- Acceptance:
  - `guided-reading.test.tsx` checks the importer as an object and Mill as an atlas;
  - unread parts are outlines;
  - joints appear at their step;
  - a part with no sub-assembly still offers "take apart" where it does today;
  - the existing route, steps, ↑ and keyboard tests pass.

**L9. Lifting a part out of the whole.**
- Opening a part:
  - the whole sinks to a strip at the bottom, with the part's place outlined;
  - the opened level takes the space above it;
  - a beam joins the place to the level;
  - a FLIP motion goes from the place to the level.
- Closing reverses it. With "reduce motion" there is no motion.
- At any depth, the strip shows the level the opened part belongs to, and the minimap and the path show the way up from the whole.
- Upper parts in the strip stay pressable, as in G17.
- Return (↑, Escape, "Back", the minimap) restores the step, the selection and the source's scroll.
- This replaces G17's stack.
- Acceptance (component tests): the strip appears, the place is outlined, and return restores the step and selection. Reduced motion skips the animation.

**L10. Explored part ≠ reading position.**
- When the selected part, face element or joint cites no line of the current step, a bar says "Esplori «X» · r. a–b · stai leggendo il passo N". It offers two actions:
  - "Torna al passo N" closes the exploration and restores the source's position;
  - "Leggi da qui (passo M)" moves the reading to the first step that cites it.
- The route marks the step being read and the steps that cite what is explored.
- Acceptance (component tests): selecting a part outside the step shows the bar. "Torna" restores the step and the scroll position, and "Leggi da qui" moves the reading.

**L11. Why, and where the analogy ends.**
- The whole card holds "Perché questa rappresentazione":
  - L1's verdict in one sentence, which speaks of the metaphors available in the library: an atlas reads "among the available metaphors, none represents this source without forcing", never "no object holds";
  - the failures for an atlas;
  - the correspondences part by part and joint by joint (component and what it does, or the failure), each with where the analogy ends.
- Each part card holds "Nell'oggetto" or "Nella mappa" with the same words.
- "Annotazioni" lists the parts' ⚠ points and the lines the bill of materials excludes as context, each linked to the source. The context lines come from the margin data the view already has (z); they are not computed twice.
- All texts are in English and Italian.
- Acceptance (component tests):
  - the importer's panel says the bench holds, with 7 component rows and 8 connection rows;
  - Mill's panel lists its failures;
  - `i18n.test` passes in both languages.

**L12. The run speaks the representation's language.** For a source drawn as an atlas, the load run, both in Run (`RunPanel.tsx`) and in the lab's card, asks and answers in terms of supports, not weight.
- **Action:** "Suspend «X»", not "Remove the brick".
- **Question:** which justifications of the target stay explicit in the excerpt? The learner picks among the target's supporters. The answer comes from the `supports` joints and their lines, not from the verdict.
- **Drawing:** the suspended region is outlined. The target shows "loses a support", "no explicit support" or "supports intact". Nothing falls.
- **Explanation, in order:**
  - what stays explicit, with its lines;
  - then, apart, "what the disassembly adds": the run's explanation, with an opening verdict sentence ("Crolla.", "Regge.") left out, because it belongs to the weight metaphor;
  - an inference is marked as one;
  - a closing note says the test is about explicit justifications, not about the conclusion's truth.
- The summary groups the bricks by their role in the excerpt (supports, not a support), not as "load-bearing".
- Sources drawn as an object keep today's run.
- Acceptance (component tests on Mill):
  - suspending the utility shows "loses a support" and names sovereignty as explicit, with lines 14–21;
  - suspending the abstract right shows "supports intact";
  - the sovereignty case shows the inference chip;
  - no text in the atlas run contains the verdict words of the weight metaphor;
  - the importer's run is unchanged.

### Phase `verify`

**L13. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows.
2. **Integration on the built app** (`npm start`) with a scratch data folder, at 1280×800, in both themes and both languages:
   - the three public examples;
   - opening, return, "Esplori";
   - building on and off.
3. **The owner's look**, on their device, at their own generated disassemblies. Their judgement is recorded:
   - Does the choice of representation fit each source?
   - Is a component missing from the library?

## Risks

- **The test is only as good as the library and the icons.** A part maps by its icon, and generation picks the icon. A missing component sends a whole source to the atlas: 6 of the owner's 11 disassemblies did. L13.3 records which components are missing. Extending the library is cheap, and it is the expected follow-up.
- **"Context" is not a part kind.** Only `limit` parts and ⚠ points are annotations. A part that is really context (a roadmap, a cost estimate) is judged as a component and may send the source to the atlas. A context kind is a contract change, left to a later plan.
- **The rule-made bench is less recognisable than a hand-made object.** It reads as a bench of modules. The whole components narrow the gap; an object spec from the model (research option B) is the way to close it, outside this plan.
- **Width.** Long flows made 1,250-unit benches in the prototype. L3 folds them, and L3's ratio test guards it.
- **Arguments always become atlases** until the frame enters. This is cautious by design: the frame invented on the only argument fixture.
- **Removing the object/plates switch** removes a choice the learner had. The overview keeps the plates.
- **Motion can tire or confuse.** The lift is short, says one thing, and stops under "reduce motion".
- **Run texts are written for a metaphor.** The fixtures' load explanations open with "Crolla." or "Regge.", and generation writes the same way. L12 leaves out an opening verdict sentence. A later generation change could ask for representation-neutral explanations; this plan does not change generation.
- **The guided view grows.** `GuidedReading.tsx` is already 303 lines. The drawing moves to `src/renderer/lab/`, and the view keeps only the orchestration.

## Verification strategy

- **Automated:** `npm run check` (TypeScript and Vitest), with the tests named in each task.
- **Integration:** the built app driven with a scratch data folder; scripts stay in the scratchpad.
- **Reference:** each drawing task is compared, on the same fixture, with `prototypes/lab-representation` at 1280×800.
- **Witnessed:** the owner's look (L13.3).

## Approval

Approve with: `Approve P-20261103-lab-mode v1`. Then implement with separate commands:
- `implement P-20261103-lab-mode v1 --phase core`;
- then `--phase drawing`;
- then `--phase reading`;
- then `--phase verify`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261103-lab-mode v1`.
- Approved plan/version: `P-20261103-lab-mode` / `1`.
- Recorded at: `2026-11-03T13:11:49+01:00` (Europe/Rome).
- Approved scope: phases `core` (L1–L4), `drawing` (L5–L7), `reading` (L8–L12) and `verify` (L13), on branch `feature/lab-mode` from `2e920ee`.
- Approved-content SHA-256: `6db16c2594b392b41a76630f40d30486278698e6f58f85e988b6c3e45c1b8f99`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# The lab` up to, and not including, `## Approval`.
- Authority boundary:
  - implementation needs a separate implement command naming v1;
  - pushing, pull requests, merges and deleting branches need the owner's confirmation when reached;
  - no new dependency;
  - no change to the contract or to generation;
  - private material stays out of the repository;
  - the hybrid and the frame are not in this approval.

## State changes

- 2026-11-03: created as version 1, `awaiting_approval`, after self-review (review.md, version 1).
- 2026-11-03: version 1 revised before approval, after the owner tried the prototype: L12 (the run in the representation's language) added, the verdict's wording fixed, verify renumbered L13. The preconditions on P-20261102-guided-reading are met: closed as `superseded`, G9–G17 committed as `2e920ee`, branch `feature/lab-mode` created.
- 2026-11-03: `awaiting_approval` → `approved`. No other plan is active.
- 2026-11-03: `approved` → `implementing`, on `implement P-20261103-lab-mode v1 --phase core`.

## Progress

- 2026-11-03: `implement P-20261103-lab-mode v1 --phase core`.
- **L1, the metaphor test (automated tests).** `src/core/representation.ts`:
  - `chooseRepresentation(d)` returns `object` or `atlas`, with one row per top-level part (component, `annotation`, or `no-component`) and one per top-level joint (connection or `no-connection`).
  - The library holds the bench only: 23 components keyed by icon, and three connections (`sends-to` → cable, `causes` → command, `depends-on` → read cable).
  - Parts of kind `limit` are annotations, and their joints are not checked.
  - Tests:
    - the importer and the release chain → object, 0 failures;
    - Mill → atlas, its limit an annotation, four argument joints without a connection;
    - one icon outside the library → atlas, naming that part;
    - deterministic on all seven public fixtures; the story → atlas.
- **L2, faces (automated tests).** `src/core/faces.ts`:
  - `outlineOf` reads a part's cited lines: sections (third-level headings and below), table rows with header and cells, list items with continuations joined and the bold phrase as name, numbered code steps, and code lines.
  - Headings inside code fences are ignored, and ⚠ is kept.
  - `faceOf` picks the structure each icon's component accepts, as in the prototype.
  - Tests: numbered steps give a wheel; prose gives no face (every part of Mill); fenced headings are ignored; continuations are joined; table rows become drawers with their cells.
- **L3, the bench layout (automated tests).** `src/core/bench.ts`:
  - `benchLayout` sets columns by flow (`depends-on` read backwards), orders them by barycentre, stacks a column's modules in depth, and folds more than three columns into further bands, the first at the back.
  - `openedLayout` gives one row up to five parts, and two rows above five, the back row raised.
  - `projectedRatio` measures the on-screen proportion.
  - Tests:
    - every module placed and no footprints overlapping, on the seven public fixtures;
    - on the importer, the switch before the round, the round before its registers, and the registers before the board;
    - every bench's ratio ≤ 2.6 (measured 2.0–2.5);
    - a chain of seven folds into three bands;
    - the opened-level rows.
- **L4, the atlas layout (automated tests).** `src/core/atlas.ts`:
  - `atlasLayout` places the most joined part at the centre and the others by their relation to it.
  - Parts beyond the same neighbour stand one after another.
  - Regions are pushed apart until none overlap; coinciding centres get a fixed direction.
  - Sub-regions sit within 85% of their region.
  - Tests:
    - on Mill, the claim at the centre, the supports in front, the consequence behind, the limit left, the objection right, the rejected part alone apart;
    - no overlaps and every sub-region inside, on the seven public fixtures.
  - First run: two regions of the importer, both joined only to the heartbeat stamp, landed on the same point. Fixed as above.
- **Checks (automated, macOS).** All pass:
  - `npx tsc --noEmit -p .local/tsconfig.check.json`;
  - `npx vitest run --dir tests` (33 files, 535 tests);
  - `npx vite build` and `node scripts/build-desktop.mjs`;
  - `git diff --check`.

  Nothing is drawn yet, so no integration check applies. Not committed.
