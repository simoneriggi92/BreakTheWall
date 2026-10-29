# Research: a more varied Run, generated as data and anchored to joints

Date: 2026-10-29. Question: the owner wants the Run section to be "as varied as possible, helping the learner understand and simulate", and points to Codex's run lab prototype (local, port 5190) and to products where simulation works well, such as Brilliant. What do the prototype's five interactions do, which of them can a model generate and the app check for any source, and how does this meet openable joints (plan 2 of [R-20261029-source-entry](R-20261029-source-entry.md))?

## Evidence

- **Codex's run lab prototype**, outside this repository: `~/.codex/visualizations/2026/10/27/01a17c8a-5d20-7b21-a720-ed3e8ac0e23f/core-prototype/` (`run-lab.js`, `run-lab.css`, `README.md`), served at `http://127.0.0.1:5190/`. It is built on the owner's private document. This research describes its behaviour only, with examples taken from this repository's public fixtures instead of its content.
- **The product definition**: [`docs/product.md`](../../product.md), lines 21, 43–47, 87, 141, 177, 197 and 217.
- **The current run flow in code**, traced below from generation to the drawing and to stored progress.
- **Design references named by the prototype's README**: Brilliant (brilliant.org/about) and PhET's activity design guide (phet.colorado.edu). These were not reviewed independently here; see Assumptions.

## What the prototype does

The Run tab opens a "lab of the connection": a scene for one joint, with five interactions on a tab strip. The exploded view stays reachable through "Show in the exploded view"; the explanation and the cited source stay in the right column, together.

| Interaction | What the learner does | What the scene shows |
|---|---|---|
| **Vary** | picks a mode (three buttons) and drags a time slider | a verdict that updates at once; bars for two ages against a marked threshold; "compare the two modes at the same time" |
| **Step a flow** | clicks "produce", "deliver next", toggles "sink paused", and can go one step back | items moving through a bounded queue, the items dropped, and a balance: *produced = queued + delivered + dropped* |
| **Remove a joint** | removes, then restores, one explicit link | before and after side by side: what stays identical, what stops being observable |
| **Investigate** | picks a situation (three), opens up to three clues, chooses a conclusion and checks it | clue cards revealed one by one; "absence of data is not a single cause" |
| **Predict** | the earlier choose-then-run scenario | as today |

Each interaction has a short task ("one thing to look for", "one thing to try"), a cited passage, and a note that the values are illustrative and no real system runs.

**How it is built:** each interaction is a hand-written function for this one document: `varyScene`, `flowScene`, `removeScene`, `investigateScene`, and their `…Reading` counterparts. The verdicts are `if`/`else` over the scene's state. No part of it is data that another source could fill.

## The run flow today

**Contract.** `runSchema` is a union of three types ([`disassembly.ts:76–92`](../../../src/core/disassembly.ts)):
- `scenario`: setup, `vars`, 2–12 steps, each with an action, an optional prediction, `effect` (part → `ok | active | failed | restored`), `flow` along existing joints, changed `vars`, an explanation and citations;
- `load`: a target part and 2–7 bricks with a verdict `falls | weakens | holds`;
- `case`: a new situation, a question and 2–5 options.

A disassembly holds 1–10 runs. `checkDisassembly` ([`disassembly.ts:359–385`](../../../src/core/disassembly.ts)) checks one correct option per set, that effects name top-level parts, that a flow follows an existing joint, that a brick is not its own target, and the citations.

**Generation.** The structure phase marks each part with a run fit, `scenario | load | case | none` (`RUN_FITS`, [`disassembly-generation.ts:26`](../../../src/core/disassembly-generation.ts)). The runs phase is one request (`RUNS_INSTRUCTIONS`, line 143). It carries the structure with content and every source in full (`buildRunsInput`, line 206), and asks for 1–3 runs (`runsZod`, line 64). `acceptRuns` (line 429) applies the contract's checks, the giveaway check on options (`optionSets`, line 332) and the language check. The MCP assistant follows the same path through `submit_runs` ([`assistant.ts:77`](../../../src/mcp/assistant.ts)).

**Player.** [`DisassemblyPlayer.tsx`](../../../src/renderer/disassembly/DisassemblyPlayer.tsx):
- it keeps one run selected (line 45) and returns the drawing to the top level while a run is open (line 156);
- `runDecor` (lines 157–166) turns a scenario's states and flow, or a load test's removed brick and verdict, into decorations;
- [`Sheet`](../../../src/renderer/disassembly/Sheet.tsx) (line 64) draws them as part states, flowing joints and a broken joint.

[`RunPanel.tsx`](../../../src/renderer/disassembly/RunPanel.tsx) renders the three types. The `vars` are a table under the controls; the learner can read them but never set them.

