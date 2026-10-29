---
id: P-20261029-openable-joints
title: Openable joints - select a joint, read what it carries and when it fails, and put it under load
version: 1
state: blocked
current_task: J1
last_evidence: Not run
next_action: Blocked while P-20261029-source-entry implements; after it is completed (and P-20261029-source-limits, in the order the owner chooses), implement with a separate command, starting with "implement P-20261029-openable-joints v1 --phase contract"
approval: approved
---

# Openable joints

## Outcome

A learner can open a joint as they open a part:
- **Select it in the drawing**, with the mouse or the keyboard.
- **Read its card beside the source**: the two parts, the kind of relation, what the joint carries or why it holds, when it fails, and the lines that state it.
- **Put it under load** from the card, when a run tests that joint. The drawing marks the joint while that run is open.

Joints get an identity, the ordered pair `(from, to)` within their level. The next plan on the variety of Run ([R-20261029-run-variety](../../research/R-20261029-run-variety.md)) builds on that identity.

## Evidence

- [Research R-20261029-source-entry](../../research/R-20261029-source-entry.md), section "What a joint is today", findings 6–8 and plan 2 of its recommendation.
- [Research R-20261029-run-variety](../../research/R-20261029-run-variety.md), finding 5: every run primitive needs a joint to anchor to.

## Owner's decisions (2026-10-29)

- Two plans in sequence: first the entry without a question (P-20261029-source-entry), then openable joints. Help at the point of difficulty and contesting the AI's reading come only after a test with real people.
- Openable joints come before the variety of Run ("Prima i giunti"). The run primitives (rule, stock, cut, evidence) belong to a later plan.

## Scope

**Included:**
- the joint's identity and two optional content fields;
- a run's optional reference to the joint it tests;
- selecting a joint in the stored state and in the drawing;
- a joint card in the reading column;
- the three prepared examples in both languages;
- generation of joint content for top-level joints, through the app's generator and the MCP assistant;
- tests and evaluation metrics.

**Not included:**
- new run types (the run variety plan);
- joints in reassembly;
- notes on joints;
- generated content for joints inside sub-assemblies: their card shows the relation, its label and its lines, without the two new fields;
- help at the point of difficulty;
- contesting the AI's reading.

## Preconditions

