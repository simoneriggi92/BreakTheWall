---
id: P-20261102-guided-reading
title: Guided reading - the drawing follows the source, passage by passage, with depth and a margin
version: 1
state: implementing
current_task: G3
last_evidence: Phase route implemented - Codex's guided reading on main (G1) and what each passage does (G2); TypeScript, 31 test files with 485 tests and both builds pass on macOS
next_action: Implement phase player with a separate command, "implement P-20261102-guided-reading v1 --phase player"
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

The object drawn with functional shapes (cycle, register, switch, gauge…) stays an **experiment**, in `prototypes/guided-reading`, on public fixtures. It enters the product only through a later plan, if the experiment and a test with people show that it helps.

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

## Scope

Included:
- the passage route and what each passage does (`src/core`);
- the guided view in the player: drawing states, depth, margin, keyboard, both languages and both themes;
- the saved reading position;
- the prototype of the object, under `prototypes/`, extended to an argument;
- tests.

Not included:
- functional shapes in the contract, in generation or in the player;
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

### Phase `verify`

**G8. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows.
2. Integration on the built app, with a scratch data folder (G3–G6).
3. The owner reads one of their own generated disassemblies in the guided view, on their device. Their judgement is recorded:
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
- **The prototype's object may please without helping.** The plan keeps it out of the product until a test with people asks for explanations and predictions, not preferences.

## Verification strategy

- Automated: `npm run check` (TypeScript and Vitest), with the tests named in each task.
- Integration: the built app driven over the DevTools protocol with a scratch data folder; scripts stay in the scratchpad.
- Prototype: opened from a static server in the in-app browser, with screenshots.
- Witnessed: the owner's reading of their own disassembly (G8.3).

## Approval

Approve with: `Approve P-20261102-guided-reading v1`. Then implement with a separate command, for example `implement P-20261102-guided-reading v1 --phase route`, after pull request 39 is merged.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261102-guided-reading v1`.
- Approved plan/version: `P-20261102-guided-reading` / `1`.
- Recorded at: `2026-11-02T16:51:23+01:00` (Europe/Rome).
- Approved scope: phases `route` (G1–G2), `player` (G3–G6), `object` (G7) and `verify` (G8), on a new branch `feature/guided-reading` from `main` after pull request 39 is merged.
- Approved-content SHA-256: `e27a9fb38b5a11f00e6836e2548c16989ed3fca21ed3a09a0d4d0aed4240b2f9`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Guided reading` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v1. Pushing, pull requests, merges and deleting branches need the owner's confirmation when reached. No new dependency. Private material stays out of the repository.

## State changes

- 2026-11-02: `awaiting_approval` → `approved`. No other plan is active.
- 2026-11-02: `approved` → `implementing`, on `implement P-20261102-guided-reading v1 --phase route`. Branch `feature/guided-reading` from `main` at `b05b45a` (pull request 39 merged).

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