**Stored progress.** `disassemblyStateSchema.runs` ([`disassembly-state.ts:13`](../../../src/core/disassembly-state.ts)) keeps, per run, a step, the choices and the bricks tried. `referencesHold` (line 40) checks that shape per run type; if it fails, no stored progress is applied.

**Measurement.** `eval/metrics.ts` counts runs per type and inferences, and measures the answer-length ratio of option sets (lines 28–39). Nothing measures whether a run is correct beyond its options and citations.

**Fixtures.** Atlas has a scenario (5 steps) and a case; the importer has a scenario (4 steps) and a case; Mill has a load test and a case. There is no story-kind disassembly, so no run has been tried on `leads-to` or `because` joints. The same gap is recorded in [R-20261024](R-20261024-lab-prototype.md), finding 2.

**Joints.** A joint has no identity and is not interactive ([R-20261029-source-entry](R-20261029-source-entry.md), "What a joint is today"). A run cannot name the joint it tests; a load test targets a part.

## Constraints

- **Run puts a joint under load.** It is "always an action by the learner that tests a connection, never more text from the AI" ([`product.md:21`](../../product.md)).
- **One loop for every subject.** Only the kind of joint changes, and the form of run follows it (`product.md:43–47`). There are no modes per subject.
- **Scenarios are data, never executable UI.** They are "a declarative state machine whose rules cite source lines, rendered as 2D SVG, generated as data and never as executable UI" (`product.md:177`). Arbitrary executable simulations are outside the first alpha (`product.md:217`).
- **Simulations are optional and never forced** on the learner (`product.md:141`).
- **A simulated scenario names its initial state, its action and its result,** and labels illustrative data and simplifications (`product.md:197`).
- **Stored disassemblies stay valid.** New run types and fields are additive under `schemaVersion: 1`, as in previous plans.

## From five interactions to primitives

The prototype's interactions are worth keeping, but only as **primitives**. A primitive is a run type whose model is data the generator writes and the app interprets. The app, not the model, computes every outcome. Each primitive is shown below with a public example.

| Primitive | The model writes | The app computes | The app checks | Joints it fits |
|---|---|---|---|---|
| **rule** (Vary) | 1–3 inputs (a choice of values, or a number with a range and unit); ordered rules `when → outcome`, each with a why and citations; outcomes, each with the states it gives parts | the outcome for any setting, first matching rule wins; the parts' states on the drawing | every combination of choices and number intervals (split at the rules' thresholds) reaches a rule; no rule is unreachable; every rule cites | mechanism: `causes`, `depends-on`, `sends-to` |
| **stock** (Step a flow) | places with an optional capacity and a policy (keep, drop oldest, drop newest, wait); actions that move items between places | the state after each action, the step back, the balance | references exist; capacities are positive; the balance is the app's own invariant, never the model's claim | mechanism: `sends-to` |
| **cut** (Remove a joint) | the joint to cut; per affected part, what stays and what is lost, with a verdict and citations | the drawing with the joint broken and the affected parts marked | the joint exists; every affected part is reachable from the cut joint | all kinds: an argument's support (`supports`), a story's `because` |
| **evidence** (Investigate) | 2–4 clues, each tied to a part, revealing a cited observation; 2–4 conclusions, one correct, each wrong one naming the clue that contradicts it | which clues are open; the feedback on a conclusion | one correct conclusion; each wrong conclusion refers to an existing clue; clues cite | all kinds |
| **scenario** (Predict) | as today | as today | as today | mechanism, story |

`load` and `case` stay. `load` becomes the argument form of **cut**; `case` is an **evidence** run with a single clue, the situation itself.

**Public examples**
- **rule:** in the importer, the restart rule. Inputs are the state of the round (running, paused, stuck in a call), the minutes it has been in that state, and the minutes since the last start; outcomes are "leave alone" and "restart". A paused round still stamps the heartbeat, so its stamp never ages; the rule reads only the stamp's age and the start grace (`eval/cases/sources/night-importer.md`, lines 138–148 and 155–161).
- **cut:** in Mill, cutting the `supports` joint from utility to the claim makes the claim fall, while removing the abstract right leaves it standing. This is today's load test, expressed on joints instead of parts. In Atlas, cutting `same commit` loses the guarantee that staging runs the checked image.
- **evidence:** the importer's "grey light at two in the morning", opened clue by clue (stamp age, last-finished time, outcome counts) instead of read as one paragraph.
- **stock:** no public fixture has a bounded buffer. Testing this primitive would need a new public example.