- **Order of plans.** P-20261029-source-entry is completed and merged first. P-20261029-source-limits is approved and queued after it; the owner decides which of the two plans implements next. Only one plan implements at a time. This plan starts from `main` on a new branch `feature/openable-joints`.
- **No new dependency.**
- **Stored files stay valid.** Every new field is optional and `schemaVersion` stays 1. Stored progress that names a joint missing from a later revision is not applied, as today for parts.
- **External actions** (push, pull request, merge, any generation that spends the owner's usage) only on the owner's confirmation when reached.

## Tasks

### Phase `contract`

**J1. Product definition.** In `docs/product.md`:
- describe the joint card and the selectable joint in the loop ("See the exploded view");
- remove "typed joints" from the "Not yet built" line, since they are built;
- state that a run may name the joint it tests.

Acceptance: the three changes are in the text; no other section contradicts them.

**J2. Joint content and identity.** In `src/core/disassembly.ts`:
- `jointSchema` gains `meaning` (text: what the joint carries, or why it holds) and `fails` (text: when it stops holding and what is lost), both optional;
- a joint with `meaning` or `fails` must cite lines (a finding otherwise), since every statement rests on the source;
- a helper `jointKey(from, to)` and `findJoint(level, from, to)` name the identity, which the existing duplicate check already makes unique per level.

Acceptance (tests):
- a joint with `meaning` and cites validates;
- a joint with `meaning` and no cites gives a finding at its path;
- every stored fixture still validates;
- the bill of materials counts joint citations as today.

**J3. A run names its joint; the state selects a joint.**
- Each run type gains an optional `joint: { from, to }` that must name an existing top-level joint (a finding otherwise).
- `disassemblyStateSchema` gains `joint: [from, to]` (optional). Selecting a joint clears `selected`, and the other way round.
- `referencesHold` rejects a stored joint that does not exist in the open level.
- New state functions: `selectJoint`; `openLevel` and `selectPart` clear the joint.

Acceptance (tests):
- a run naming a missing joint gives a finding;
- selecting a joint then a part keeps one selection only;
- stored progress with an unknown joint is not applied;
- stored states without `joint` load as before.

### Phase `drawing`

**J4. A selectable joint.** In `Sheet.tsx`:
- each joint's label box becomes a button (`role="button"`, focusable, `aria-pressed`, an accessible name such as "Check sends to Image · same commit"), selected with a click, Enter or Space;
- labels are drawn in a layer after the plates, so plates never cover them and Tab reaches the joints after the parts, in reading order;
- the selected joint, and the joint a run tests, are drawn thicker, with their two plates outlined;
- the existing run decorations (flow, broken, muted) are unchanged.

Acceptance (tests and integration):
- a click on a label and Enter on a focused label both select the joint;
- Tab goes through plates, then joints;
- a selected joint carries `aria-pressed="true"`;
- the three examples show no label covered by a plate at 1440×900 and 1280×800, in both themes.

**J5. The joint card.** A `JointCard` in the reading column, in place of the part card while a joint is selected:
- an eyebrow with the kind of relation;
- "From → to" with both parts' icons and names, each a button that selects that part;
- the label;
- `meaning`, then `fails` under "⚠ When it fails", when present;
- the citations, which move the source pane as a part's citations do.

The part card's list of joints becomes buttons that open each joint. When a run names the joint, a button "Put it under load" switches to Run with that run; while it is open, the drawing marks its joint (J4). Interface text is in `it.ts` and `en.ts`.

Acceptance (tests in both languages):
- the card shows its fields and only those present;
- the citations focus the source;
- the part buttons select parts;
- "Put it under load" opens the right run, and appears only when a run names the joint;
- a joint inside a sub-assembly opens a card without the two fields.

### Phase `examples`

**J6. The prepared examples.** Atlas, Mill and the importer, in Italian and English:
- every top-level joint (6, 5 and 8) gets `meaning` and `fails`; Mill's two top-level joints without citations get them;
- a run names a joint only when it tests that one joint. Of today's runs, that is the importer's scenario (the heartbeat's age read by the restart rule). Atlas's scenario travels the whole chain and Mill's load test targets a part, so they name none.

Acceptance:
- all six files validate;
- every top-level joint has both fields and cites;
- the importer's scenario names `heartbeat → restart`;
- the round-trip and the evaluation tests still pass.

### Phase `generation`

**J7. Joints in generation.** The runs phase already receives the structure with content and every source in full. Its schema and `RUNS_INSTRUCTIONS` gain:
- `joints`: one entry per top-level joint, with `from`, `to`, `meaning`, `fails` and cites;
- `joint` on each run (nullable).

Then:
- `compose` writes them into the disassembly;
- `acceptRuns` applies J2 and J3's checks and the language check;
- the MCP assistant gets the same request through `submit_runs`, with no change to its steps;
- `eval/metrics.ts` counts joints with content, joints whose content cites, and runs that name a joint.

Acceptance (tests):
- a runs answer with joint content composes into a valid disassembly;
- an answer with a joint that does not exist, or content without cites, returns a repair request naming the path;
- a full MCP session on Atlas still ends in a saved disassembly;
- the metrics report the three counts.

### Phase `verify`

**J8. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows.
2. Integration check on the built app, with a scratch data folder, across the three examples, both languages, both themes, at 1440×900 and 1280×800:
   - select a joint by mouse and by keyboard;
   - read the card and follow its citations;
   - open the importer's run from "Put it under load";
   - check that the part card's joints open their cards.
3. One generation on a public source, through a route and at a cost the owner confirms. The app's checks accept the joint content; the meanings are judged against the cited lines.

## Risks

- **Joint content can restate the part's role.** A meaning that repeats what the parts already say adds reading without understanding. J6 sets the example; J8.3 judges a real generation.
- **The runs request grows.** Up to 20 joints with two texts each add output to the phase that already writes runs and reassembly. If repairs or truncation rise in J8.3, a version 2 moves joint content to its own request.
- **Small label boxes are hard targets.** A label is 18 px high. J4's acceptance checks clicks and the keyboard; a wider invisible hit area is the fallback.
- **Two selections in one state.** A part and a joint must never both be selected. J3's tests cover the transitions.

## Verification strategy

- Automated: `npm run check` (TypeScript and Vitest), with the tests named in each task. Locally, `npx tsc --noEmit -p .local/tsconfig.check.json` and `npx vitest run` while untracked iCloud duplicates are in the working copy.
- Integration: the built app driven over the DevTools protocol with a scratch data folder; scripts stay in the scratchpad.
- Generation: J8.3, on a route and at a cost the owner confirms.

## Approval

Approve with: `Approve P-20261029-openable-joints v1`. Then implement with a separate command when it is this plan's turn, for example `implement P-20261029-openable-joints v1 --phase contract`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-openable-joints v1`.
- Approved plan/version: `P-20261029-openable-joints` / `1`.
- Recorded at: `2026-10-29T17:39:30+01:00` (Europe/Rome).
- Approved scope: phases `contract` (J1–J3), `drawing` (J4–J5), `examples` (J6), `generation` (J7) and `verify` (J8), on a new branch `feature/openable-joints` from `main` after P-20261029-source-entry is completed and merged.
- Approved-content SHA-256: `ce6a8cc96ea5c030e70e9c4d56d2155dfaf99757848860946417935ac8a5e220`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Openable joints` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v1, and waits until no other plan implements. Pushing, pull requests, merges and any generation that spends the owner's usage need the owner's confirmation when reached. No new dependency.

## State changes

- 2026-10-29: `awaiting_approval` → `approved` → `blocked`. Approval is recorded above; the plan waits for P-20261029-source-entry, as its precondition requires (one plan active at a time), and for P-20261029-source-limits if the owner runs that first. It returns to `approved` when its turn comes.
