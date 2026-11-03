---
id: P-20261102-guided-reading
title: Guided reading - the drawing follows the source, passage by passage, with depth and a margin
version: 4
state: superseded
current_task: G8
last_evidence: G8.3 recorded - after the private and public lab prototypes, the owner judged the stacked board not enough and the lab the base; G10 (the board) and G17 (the stack) are superseded by P-20261103-lab-mode; G9-G17 committed on feature/guided-reading
next_action: None here; the work continues under P-20261103-lab-mode
approval: approved
---

# Guided reading

## Outcome

A learner opens a disassembly and **reads the source in its own order**, while the drawing shows what each passage does to the whole. This is the core of the product, consuming the source. Run and Reassemble stay as they are.

Three axes, all computed from the disassembly, with no generation:
- **x, reading.** The source in passages. Each passage frames the whole, adds a part, deepens a part already read, or relates two parts through a joint it cites.
  - The drawing changes only with what the passage does: parts not yet read are outlines, and a joint is drawn from the passage that cites it.
- **y, depth.** From any passage the learner opens a part into its sub-assembly, with the sub-parts the passage cites marked, and comes back to the same passage.
- **z, the margin.** The lines a passage leaves out of the drawing (context, detail, repetition), each with its reason and note, beside the drawing and never wired into it.

**Version 2: the app takes the prototype's form.** `prototypes/guided-reading` is the reference:
- The **drawing is at the centre** and is the largest region. The passage says what it does on the right, and the route is on the left.
- The **source is a band below**, shown once, with the passage highlighted.
- The drawing is an **object**: a 2.5D board with functional shapes (cycle, register, switch, gauge, pillar, beam, wedge…). Joints are drawn by their kind.
- **Every shape comes from the fixed table below**, over the `icon` and `kind` each part already has. Nothing changes in the contract or in generation.
- Plain plates stay available as an alternative view.

Suspending a premise stays in the prototype: it is a run, and runs are outside this plan.

**Version 3: the learner always knows where they are, and moves on purpose.**
- A **minimap** shows the whole object in miniature, with "you are here".
- **x, y and z are explicit controls** on the drawing. Keys only add shortcuts.
- The route has **fewer steps**: a new step starts only where the drawing changes.
- **Transitions are fluid:** opening a part takes it apart in place while the rest turns transparent.

Taking every level apart in advance changes generation, and is left to [research R-20261102-depth-in-advance](../../research/R-20261102-depth-in-advance.md) and a plan of its own.

**Version 4: the levels stack down the sheet.**
- Opening a part adds its level below the one it comes from, so every open level stays in view. The upper ones are transparent and without focus, but can still be pressed.
- ↑ goes back up, as ↓ goes down.
- The route says what it is and has a legend for its marks.
- Steps with no heading of their own are named by their first words.

## Evidence

- [Research R-20261102-guided-reading](../../research/R-20261102-guided-reading.md):
  - what Codex's two prototypes do;
  - how x, y and z map onto the current contract;
  - the categories computed on `importer-signals`;
  - what the object metaphor can carry.
- The HTML prototype in `prototypes/guided-reading/`: all 16 passages of `importer-signals`, the round's sub-assembly, the margin, and a switch between functional shapes and plain tiles.
- Codex's branch `codex/guided-source-reading`, 2 commits on `main` at `c9bcd56`:
  - the passage route (`src/core/source-reading.ts`);
  - the saved reading position (`disassembly-state.ts`);
  - the guided view (`GuidedReading.tsx`);
  - its tests.

## Owner's decisions (2026-11-02)

- Focus on **guided reading**, the consumption of the source: "concentriamoci sul core del prodotto". Run and Reassemble may later join the same experience, but that is not decided.
- Experiment with the **object metaphor** and the **x, y, z navigation**, "qualcosa che tendenzialmente altri non farebbero".
- An HTML prototype first, then this plan ("Write the plan").
- 2026-11-02, after phases route, player and object: the app's guided view did not look like the prototype ("Il disegno è di lato, in mezzo c'è un wall of text incredibile. Non ci siamo proprio"). The owner chose to bring both the prototype's structure and its object into the app ("2": hierarchy and shapes, the shapes taken from `icon` and `kind`).
- 2026-11-02, after G9 and G10: still not satisfying. The owner wants:
  - a constant "you are here" reference and a minimap, as in Codex's object prototype;
  - explicit x, y, z buttons;
  - fewer entries than 61;
  - every level taken apart and openable without waiting;
  - fluid transitions, with levels turning transparent.

  The owner chose a version 3 for the presentation and, alongside it, research on depth in advance ("Yes, both").
- 2026-11-02, after G11–G14:
  - ↑ should go back;
  - the route needs a title and a legend;
  - the levels should develop vertically down the sheet, the upper ones visible without focus.

  The owner confirmed the sketch of stacked levels ("Yes, write v4").

## Scope

Included:
- the passage route and what each passage does (`src/core`);
- the guided view in the player: drawing states, depth, margin, keyboard, both languages and both themes;
- the saved reading position;
- the prototype of the object, under `prototypes/`, extended to an argument;
- tests.

Not included:
- functional shapes in the contract or in generation: the player derives them from `icon` and `kind`;
- suspending a premise, and any other run, in the guided view;
- taking levels apart in advance or automatically: research R-20261102-depth-in-advance, then its own plan;
- Run or Reassemble inside the reading;
- new generation, and any change to generation;
- sub-assemblies on long generated sources (a separate finding: none of four whole-source generations produced one);
- help at the point of difficulty;
- the test with 3–5 people, whose protocol is its own research.

## Preconditions

- **Pull request 39 is merged** into `main`. This plan starts from `main` on a new branch, `feature/guided-reading`, and is the only active plan.
- **Codex's code enters through this plan.** The two commits of `codex/guided-source-reading` are cherry-picked, keeping their author.
  - Their self-authorised plan, research and verification files (`P-20261030-guided-reading`, `R-20261030-guided-reading`) are left out: this plan replaces them.
  - The branch itself is not deleted without the owner's confirmation.
- **No new dependency.**
- **Stored files stay valid.** The reading position is an optional field, and older progress files load unchanged.
- **Private material stays out.** Codex's prototypes run on the owner's document; examples and tests use the public fixtures only.
- **External actions** (push, pull request, merge, deleting branches) only on the owner's confirmation when reached.

## Tasks

### Phase `route`

**G1. Codex's route on `main`.**
- Cherry-pick `f6f14a9` and `98e9f0f` onto `feature/guided-reading`.
- Resolve the conflicts in `src/renderer/disassembly/DisassemblyPlayer.tsx` and `tests/disassembly-player.test.tsx` against the workbench player of 0.4.0.
- Leave out the files named in the preconditions.

Acceptance (tests):
- Codex's tests pass on the new base: `source-reading`, `guided-reading`, and the progress store with a reading position.
- The whole existing suite passes.
- A progress file without `reading` loads unchanged.