**Goals the app can verify.** The prototype's "one thing to look for" is the strongest idea it borrows from PhET, but it is left unchecked ("free exploration: no answer needed"). With rule and stock models the app can check a goal itself: a goal is a target outcome or place state, and the app finds by enumeration whether the learner can reach it. The model only proposes it. An unreachable goal is legitimate, and it is where the concept is learned. In the importer, "get a restart while paused" cannot be reached, because a pause keeps the heartbeat fresh, and that is exactly why the source's design works. The model's claim that it is unreachable is checked, not trusted.

## Findings

1. **The prototype's variety is code, not data.** Every scene and verdict is written by hand for one document. Copying it would make Run a per-source build, which the product rules out (`product.md:177, 217`).
2. **Four primitives cover the five interactions.** They are rule, stock, cut and evidence, with today's scenario kept. Each primitive's outcomes are computed by the app from data, so none is executable UI.
3. **The app can check what matters most in the riskier primitives.** Coverage and reachability for rule; the balance for stock; references for cut and evidence. What it cannot check is whether a rule matches what the source says. Only citations and review can, so every rule must cite.
4. **The cost and the risk differ by primitive.** Cut and evidence are close to today's load and case: low cost and low risk. Rule is new but small and fully checkable. Stock needs a small interpreter, a new public example, and the most care in generation.
5. **The joint is the anchor.** Every primitive tests one joint, and a run needs a `joint` reference, `(from, to)` in its level. This is the same identity that openable joints need (R-20261029-source-entry, finding 6). The two pieces of work share their first step.
6. **The joint kind selects the primitives.** Mechanism joints allow all five, arguments cut and evidence, stories cut, evidence and scenario. The structure phase's per-part `run` fit (`RUN_FITS`) would become per joint. This keeps one loop and no modes per subject.
7. **Feedback must commit before it reveals.** Brilliant asks for an attempt before showing the answer; the prototype's Vary does not. Every primitive should ask for a prediction or set a verifiable goal first, then let the learner explore freely.
8. **The drawing should stay.** The prototype's lab scene replaces the exploded view. Our `Sheet` can already draw part states, flowing joints and a broken joint. Rule outcomes, cut joints and opened clues can light the same drawing, with a primitive's own control (slider, queue) beside it, so the spatial link holds.
9. **Stored progress needs new shapes.** The current progress record (step, choices, tried) does not hold slider values, flow history or opened clues. `referencesHold` must learn each new type, or stored progress for those runs is simply not applied.
10. **Generation grows.** The runs request picks a primitive per joint and writes larger models. Up to 3 runs per disassembly may become too few for variety, but more runs means more output to check and to repair.

## Assumptions

- Brilliant's and PhET's principles are those the prototype's README names: manipulation of a visual model, an attempt before feedback, short guidance, and bounded goals. They were not reviewed here against those products' own material.
- 1–3 inputs and a handful of thresholds keep rule enumeration small (a few hundred combinations at most).
- Hosted models can write a coherent rule table from cited lines. This is not measured; the evaluation set has no rule run.

## Risks

- **A wrong rule teaches something false, convincingly.** This is more dangerous than a wrong option, because the learner explores it. Mitigations: citations on every rule, coverage checks, the "illustrative" label, and a review of real generations before a primitive is offered by default.
- **Variety as decoration.** A format chosen because it is available, not because the joint needs it. The joint kind limits the choice; the eval should count which primitive was chosen for which joint.
- **Scope.** Joints, four primitives, layout, generation and stored progress are too much for one plan. Phasing is needed.
- **Stories are untested.** No public story fixture exists. The cut and evidence forms for stories are design, not evidence.

## Questions for the owner

1. **Openable joints and Run variety in one plan, or joints first?** They share the joint identity and the run's anchor.
2. **Which primitives first?** Recommended: cut and evidence (low risk), then rule. Stock comes later, with its own public example.
3. **Free exploration or commitment first?** Recommended: a prediction or a verifiable goal before free play.
4. **The scene beside the drawing, or replacing it?** Recommended: beside it, with the drawing lit by the run.

## Recommendation

Planning is justified. One plan, with gated phases:
1. **Joint anchor.** A joint identity within its level, a selectable joint in the drawing, and a `joint` reference on runs. Today's runs keep working.
2. **cut and evidence.** `load` and `case` generalized onto joints; the drawing shows a cut joint and opened clues; stored progress for both.
3. **rule.** The input/rule/outcome model, coverage and reachability checks, goals the app verifies, a slider and choices beside the drawing.
4. **Generation and measurement.** Primitive per joint in the runs request, checks in `acceptRuns`, eval metrics per primitive, and one real generation per kind of joint, on a route and at a cost the owner confirms.

stock waits for a later plan with a public example. Implementation waits for P-20261029-source-entry to complete, since only one plan implements at a time; P-20261029-source-limits is already approved and queued after it, so the owner sets the order.
