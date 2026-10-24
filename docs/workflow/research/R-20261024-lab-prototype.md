# Lab prototype: disassemble → run → reassemble

Date: 2026-10-24. Scope: research and a hand-made prototype before any contract change. The prototype lives in [`prototypes/lab/`](../../../prototypes/lab/README.md), outside `src/`. No app source, contract, test or dependency is changed.

## Why this research

On 2026-10-24 the owner fixed the [product identity](../../product.md#identity):
- disassemble → run → reassemble;
- one loop with three kinds of joint;
- sub-assemblies and a verified bill of materials;
- the technical drawing as the visual hypothesis.

The shipped player is still built around lessons, pages and representations. Before planning a change of that size, a cheap prototype should show whether the identity works on real material, and what the contract would need.

## Questions the prototype must answer

| ? | How it is checked | Who answers |
|---|---|---|
| Q1. Does the exploded view with sub-assemblies show the whole **without overwhelming**? | Within about 30 seconds of opening a disassembly, say what it does and name its parts | Owner |
| Q2. Does "put a joint under load" work **with the same components** for a mechanism and an argument? | The engine has no subject-specific code; the scenario and the load test feel natural in their own case | Builder (engine), owner (feel) |
| Q3. Does reassembly feel like a **proof**, not a quiz? | Would the owner do it while it is optional? | Owner |
| Q4. Does the technical drawing read well and support focus, in paper and blueprint? | Read a long part in both themes | Owner |
| Q5. **Would the owner use it tomorrow on a real problem?** | The TeamCity disassembly | Owner, decisive |

## Current state (evidence)

| Area | Where | Relevant facts |
|---|---|---|
| Stored lesson | `src/core/lesson.ts` | Pages hold blocks: `map` (2–6 nodes, free-text edge labels), `sequence`, `comparison`, `lens`, `source`, `reflection`. Activities are `choice` and `order`. Icons come from a closed list of 19 |
| Generated draft | `src/core/generation.ts` | Opening map, then `pages[]` with one `main` representation each, then a `reconstruction`. Citations are inline line ranges. `assessDraft` checks the map, the representation mix, the activities, the language |
| Evaluation | `eval/`, [evaluation baseline](../plans/P-20261022-generation-quality/evaluation-baseline.md) | Source coverage is already measured (0.30–0.83 on ChatGPT). It measures coverage, but does not check it |

None of these has typed joints, sub-assemblies, a bill of materials, a load test or slot-based reassembly. Edge labels are free text, so "supports" and "sends to" cannot be told apart by the app.

## What was built

One static page (`index.html`, `lab.css`, `lab.js`, about 700 lines of JavaScript) renders any file of the candidate contract `btw-disassembly/0.1`. It has four modes:

| Mode | What the learner does | Engine component |
|---|---|---|
| Esploso | Opens the exploded view, selects a part, enters a sub-assembly; the source lines highlight beside it | Sheet with item balloons and a title block, typed joints, a part card, the source viewer |
| Fai girare | Runs a **scenario** (states and instruments change, with a prediction before each step), a **load test** (remove a brick: the claim falls or holds), or a **new case** | One run panel with three run types, all driven by data |
| Rimonta | Puts parts back into slots, by click or by drag; the feedback names the first misplaced part, with a hint | Slots over the joint skeleton; a tray shuffled away from the solution order |
| Distinta | Sees every part with its line ranges, the excluded ranges with their reasons, a strip of the whole source, and the host check | Bill-of-materials table and coverage check |

Three disassemblies, written by hand:

| Disassembly | Kind | Source | Parts (levels) | Runs | Repository |
|---|---|---|---|---|---|
| Atlas Reader release | mechanism, with an argument inside its rollback | `eval/cases/sources/release-runbook.md`, 177 lines | 6 + 3 sub-assemblies (12 children) | scenario (5 steps, 3 predictions), new case | committed |
| Mill, harm principle | argument | Public-domain excerpt of *On Liberty*, ch. I, 131 lines | 7 + 2 sub-assemblies (6 children) | load test (4 bricks), new case | committed |
| TeamCity frontend deploy | mechanism, with an argument inside its rollback | The owner's private runbook, 339 lines | 6 + 3 sub-assemblies (11 children) | scenario (5 steps, 3 predictions), new case | `.local/` only, ignored by git |

## Checks run

| Check | Level | Result |
|---|---|---|
| Host check on every disassembly: citations in range, 3–7 parts per level, joints on one level, every non-blank line in a part or excluded | automated in the page | all three pass. TeamCity: 166 lines in parts, 88 not taken apart (backend, header, production), 0 forgotten |
| Layout: no joint label over a plate or another label, no text outside its plate, on all 10 sheets | browser script | 0 overlaps after the fixes listed below |
| Scenario end to end (Atlas, TeamCity): states, instruments, highlighted lines at each step | browser script | every step applies; the rollback restores the previous digest |
| Load test (Mill): every brick | browser script | utility and sovereignty bring the claim down; abstract right and the region of liberty do not; the sovereignty verdict is labelled as interpretation |
| Reassembly: one wrong placement, then all correct | browser script | the first misplaced part is named with its hint; then "Rimontato" |
| Paper and blueprint themes; selection, focus, source scrolling | screenshots at 1280×800 and 1440×900 | readable. The pane was hidden during the checks, so timing was observed in a background tab |
| Owner's use | witnessed flow | **not done yet**: Q1, Q3, Q4 and Q5 wait for the owner |

## Builder observations

These come from building and testing the prototype. They are not the owner's verdict.

1. **One engine was enough (Q2, engine side).** `lab.js` never branches on the subject. Mechanism and argument differ only in data: the joint types, the part kinds, and which run type each disassembly offers. A mechanism used `supports` and `limits` inside its rollback, so typing joints per relation, not per disassembly, held up.
2. **The run type follows the kind of joint.** Scenario suits mechanisms and the load test suits arguments; a new case suits both. The generated contract has to say which run fits which part. Story joints were not tried.
3. **The bill of materials did its job.** On TeamCity the question names the frontend, so the 93 backend lines appear as *not taken apart: outside the question*. In a summary they would simply be gone.
4. **Layout is a contract risk.** Positions were placed by hand (`at`). Generated disassemblies need automatic layout: mechanisms left to right along `sends-to`, arguments bottom to top along `supports`. Without it, the exploded view becomes a pile of overlapping boxes.
5. **Text limits matter.** Joint labels fit when they are 2 lines of about 12 characters at most. Part names need 3 lines of 16, and long identifiers such as `frontend-image.json` must be breakable. A generation contract needs these as length rules.
6. **Reassembly can leak the answer.** Item balloons carry the part number, which matched the slot order. The prototype hides them during reassembly and shuffles the tray deterministically. The same care applies to any generated activity.
7. **Interpretation must be labelled.** Some load-test verdicts (Mill's sovereignty premise) and critiques (the "backward societies" exclusion) are readings of the source, not quotations. The contract carries `inference` and `critique` for this, and the page labels them as not coming from the source.
8. **Animation must never gate state.** Animation frames pause in background tabs, which left the exploded view assembled and the scenario stuck. Timers now drive state; animation is decoration.
9. **Icons.** The prototype uses free lucide names. The app has a closed list of 19. Typed parts need a slightly larger closed list (one per kind of part and joint), not an open set.
10. **Authoring cost.** Each disassembly is 130–190 lines of JSON. A model will need two phases: the bill of materials and the structure first, then the parts. This matches Q3 of [plan P-20261022-generation-quality](../plans/P-20261022-generation-quality/plan.md).

## Assumptions

- The public runbook is close enough to the owner's to test the mechanism case in the repository. The private TeamCity file is the real usage test.
- Mill's harm principle is a fair argument case: short, with an explicit premise the author rejects and an objection the author raises himself.
- A static page is good enough to judge interaction and style. Generation quality is out of scope here.

## Risks

| Risk | Response |
|---|---|
| The owner likes the hand-made version, but a model cannot produce it reliably | Plan generation in two phases and measure it with `npm run eval` before changing the player |
| Hand-placed layout hides the real difficulty | Make automatic layout an explicit task, with the three disassemblies as fixtures |
| Story joints never get tried | Add one short story case before the contract is fixed |
| Private material leaks | The TeamCity disassembly stays in `.local/`; the public index lists it as optional and private |

## Recommendation

Planning is **justified only after the owner has used the prototype** and answered Q1–Q5, Q5 above all. If the answers are positive, the next plan should cover, in order:
1. the `btw-disassembly` contract in `src/core`, with zod, host checks and the bill of materials, using the three files as fixtures;
2. two-phase generation (bill of materials and structure, then parts), measured on the evaluation set;
3. the player components: exploded view with automatic layout, run (scenario, load, case), reassembly, bill of materials;
4. a migration path from lessons to disassemblies, and the vocabulary change in the interface.

If the answers are negative on Q1 or Q5, revise the identity's interaction before touching the contract.

## Owner verdict

Given by the owner on 2026-10-24, after using the prototype:

| ? | Verdict | Owner's words, in short |
|---|---|---|
| Q1 exploded view | ✅ | "lo smontaggio è perfetto, è chiaro" |
| Q2 same components | ✅ | Interaction, running, and the prediction before running are "fantastica" |
| Q3 reassembly as proof | not stated | — |
| Q4 technical drawing | ✅ adopted | "voglio così": both themes are required, and blueprint is the owner's dark theme |
| Q5 would use it tomorrow | ✅ | On a real problem, or to analyze a repository |

### Change made after the verdict

The owner found the prose under a part hard to scan, and asked whether points with icons would read better, with a doubt about narrative sources.

**Decision:** top-level parts now carry `points`, a list of 2–4 short statements, instead of `explain`. Per-point icons were not adopted: on narrative or argumentative material they would be decoration with nothing to depict. Instead, a point may carry one of three **meaning marks**, which work for any subject:

| Mark | Meaning | Example |
|---|---|---|
| → `step` | a step or a consequence | "Scrive release.json con commit e digest." |
| = `keeps` | what stays unchanged | "Repliche, limiti, variabili e probe restano uguali." |
| ⚠ `caveat` | a warning | "Se basta questo, il confine scompare." (Mill) |

Unmarked points get a plain bullet. Screen readers hear the meaning ("poi", "resta uguale", "attenzione"), not the glyph. Sub-parts keep a single short sentence.

**Check:** a browser script opened all 48 part cards of the three disassemblies. No stray text such as "null" appeared, and the scan also caught and fixed an earlier bug where absent optional blocks printed "null".

### Open points from the verdict

- **Q3 has no answer.** Reassembly worked in the checks, but whether it feels like a proof is still open. Measure it on later use.
- **Repository analysis.** The owner wants to analyze repositories, but today's input is up to 4 text sources and 60,000 characters. The bill of materials scales by file: a whole file can be excluded with a reason, and each module becomes a sub-assembly. This needs a repository adapter, and generation large enough for it (Q3 of P-20261022), so it should appear in the next plan's scope, in a later phase.

## Recommendation after the verdict

Q1, Q2, Q4 and Q5 are positive, so **planning is justified**. The next plan should follow the order given in the recommendation above, plus:
- the two themes (paper and blueprint) as design tokens of the app;
- `points` with meaning marks in the contract;
- the repository adapter as a later phase.