**G2. What each passage does.** A function in `src/core/source-reading.ts` takes the disassembly and the route and returns, for each passage, in route order:
- `frame`: its non-blank lines are cited by the whole and by no part;
- `add`: the top-level parts its lines cite for the first time (a sub-part's lines count for its top-level part);
- `deepen`: the top-level parts already added that its lines cite again;
- `relate`: the joints of the top level whose citations overlap it. A joint without citations is related at the passage where its later end is added;
- `subParts`: the sub-parts its lines cite, for y;
- `margin`: the exclusions, of the bill of materials and of any part, that overlap it, with reason and note.

Acceptance (tests):
- On `importer-signals`, in Italian and English, with a route cut at headings, each section gets the categories of the research table, and every part is added once, at its first cited section.
- On every public fixture:
  - each top-level part is added exactly once;
  - each joint is related at least once;
  - each exclusion appears in the margin of the passages it overlaps.
- The route covers the source with no gaps, as G1 already checks.

### Phase `player`

**G3. The drawing follows the reading (x).** In the guided view, the existing sheet (`Sheet`) draws the top level with a reading decoration, separate from the run decorations:
- parts not yet added are outlines without name or number;
- parts added or deepened by the current passage are marked, with two different marks;
- joints appear from the passage that relates them, and the current ones are marked.

Beside the drawing, the passage says what it does in short blocks:
- the frame: the whole's `does` and `why`;
- each added part: its role, and its analogy with its limit when it has one;
- each deepened part: its points;
- each joint: "A —label→ B". A joint to a part not yet read says at which passage it comes.

Previous and next buttons move between passages. The left and right arrow keys do the same when the focus is on the drawing or the passage; they are not taken where they already act (the pane splitters, the source pane, text fields).

A disassembly opened for the first time starts in the guided view, as Codex's code does. One with saved progress keeps the view it was left in.

Acceptance (tests and integration):
- On `importer-signals`:
  - at the first passage every part is an outline;
  - at the section "One round, step by step" the round is added and its two joints are drawn;
  - at "Why the job succeeded is not enough" the outcome log is marked as deepened.
- Selecting a part from the drawing still shows its lines in the source.
- The overview, the bill of materials, Run and Reassemble behave as before.

*Version 2: the place of the drawing and of the passage in G3 is replaced by G9, and the plates by G10. G3's reading marks, its blocks, its joints by passage and its keys stay.*

**G4. Depth (y).** From the guided view the learner opens a part:
- if it has a sub-assembly, the sheet shows it, with the sub-parts the current passage cites marked;
- going back, with the existing Escape and Alt+↑ or a button, returns to the same passage and the top level;
- a part with no sub-assembly offers the existing "take apart" action where a generation route is set, and otherwise says that it has no sub-assembly.

Acceptance (tests): on `importer-signals`, opening the round at "One round, step by step" marks all five steps. Returning keeps the passage. Opening the heartbeat shows the no-sub-assembly state and makes no request.

**G5. The margin (z).** A margin control, with the number of notes, shows the current passage's exclusions with their reason and note. The Z key does the same, outside text fields. The margin never adds a line or mark to the drawing.

Acceptance (tests): on `importer-signals`, the first passage shows the header note (context) and the glossary shows its repetition note. A passage with none says so.

**G6. Language, themes, keyboard and saving.**
- Every new string is in `it.ts` and `en.ts`, and both themes have the new marks.
- Every action has a button, and keys only add shortcuts that follow the player's existing ones.
- The reading position is saved and restored, as in G1.
- At 1280×800 the drawing, the passage and the source are visible together.

Acceptance (tests and integration): the i18n test covers the new keys. Integration on the built app checks both languages, both themes, 1440×900 and 1280×800, on the three public examples.

### Phase `object`

**G7. The object prototype, extended to an argument.** `prototypes/guided-reading/` (outside the product bundles):
- gets a small script that writes its data from the public fixtures;
- adds `mill-harm`, with shapes for the argument family: premise and conclusion blocks in a frame, struts for "supports", a wedge for "attacks";
- keeps the research's rule: a suspended premise leaves its conclusion in place, marked "not derived here".

The same x, y and z work on both fixtures, and the shapes and tiles switch stays.

Acceptance (integration):
- The prototype opens from a static server on both fixtures with no console error.
- Every line in the drawing is a joint of the fixture.
- The README states which parts of it are computed and which are drawn by hand.

### Phase `layout` (version 2)

**G9. The prototype's structure.** The guided view is laid out as `prototypes/guided-reading`:
- **left:** the route of passages, each with the marks of what it does (frames, adds, returns to, relates, margin);
- **centre:** the drawing, as the largest region;
- **right:** "What this passage does", the selected part and the margin;
- **below:** the source band, the whole source with the passage highlighted and brought into view. It keeps its lines and document views, its full-window reader and its height splitter.

The rendered passage above the source (Codex's `guided-passage`) is removed: the passage is shown once, in the band. The keys stay those of G3 to G5.

Acceptance (tests and integration):
- The guided view has no second copy of the passage: the passage's lines appear only in the source band, highlighted.
- The route shows each passage's marks, computed by `readingRoles`.
- At 1440×900 and 1280×800, in both languages and both themes, on the three public examples:
  - the drawing is the widest and tallest of the four regions;
  - route, drawing, panel and source band are all within the window;
  - the page does not scroll sideways.
- G3–G5's tests pass on the new structure.

### Phase `drawing` (version 2)

**G10. The object.** In the guided view, the drawing is a 2.5D board, in SVG with no new dependency, drawn as in the prototype:
- **Positions.** The level's existing layout (`layoutLevel`) gives each part's place on the board, so the reading order and the numbers are those of the overview.
- **Shapes.** Each part's shape comes from this fixed table:
  - the argument and story kinds decide first;
  - otherwise the part's `icon` decides;
  - a plain block is the fallback.

  | Shape | From `kind` | From `icon` |
  |---|---|---|
  | beam | conclusion | |
  | pillar | premise | |
  | foundation | ground | |
  | clamp | limit | ruler |
  | wedge | objection | triangle-alert |
  | field | consequence | map, sprout |
  | set aside | rejected | ban |
  | marker on a track | event | flag |
  | figure | actor | user-round, users, message-circle |
  | cycle | | repeat, rotate-ccw, play |
  | register | | timer, database, fingerprint, key-round, lock, clipboard-check |
  | tape | | file-text, list-checks, book-open |
  | switch | | settings, plug |
  | comparator | | filter, scale, search, shield-check |
  | gauge | | gauge |
  | conveyor | | send, download, rocket, git-branch |
  | chamber | | cpu, hammer, code, package, layers |
- **Joints by kind.** An arrow sends to; a dotted arrow depends on; a strut supports; a red wedge attacks; a bar limits; a track segment leads to; a cause mark explains.
  - Every line between two parts is a joint of the level shown. Lines inside a shape belong to it.
- **Reading marks.** As in G3: outlines for parts not read yet, marks for what the passage adds or returns to, joints from their passage.
- **Depth.** y opens the sub-assembly on the same board, as in the prototype.
- **Accessibility and themes.** Each part keeps its button, name and kind for the keyboard and screen readers. Shapes use the theme's colours in paper and blueprint.
- **Plain plates.** A switch in the drawing's bar shows today's plates instead, and is remembered on this device.

Acceptance (tests and integration):
- Every value of `partIconSchema` and of `PART_KINDS` has a shape in the table, checked by a test over the schemas.
- On the three public examples, at the first, a middle and the last passage:
  - every line drawn between parts carries a joint of the level, and no other line is drawn between parts;
  - outlines and marks match `readingRoles`.
- The plain-plates switch shows today's plates and is remembered.
- Integration on the built app in both themes, with screenshots of the importer, Mill and Atlas.

### Phase `orientation` (version 3)

**G11. A minimap that says "you are here".** A small inset in a corner of the drawing shows the whole top level in miniature, in the same style as the drawing (object or plates):
- it uses the same reading marks: outlines for parts not read yet, the parts this step adds or returns to;
- inside a sub-assembly, the opened part is highlighted on the miniature and labelled "You are here", and the inset shows the path (whole › part);
- clicking the miniature returns to the whole, as "Back to the whole" does.

The inset never covers a part. Its corner is chosen away from the parts, and it can be hidden; hiding it is remembered on this device.

Acceptance (tests and integration):
- At the top level the inset shows every top-level part with the drawing's marks.
- Inside the round on the importer, the inset highlights the round, says "You are here" with the path, and a click on it returns to the whole at the same step.
- At 1440×900 and 1280×800, on the three public examples, the inset's box overlaps no part's box.

**G12. x, y and z as controls.** A control strip on the drawing holds:
- **x:** previous and next step, with "step n of N";
- **y:** open the selected (or the step's) part when it has a sub-assembly, and back up a level, naming the part;
- **z:** the margin, with its count.

Each control has a visible label, says its key in its tooltip, and is disabled when it does not apply. The keys of G3–G5 stay as shortcuts.

Acceptance (tests): each control does what its key does, on the importer, and is disabled at the ends (no previous at step 1, no back at the top level, no open for a part without a sub-assembly).

**G13. Fewer steps: one where the drawing changes.** The route is grouped into steps:
- a new step starts at a passage that frames the whole, adds a part or relates a joint;
- the passages in between join the step before, and their returns and margin notes add up in it;
- a step highlights all its lines in the source band, and the route lists steps.

The number of steps is at most 1 + parts + top-level joints. The saved position stays a line, so older progress still finds its place.

Acceptance (tests):
- On Atlas, Mill and the importer, Codex's 14, 5 and 15 passages become 9, 4 and 10 steps (measured on 2026-11-02 with `readingRoles`).
- Every source line belongs to exactly one step.
- No step after the first is without a frame, an added part or a related joint.
- G2's invariants hold on steps: each part is added once, each joint related, each exclusion in the margin of the steps it overlaps.

**G14. Transitions.** Motion says what happened, and only that:
- **opening a part:** its sub-parts move out from the part's place to their own, the rest of the level fades to about 15% opacity, and the board follows;
- **back:** the reverse;
- **a part added:** it rises onto the board;
- **a joint related:** its line is drawn from end to end;
- **a part returned to:** its mark pulses once.

Transitions last 300–500 ms, never block a click, and stop under the system's "reduce motion" setting.

Acceptance (tests and integration):
- Opening and closing a part add and remove the transition classes, and under `prefers-reduced-motion: reduce` no animation or transition is applied, checked by test.
- On the built app, frames captured during an opening show the sub-parts between the part's place and their own, and the rest faded.

### Phase `stack` (version 4)

**G15. ↑ goes back up.** In the drawing and the panel, ↑ goes up one level, as ↓ opens one; Escape and Alt+↑ keep working everywhere. The "Back" control's tooltip names ↑ first.

Acceptance (tests): on the importer, ↓ opens the round and ↑ returns to the whole at the same step. ↑ does nothing at the top level, and in the source band it still scrolls.

**G16. The route says what it is.**
- **Title.** The route is titled "Reading steps".
- **Legend.** A legend that is always visible under the title names the five marks: frames, adds, returns to, relates, margin.
- **Step names.** A step whose heading is the same as the step before (a long section cut into several steps, or a source with no headings) is named by the first words of its first line instead.

Acceptance (tests):
- The route's heading is "Reading steps" ("Passi di lettura"), and the legend shows the five marks with their words in both languages.
- On Mill, the four steps have four different names.
- On the importer, the steps keep their headings.

**G17. Levels stacked down the sheet.** The drawing becomes a vertical sheet of levels:
- **Order.** The whole at the top, then each open level below the part it comes from, down the open path, with no fixed depth.
- **Upper levels.** Every level above the one in focus stays drawn, at reduced opacity and without focus. Its opened part is ringed and joined by a line to the level below.
- **Pressing an upper level.** Pressing an upper level's part opens that part in place of what was open below it. Pressing the upper level itself closes what is below and gives it the focus.
- **Scrolling.** The sheet scrolls vertically, and the level in focus is brought into view.
- **Size.** Each level is drawn at a readable size: a level does not shrink to fit them all.
- **Transitions.** Opening makes the new level descend from its part (G14's offsets, now downward). Closing lifts it away. Both stop under "reduce motion".

G14's backdrop, where the whole faded behind the open level in the same place, is replaced by this stack. The minimap (G11) stays: it shows the whole when the top has scrolled out of view.

Acceptance (tests and integration):
- On the importer, opening the round shows two levels. The whole is above, with 7 parts, without focus and with the round ringed; the round's level is below, with 5 parts, in focus.
- ↑ or pressing the whole closes the lower level.
- With `deepDisassembly(5)`, opening a path of three parts shows four levels in order. Pressing the second level's part closes the two below it and opens that part.
- On the built app, at 1440×900 and 1280×800 and in both themes: two and three stacked levels, each at a readable size; the sheet scrolls to the level in focus; screenshots.

### Phase `verify`

**G8. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows.
2. Integration on the built app, with a scratch data folder (G3–G6).
3. The owner reads one of their own generated disassemblies in the guided view, on their device, after G15–G17. Their judgement is recorded:
   - Does the drawing help them follow the source?
   - Does the margin keep what it should?
   - Is the prototype's object worth a test with people?

## Risks

- **Codex's code was written outside this workflow** and against the player before 0.4.0. G1 keeps it only if its tests pass on the new base. A conflict that changes behaviour is resolved toward the current player.
- **"Deepen" can become noise** in sources that return to the same parts often. G2's tests count it on the fixtures; if it marks most passages, the mark becomes quieter, not removed.
- **A passage that only a sub-part cites** adds or deepens its top-level part. At the top level the learner sees which part; y shows which sub-part.
- **Joints without citations** have no passage of their own. They appear with their later end, and the drawing shows them unmarked.
- **Generated disassemblies have no sub-assemblies** on long sources, so y often leads to "take apart", which costs a generation. This plan does not change generation; the finding stays open.
- **Long sources** (up to 5,000 lines) make many passages. The route is computed once per disassembly; the sheet draws one level at a time, as today.
- **A shape says more than an icon.** A cycle or a strut suggests how a part works, and the model chose the icon, not the shape. The table keeps shapes general, joints stay the only relations drawn, and the plain plates stay one switch away. The test with people must ask what a shape means.
- **Grouping may hide a passage that matters.** A passage that only returns to a part joins the step before. The source band still shows all its lines, and the step's blocks list every part it returns to.
- **A tall sheet may lose the top.** With several levels open, the whole scrolls out of view. The minimap and the path in the drawing's bar keep it present.
- **Generated disassemblies seldom have a second level.** The stack shows its value only where levels exist: in the prepared examples, after "take apart", or after depth in advance (research R-20261102-depth-in-advance).
- **A minimap is one more thing on screen.** It stays small, in a corner away from the parts, and can be hidden.
- **Motion can tire or confuse.** It is short, says one thing at a time, and stops under "reduce motion".
- **A layout made for plates may crowd a board.** Positions come from `layoutLevel`, scaled onto the board. Parts that touch or overlap at some size are a G10 finding, fixed in the projection, not in the core layout.
- **The prototype's object may please without helping.** The plan keeps it out of the product until a test with people asks for explanations and predictions, not preferences.

## Verification strategy

- Automated: `npm run check` (TypeScript and Vitest), with the tests named in each task.
- Integration: the built app driven over the DevTools protocol with a scratch data folder; scripts stay in the scratchpad.
- Prototype: opened from a static server in the in-app browser, with screenshots.
- Witnessed: the owner's reading of their own disassembly (G8.3).

## Approval

Approve with: `Approve P-20261102-guided-reading v4`. Then implement with separate commands: `implement P-20261102-guided-reading v4 --phase stack`, then `--phase verify`. The phases of versions 1–3 are implemented and stay as they are, except where G17 replaces G14's backdrop.

## Approval record

Version 1, approved (superseded by version 2, which adds phases layout and drawing; it needs its own approval):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261102-guided-reading v1`.
- Approved plan/version: `P-20261102-guided-reading` / `1`.
- Recorded at: `2026-11-02T16:51:23+01:00` (Europe/Rome).
- Approved scope: phases `route` (G1–G2), `player` (G3–G6), `object` (G7) and `verify` (G8), on a new branch `feature/guided-reading` from `main` after pull request 39 is merged.
- Approved-content SHA-256: `e27a9fb38b5a11f00e6836e2548c16989ed3fca21ed3a09a0d4d0aed4240b2f9`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Guided reading` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v1. Pushing, pull requests, merges and deleting branches need the owner's confirmation when reached. No new dependency. Private material stays out of the repository.

Version 2, approved (superseded by version 3, which adds phase orientation; it needs its own approval):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261102-guided-reading v2`.
- Approved plan/version: `P-20261102-guided-reading` / `2`.
- Recorded at: `2026-11-02T17:31:25+01:00` (Europe/Rome).
- Approved scope: phases `layout` (G9), `drawing` (G10) and `verify` (G8, repeated after them), on `feature/guided-reading` (draft pull request 44). Phases route, player and object stay as implemented under version 1, except where G9 and G10 replace them.
- Approved-content SHA-256: `bf0c391739b3df860b103344af33c6bdce32da549faed08172e71d793d58d0a3`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Guided reading` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v2. Pushing, merges and deleting branches need the owner's confirmation when reached. No new dependency. Private material stays out of the repository.

Version 3, approved (superseded by version 4, which adds phase stack; it needs its own approval):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261102-guided-reading v3`.
- Approved plan/version: `P-20261102-guided-reading` / `3`.
- Recorded at: `2026-11-02T17:57:38+01:00` (Europe/Rome).
- Approved scope: phase `orientation` (G11–G14) and phase `verify` (G8, repeated after it), on `feature/guided-reading` (draft pull request 44). Phases route, player, object, layout and drawing stay as implemented, except where G13 groups the route.
- Approved-content SHA-256: `fecba72ad5a053d9447cb3caf46db194f48a3ad5be25385c95712adb710672ef`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Guided reading` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v3. Pushing, merges and deleting branches need the owner's confirmation when reached. No new dependency. Private material stays out of the repository. Depth in advance is not in this approval.

Version 4, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261102-guided-reading v4`.
- Approved plan/version: `P-20261102-guided-reading` / `4`.
- Recorded at: `2026-11-02T18:12:41+01:00` (Europe/Rome).
- Approved scope: phase `stack` (G15–G17) and phase `verify` (G8, repeated after it), on `feature/guided-reading` (draft pull request 44). The phases of versions 1–3 stay as implemented, except where G17 replaces G14's backdrop.
- Approved-content SHA-256: `8f60696988510dc1518d6e7ad8a76912a54b3a6d221b9cbe4702dd86b8db4a96`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Guided reading` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v4. Pushing, merges and deleting branches need the owner's confirmation when reached. No new dependency. Private material stays out of the repository. Depth in advance is not in this approval.

## State changes

- 2026-11-02: `awaiting_approval` → `approved`. No other plan is active.
- 2026-11-02: `approved` → `implementing`, on `implement P-20261102-guided-reading v1 --phase route`.
- 2026-11-02: version 2 → `awaiting_approval`. G8.3 failed on the owner's first look (see Progress). Version 2 adds G9 (the prototype's structure) and G10 (the object, with shapes from `icon` and `kind`), and repeats G8 after them. Branch `feature/guided-reading` from `main` at `b05b45a` (pull request 39 merged).
- 2026-11-02: version 2 `awaiting_approval` → `approved`. No other plan is active.
- 2026-11-02: `approved` → `implementing`, on `implement P-20261102-guided-reading v2 --phase layout`.
- 2026-11-02: version 3 → `awaiting_approval`. G8.3 failed again after G9 and G10 (see Progress). Version 3 adds phase orientation (G11–G14) and repeats G8 after it; depth in advance moves to research R-20261102-depth-in-advance.
- 2026-11-02: version 3 `awaiting_approval` → `approved`. No other plan is active.
- 2026-11-02: `approved` → `implementing`, on `implement P-20261102-guided-reading v3 --phase orientation`.
- 2026-11-02: version 4 → `awaiting_approval`. The owner's third look (see Progress) asks for ↑ to go back, a route title and legend, and levels stacked down the sheet. Version 4 adds phase stack (G15–G17) and repeats G8 after it.
- 2026-11-02: version 4 `awaiting_approval` → `approved`. No other plan is active.
- 2026-11-02: `approved` → `implementing`, on `implement P-20261102-guided-reading v4 --phase stack`.
- 2026-11-03: `implementing` → `superseded`, on the owner's instruction ("Yes, close and commit"). G8.3 is recorded below. G10 (the board) and G17 (the stack) are superseded by [P-20261103-lab-mode](../P-20261103-lab-mode/plan.md). G9 and G11–G16 stay in the app and are reused there. G8.1 and G8.2 are not repeated for G9–G17: CI runs on the next push.

## Progress

- 2026-11-02: `implement P-20261102-guided-reading v1 --phase route`.
- **G1, Codex's route on `main` (automated tests).** `f6f14a9` and `98e9f0f` from `codex/guided-source-reading` are applied to `feature/guided-reading`, committed with their author (Simone Riggi, through Codex). Left out: `docs/workflow/plans/P-20261030-guided-reading/` (plan, review, verification) and `docs/workflow/research/R-20261030-guided-reading.md`.
  - Two conflicts were resolved toward the 0.4.0 workbench player:
    - `DisassemblyPlayer.tsx` keeps Codex's view bar and guided view, and keeps `main`'s rule that the question line appears only when there is a question (`!guided && d.question`);
    - `tests/disassembly-player.test.tsx` keeps Codex's step to the overview with `main`'s `it.question!`.
  - Codex's tests pass on the new base: `tests/source-reading.test.ts` (route and saved position) and `tests/guided-reading.test.tsx` (six player tests, including "restores legacy progress to the overview without discarding notes"). The progress store round-trips a reading position.
  - The whole suite passes: 31 files and 475 tests.
- **G2, what each passage does (automated tests).** `readingRoles` in `src/core/source-reading.ts` returns, for each passage of a route, `frame`, `add`, `deepen`, `relate`, `subParts` and `margin`, from citations alone. A sub-part's lines count for its top-level part. A joint without citations is related where its later end is added. The margin holds the exclusions of the bill of materials and of every part, the latter with the part's id.
  - `tests/source-reading.test.ts`, on `importer-signals` in Italian and English with a route cut at headings: the 16 sections give the research table's categories. The section "One round, step by step" also has two margin notes, because the round's own exclusions (its heading and the sentence that introduces its steps) are part exclusions, which the research table did not count. That section's `subParts` are the round's five steps.
  - On all seven public fixtures, with Codex's real route:
    - each top-level part is added exactly once, and a part is deepened only after it is added;
    - each joint is related at least once;
    - each exclusion is in the margin of exactly the passages it overlaps.
  - A joint whose citations are removed is related once, at the passage that adds its later end.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 31 files and 485 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass; `git diff --check` passes.
- 2026-11-02: `implement P-20261102-guided-reading v1 --phase player`.
- **G3, the drawing follows the reading (automated tests and integration).**
  - `Sheet` takes a reading decoration, `reading`, separate from the run decorations:
    - a part not read yet is a dashed outline, with no name, number or button;
    - a part the passage adds or returns to is marked, by colour and by a badge (`+`, `↺`);
    - a joint is drawn from the passage that relates it, and the passage's own joints are thicker.
  - `GuidedReading` draws the whole level beside the reading, replacing Codex's one-joint detail. Under the drawing, "What this passage does" shows:
    - the frame (the whole's `does` and `why`);
    - each added part, with its role and, where it has one, its analogy and where the analogy stops working;
    - each part it returns to, with its points;
    - each joint, as "A — label → B". A joint to a part not yet read says at which passage it comes.
  - **Layout of the drawing.** In the narrow column beside the reading, the overview's left-to-right layout shrank plates until they were unreadable (seen on the built app). The drawing now uses the existing top-to-bottom layout, `stack`, through a new optional `force` argument of `layoutLevel` (no other caller changes). It keeps the overview's numbers. Plates stay at their own size, the drawing scrolls, and the marked plate is brought into view.
  - ← and → move between passages when the focus is on the passage or the drawing, not in the source pane, a splitter or a field.
  - A first opening starts in the guided view (Codex's behaviour); saved progress keeps its view.
  - Tests (`tests/guided-reading.test.tsx`, on `importer-signals-en`):
    - at the first passage all 7 parts are outlines and no plate or joint can be selected;
    - at "One round, step by step" the round is marked as added, 6 parts are still outlines, and its 2 joints are drawn and current; the passage says it adds a part and relates two, and names a later passage;
    - at "Why the job succeeded is not enough" the outcome log is marked as returned to;
    - → and ← from the passage move one passage each way.
  - Run and the overview are unchanged: the whole player suite passes.
- **G4, depth (automated tests).** From the guided view, "Open its N parts" (or a double click on an assembly) draws the sub-assembly in place and marks the sub-parts the passage cites. Escape, Alt+↑ or "Back to the whole" returns to the top level at the same passage. A selected part with no sub-assembly shows the overview's own "Take this part apart" (`TakeApart`, with its route, cost, progress and errors) on a generated disassembly; otherwise it says it has no sub-assembly.
  - On the importer, at "One round, step by step", opening the round shows its 5 parts, all marked, and "This passage cites 5 of its 5 parts.". Escape returns to the 7 parts at the same passage.
  - Selecting the heartbeat stamp, a prepared part with no sub-assembly, says so and offers no request.
- **G5, the margin (automated tests).** A "Margin" control with the number of notes, labelled "Margin: N notes for this passage", replaces Codex's "Outside the disassembly" box. It also shows part exclusions. The Z key toggles it outside fields and dialogs. It lists line ranges (which focus the source), reasons and notes, and never adds a mark or line to the drawing.
  - On the importer: the first passage shows its context note, with the drawing unchanged; Z closes and reopens it; "What the importer does" says there is nothing in the margin; the glossary shows its repetition note.
  - Codex's test of a passage outside the question now checks the margin ("fuori dalla domanda") and, at the last passage, every part read and none marked.
- **G6, languages, themes, keyboard and saving.**
  - The new strings are in `en.ts` and `it.ts` (`t.d.guided`); the unused `excluded` string is removed. Every action has a button.
  - **Integration on the built app** (DevTools protocol, a scratch data folder per run; scripts in the scratchpad):
    - four runs: English paper 1440×900, English blueprint 1280×800, Italian paper 1280×800 and Italian blueprint 1440×900;
    - each run opens Atlas, Mill and the importer for the first time;
    - each example starts in the guided view. The drawing, the passage and the source are within the window at the first, second and last passage, and the page never scrolls sideways.
    - Counts, identical in all four runs (outlines / plates / marks / joints at passages 1, 2 and last):

      | Example | Passage 1 | Passage 2 | Last passage |
      |---|---|---|---|
      | Atlas | 6/6/0/0 | 5/6/1/0 | 0/6/0/6 |
      | Mill | 5/7/2/1 | 4/7/1/2 | 0/7/1/5 |
      | Importer | 7/7/0/0 | 7/7/0/0 | 0/7/0/8 |

    - Screenshots of the importer at "The night board" (1440×900) and "One round" (1280×800), and of Mill in blueprint, show readable plates, current joints and the marked plate in view.
  - Observation for the owner's judgement (G8.3): a part is added at the first passage that cites any of its lines. On Atlas, "Rollback" is added at "1. What a release is", because one line there mentions keeping the previous digest. This follows the citations; whether it reads well is the owner's call.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 31 files and 488 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass; `git diff --check` passes. Nothing of this phase is committed yet.
- 2026-11-02: `implement P-20261102-guided-reading v1 --phase object`.
- **G7, the object prototype extended to an argument (integration).** `prototypes/guided-reading/`, outside the product bundles:
  - **Data.** `build-data.mjs` writes `data.js` from `importer-signals.json` and `mill-harm.json`. A switch in the header changes fixture (`#importer`, `#mill`).
  - **Passages.** Mill's source has only its title as a heading, so a source with fewer than three headings is also cut at blank lines past about 1,500 characters, never inside a paragraph. Mill gives 5 passages; the importer keeps its 16.
  - **Joints without citations.** Mill's "ne segue" and "restringe ed estende" have no citations. They come with their later end, as `readingRoles` does in the app. Before this fix the prototype never drew them.
  - **Argument shapes.** A load-bearing frame: beam (claim), pillar (premise), foundation (ground), clamp (limit), wedge (objection), field (consequence), crossed block (set aside). Joints are drawn by kind: a strut for supports, a red wedge for attacks, a bar for limits, an arrow for sends-to and a dotted arrow for depends-on.
  - **Suspending a premise.** A part that supports another can be suspended as a test:
    - its struts break, labelled "sostegno sospeso", and it is marked "sospesa (prova)";
    - the part it held up stays in place, marked "non derivata qui" when every support is suspended and "sostegno ridotto: n di m" otherwise;
    - nothing is removed.

    The contract does not say whether two supports hold jointly or one at a time, so one suspended support of two only reduces. The effect is not carried down "ne segue" to the consequence. Both points are stated in the README and are findings for the owner.
  - **README.** `prototypes/guided-reading/README.md` says how to open the prototype, which parts are computed (passages, roles, margin, appearance of parts and joints) and which are drawn by hand (positions and shapes, `CONFIG`), the shape and joint vocabulary for both families, and the limits.
  - **Checked in the in-app browser** (served from the repository root on port 4321, at 1440×900, no console errors):
    - `window.__check()` lists every line drawn between parts, at the current level, and any that is not a joint of the fixture. None is unknown at any point checked:
      - importer, last passage: 8 of 8 top-level joints;
      - importer, the round opened: its 4 internal joints;
      - Mill, last passage: 5 of 5 joints;
      - Mill, the limits opened: 3 sub-parts and no joints.
    - Mill's route: passage 1 adds and relates sovereignty → claim; 2 bounds → claim; 3 utility → claim; 4 objection → claim and claim → region.
    - Suspending sovereignty gives "sostegno ridotto: 1 di 2 sospesi" on the claim. Suspending sovereignty and utility gives "non derivata qui".
- **G8.1, CI (automated).** On pull request 44 (head `eedd18b`), opened by the owner as a draft because the GitHub connector refused its token: "Types, tests and build" on macOS, "Windows: types, tests and build" and GitGuardian passed. Local `npm run check` and `npm run build` are recorded under each phase.
- **G8.2, integration on the built app:** recorded under G6 (four runs, both languages, both themes, two sizes, three public examples).
- **G8.3, the owner's reading:** pending, on the owner's device.
- **G8.3, first look by the owner (2026-11-02): failed.** The owner's words: "quello che hai fatto non assomiglia per nulla al prototipo che hai creato. Il disegno è di lato, in mezzo c'è un wall of text incredibile. Non ci siamo proprio". Two causes, both mine:
  - G3 was built inside Codex's layout, which puts the rendered passage at the centre and the drawing in a side column;
  - the passage appeared twice, rendered at the centre and again as lines in the source pane.
  Version 2 replaces that structure (G9) and brings the prototype's object into the app (G10).
- 2026-11-02: `implement P-20261102-guided-reading v2 --phase layout`.
- **G9, the prototype's structure (automated tests and integration).** `GuidedReading` now has four regions in a grid, as in `prototypes/guided-reading`:
  - **left:** the route, each passage marked with what it does (frames, adds, returns to, relates, margin), from `readingRoles`, in its name for screen readers too;
  - **centre:** the drawing, on drafting paper, with the overview's own layout fitted to it (the top-to-bottom layout of G3 was for a narrow column and is no longer used; `layoutLevel`'s optional argument stays for G10);
  - **right:** the panel. The passage's number, lines and title, then the margin, the selected part and what the passage does, with Back and Continue;
  - **below:** the source band across the whole width, with lines and document views, the full-window reader and the passage highlighted.

  Codex's rendered passage (`guided-passage`) is removed, so the passage is shown once.
  - **Splitters.** Two new pane sizes, `guided` (the upper row's height, 64%) and `panel` (the panel's width, 25%), keep the overview's sizes untouched. Their splitters are labelled "Drawing and source split" and "Drawing and panel split".
  - **Keys.** ← and → work from the drawing and the panel; Escape, Alt+↑ and Z are as before.
  - Tests (`tests/guided-reading.test.tsx`, `tests/split-pane.test.tsx`):
    - on the importer at "One round, step by step":
      - the four regions exist and there is no rendered passage or article;
      - a sentence of the passage occurs once in the page, in the source band;
      - the panel's heading is the passage's title;
      - the current passage in the route carries the marks add, relate and margin, also in its accessible name.
    - Codex's tests and G3–G5's tests pass on the new structure, with the new splitter labels and values (59 after ↑ from 64, 30 after ← from 25, both remembered).
  - **Integration on the built app** (four runs: English paper 1440×900, English blueprint 1280×800, Italian paper 1280×800, Italian blueprint 1440×900; Atlas, Mill and the importer at the first and last passage):
    - every example opens in the guided view;
    - the four regions are within the window and the page never scrolls sideways;
    - no rendered copy of the passage exists;
    - outlines, marks and joints are as in G6.
  - Measured regions (width × height):

    | Size | Route | Drawing | Panel | Source band |
    |---|---|---|---|---|
    | 1440×900 | 190×501 | 826×501 | 350×501 | 1400×270 |
    | 1280×800 | 166×437 | 730×437 | 310×437 | 1240×234 |

  - **One criterion not met as written.** G9 asked that "the drawing is the widest and tallest of the four regions". It is the tallest and the largest by area (414,000 against the band's 378,000 square pixels at 1440×900), and the widest of the upper row. The source band runs across the whole width, as in the prototype, so it is wider. Recorded for the owner, not reinterpreted.
  - Screenshots: the importer at "1. What the importer does" (all outlines, the frame in the panel) and at "9. The night board" in blueprint at 1280×800 (plates readable, current joints marked, the passage highlighted in the band).
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 31 files and 489 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass; `git diff --check` passes. Nothing of this phase is committed yet.
- 2026-11-02: `implement P-20261102-guided-reading v2 --phase drawing`.
- **G10, the object (automated tests and integration).**
  - **Shape table.** `src/renderer/disassembly/shapes.ts` holds the plan's table. `SHAPE_BY_KIND` covers the argument and story kinds; `SHAPE_BY_ICON` covers all 37 icons; `shapeOf` lets the kind decide first. 18 shapes in all, `block` included as the fallback.
  - **Drawing.** `src/renderer/disassembly/ObjectSheet.tsx` draws the level as a 2.5D board in plain SVG, with no new dependency:
    - places come from the overview's layout, folded as the workbench folds a long chain (`workbenchLayout`), so a chain is not a long diagonal;
    - footprints are 60% of a plate's width and 70% of its depth; places come closer across (62%) and keep their distance in depth (100%), so a tall shape does not cover the part behind it;
    - shapes are drawn back to front;
    - joints are drawn by kind: arrow, dotted arrow, strut, red wedge, bar, track, cause mark. Each carries `data-joint`, and the current ones are marked;
    - outlines, `read-…` marks and badges are as in G3, under the same class names, so G3–G5's tests run on the object unchanged;
    - each part keeps its button, number, name, kind and mark in its accessible name;
    - colours come from the theme's tokens, in paper and blueprint;
    - names and joint labels keep a screen size of about 13 and 11 pixels however small the board is drawn, measured with a ResizeObserver.
  - **Switch.** The drawing's bar has an "Object · Plates" switch, remembered on this device (`btw:guided-drawing:v1`). The object is the default.
  - **Depth.** y opens the sub-assembly on the same kind of board.
  - Tests:
    - `tests/shapes.test.ts`: every icon has a shape; only step, component and artifact defer to the icon; no kind and icon pair falls to the fallback; the kind decides first (a premise with the `repeat` icon is a pillar); every part of the seven public fixtures has a shape.
    - `tests/guided-reading.test.tsx`, on Atlas, Mill and the importer at the first, middle and last passage: the lines drawn between parts are exactly the joints related so far, all of them joints of the fixture; outlines are the parts not yet added; the added and returned-to marks are the passage's own.
    - The Plates switch shows today's sheet, is remembered after a remount, and switches back.
  - **Integration on the built app** (English, paper and blueprint; Mill and Atlas at their last passage at 1440×900, the importer at "The night board" or "One round" at 1280×800):
    - the object is drawn with the expected shapes:
      - importer: switch, cycle, register, marker, tape, cycle, gauge;
      - Mill: wedge, field, beam, foundation, set aside, clamp, pillar;
      - Atlas: cycle, cycle, tape, register, chamber, conveyor;
    - the joints counted are 8, 5 and 6;
    - the page never scrolls sideways.
  - **Three defects found on screen and fixed:**
    - Atlas, a chain of six, was a long diagonal: it is now folded;
    - the importer's parts covered each other in depth: places now keep their distance in depth;
    - Mill's board went past the frame, because the view box was taken from the parts' corners instead of the board's: it is now taken from the board.
  - **Left as they are, for the owner's look (G8.3):**
    - on Mill the board is large for its parts, so shapes are small and some names and joint labels overlap where parts are close;
    - at 1280×800 some joint labels touch.

    These are projection choices (plan Risks), not changes to the core layout.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 32 files and 502 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass; `git diff --check` passes. Nothing of phases layout and drawing is committed yet.
- **G8.3, the owner's look after G9 and G10 (2026-11-02, on the owner's device): failed.** The owner's words, in summary:
  - In Codex's object prototype there was always a reference to where you are, and the object there was more effective.
  - There is no explicit x, y, z navigation with buttons, as the HTML prototype had.
  - The minimap that says "you are here" is missing. On the owner's own document the route has too many entries (61).
  - Every level should already be taken apart and openable at once, without waiting.
  - Transitions should be fluid and natural, like a disassembly, with some levels turning transparent.
  - "Dobbiamo ancora lavorarci, non mi soddisfa ancora."

  Of these, the minimap, the x/y/z controls, fewer passages and the transitions are presentation. Decomposing every level in advance changes generation: today depth comes on request, through the expansion, and the four whole-source generations produced none.
- 2026-11-02: `implement P-20261102-guided-reading v3 --phase orientation`.
- **G13, steps (automated tests).** `readingSteps` in `src/core/source-reading.ts` groups a route into steps:
  - a step starts at the first passage of a source, or where a passage frames the whole, adds a part or relates a joint;
  - the passages in between join it, with their returns (except parts the step adds), their sub-parts and their margin notes.

  The guided view now moves by steps. The saved position stays a line, so older progress finds its step. The interface says "step" ("Step 4 of 10", "What this step does").
  - `tests/source-reading.test.ts`:
    - Atlas, Mill and the importer go from 14, 5 and 15 passages to 9, 4 and 10 steps, each within 1 + parts + joints;
    - on every public fixture, every line belongs to exactly one step, every step after the first changes the drawing, and G2's invariants hold on steps.
  - The player tests follow the steps. On the importer, "Why the job succeeded is not enough" joins "6.1 The four outcomes", and "9. The night board" adds the board and returns to the outcome log, the pause switch and the restart rule (three "Returns to a part" blocks). The glossary's note is in the last step's margin.
- **G12, x, y and z as controls (automated tests).** The panel's footer moves into a deck under the drawing, as a toolbar, "Reading controls", with three groups:
  - **x:** Back, "n / N", Continue (or "See the whole" at the end);
  - **y:** "Open ⟨part⟩", for the selected part or the first part of the step with a sub-assembly, and "Back to the whole";
  - **z:** the margin with its count.

  Each control's tooltip names its key ("Key: →", "Key: ↓", "Key: Esc · Alt+↑", "Key: Z"). ↓ is a new shortcut for "Open".
  - On the importer:
    - at step 1, Back, "Open a part" and "Back to the whole" are disabled;
    - at "One round", "Open The round" shows 5 parts and "Back to the whole" returns to 7;
    - ↓ opens and Escape closes;
    - at "4. The heartbeat stamp", "Open a part" is disabled.
- **G11, the minimap (automated tests and integration).** The deck starts with a minimap: the top level in miniature, in the drawing's style (the object without labels, or plates that cannot be focused), with the same reading marks.
  - Inside a part, the part is ringed, the minimap reads "You are here · ⟨part⟩", and pressing it returns to the whole at the same step. At the top level it is a map and cannot be pressed.
  - "Hide map" and "Show map" are remembered on this device.
  - The minimap is in the deck, outside the drawing area, so it cannot cover a part.
  - Tests: its place outside `.guided-detail-drawing`; 7 outlines at step 1 on the importer; the ring and the accessible name "You are here: Night importer › The round. Back to the whole" inside the round; the return at the same step; hiding remembered after a remount.
  - Integration (English, paper at 1440×900 and blueprint at 1280×800; Atlas, Mill and the importer at the first, middle and last step, and inside the round): the minimap (170×96) overlaps no part at any point, and the page never scrolls sideways. The route shows 9, 4 and 10 steps.
- **G14, transitions (automated tests and integration).**
  - **Opening a part:**
    - the top level stays behind as a faded backdrop (opacity 1 → 0.15 in 450 ms);
    - each sub-part starts where the opened part stands on that backdrop and moves out to its place, scaled from 0.35, staggered by 40 ms;
    - the offsets are measured on screen and converted to the drawing's units.
  - **Back:** the level fades in again, with the part just left selected.
  - **A part added** rises onto the board; **a joint related** is drawn from end to end (solid lines) or fades in (dashed ones); **a part returned to** pulses its mark once.
  - Under `prefers-reduced-motion: reduce`, every animation and transition in the guided view is off.
  - Tests:
    - opening the round sets `opening` with a backdrop holding the round, and Escape sets `returning` with no backdrop;
    - every animation the stylesheet uses has its keyframes, and the reduce-motion block turns all of them off.
  - Integration: a frame captured 130 ms after "Open The round" shows the five steps on their way out from the round's place, smaller and fading in. At 650 ms they are in place, with the backdrop faded.
  - **Limits seen on screen, for the owner's look:**
    - the minimap is small (64 px high), so the ring around the current part is thin;
    - at 0.15 the backdrop is barely visible behind a sub-assembly that covers the same area.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 32 files and 516 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass; `git diff --check` passes. Phases layout, drawing and orientation are not committed yet.
- **G8.3, the owner's third look, after G11–G14 (2026-11-02, on the owner's device): not yet satisfying.**
  - "Il tasto freccia in alto per tornare all'insieme sembra non funzionare." Confirmed in code: ↓ opens a part (G12), but going back takes Escape or Alt+↑; ↑ alone does nothing. The asymmetry is mine.
  - The upper level's transparency is right. But the levels should be developed vertically, the sheet going down (or up), so that both are seen: the upper one without focus, and all levels at once when there are several.
  - The list of steps has no title that says what it is ("Contenuti"), and its dots have no legend, so their purpose is unclear.
- 2026-11-02: `implement P-20261102-guided-reading v4 --phase stack`.
- **G15, ↑ goes back up (automated tests).** In the drawing and the panel, ↑ goes up one level, as ↓ opens one; Escape and Alt+↑ still work everywhere. The control's tooltip reads "Key: ↑ · Esc".
  - Test on the importer: ↓ opens the round (two levels), ↑ returns to one level at the same step, and ↑ again at the top does nothing.
- **G16, the route says what it is (automated tests).**
  - The route is titled "Reading steps" ("Passi di lettura").
  - An always-visible legend, "What the marks mean", lists frames the whole, adds a part, returns to a part, relates two parts and margin, each with its mark.
  - A step whose heading repeats the step before, or that has none, is named by the first words of its first line (at most 48 characters), cleaned of markdown signs.
  - Test on Mill: the heading, the five legend entries in order, and four steps with four different names. On the importer the steps keep their headings, as the G3–G13 tests show.
- **G17, levels stacked down the sheet (automated tests and integration).**
  - **Path.** The open path is a list of part ids. The whole is drawn first, and every open level below the part it comes from, joined by a ▼ link that names the part.
  - **Each level** is drawn by `LevelDrawing`, with its own layout and the overview's numbers.
  - **Upper levels** are drawn at 38% opacity, ringed on their opened part (`object-here`), and can be pressed:
    - a part with a sub-assembly opens in place of what was below;
    - another part closes what was below and is selected;
    - the level's background closes what is below and takes the focus.
  - **The level in focus** scrolls into view. The y controls and ↓ open from it, at any depth.
  - **G14's backdrop is replaced.** A new level descends (`entering`), and its parts still start from the opened part's place on the level above.
  - **Size.** Upper levels are compact, 110–200 px, so that the level in focus and the ones above it fit together; the focus takes the rest, at least 220 px. The drawing row's default share rises from 64% to 70%.
  - Tests:
    - on the importer, opening the round gives the whole above (7 parts, `upper`, the round ringed) and the round below (5 parts, `focus`); pressing the whole's background leaves one level in focus;
    - with `deepDisassembly(5)`, opening p1, p1-1 and p1-1-1 gives four levels in order, only the last in focus, the last with 3 parts;
    - pressing p1-1 on the second level closes the two below (3 levels left);
    - pressing p1-2 there closes what is below, gives that level the focus and selects p1-2.
    - G14's test now checks the stack: `opening` and `entering`, the round ringed above, `returning` and no upper level after Escape.
  - **Integration on the built app** (English, paper at 1440×900 and blueprint at 1280×800; the importer with the round open, Atlas with "Rollback" open):
    - two levels: the upper one 110 px at opacity 0.38, the focus 220 px at opacity 1;
    - the level in focus is in view, and the page never scrolls sideways;
    - the route shows its title and five legend entries;
    - at 1440×900 the two levels fit in the drawing area (350 px) with no scroll; at 1280×800 it scrolls by 55 px.
  - **First version of the stack.** On the first try, with each level 396 px high, the drawing area (303 px) showed only the level in focus, so the upper one scrolled out of view. The levels became compact and the drawing row taller.
  - **Limits seen on screen, for the owner's look:** the upper level is small at 110 px, readable as context but not in detail; with three or more levels open, the sheet scrolls.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 32 files and 520 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass; `git diff --check` passes. Phases layout, drawing, orientation and stack are not committed yet.
- **G8.3, the owner's judgement after the lab prototypes (2026-11-03, witnessed in this session).**
  - The stacked board does not answer "but what is it?": "i risultati attualmente sono pessimi".
  - The owner tried, in order:
    - the private lab on their own document: a designed object, progressive building, a lifted opening, a compact card;
    - then rules-composed objects and atlases on the public fixtures.
  - Of the lab: "Mi sembra adesso una buona base di partenza da cui poter sviluppare questa modalità".
  - Requirement: one whole representation per source, an object or an atlas, chosen by concrete correspondences. See research [R-20261103-lab-mode](../../research/R-20261103-lab-mode.md).
  - Decision: "direi di procedere con questo approccio per la parte di implementazione" (plan P-20261103-lab-mode), then "Yes, close and commit" for this plan.
  - Outcome: this plan closes as `superseded`. Its G9–G17 work is committed as it stands, as the base the next plan builds on.
