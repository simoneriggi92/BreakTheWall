---
id: P-20261022-generation-quality
title: Measured generation quality - evaluation set, structural distractors, two-phase pipeline
version: 2
state: superseded
current_task: Q1b
last_evidence: Q1 complete - npm run eval, 4 public + 1 private case, 101 tests; local baseline 5/15 valid in three failure classes; first-pass claim review 0 false claims in 3 lessons
next_action: None - superseded by P-20261024-disassembly v2
approval: superseded
---

# Generation quality

## Outcome

Every change to generation (prompt, draft schema, pipeline, model) is measured on the same inputs before it is adopted. Predictions test a real misconception instead of offering trivially wrong options. A two-phase pipeline (plan → write page by page) is built behind a setting and adopted for a route only where the measurements support it. That pipeline is the prerequisite for sources larger than one request.

The owner decided on 2026-10-22 to prioritize correctness with large models. ChatGPT is the primary route; capable local models are secondary, with Qwen3.6-35B-A3B on a 32 GB+ Mac as the reference. Nothing in this plan optimizes for 8–14B models.

## Evidence and current state

See [research R-20261022-generation-quality](../../research/R-20261022-generation-quality.md), the [local inference trial](../../research/R-20261022-local-inference.md) and the [generation verification](../P-20261021-first-learning-loop/generation-verification.md).

- Generation is one request: `src/desktop/generator.ts`. Local results get one repair, and a repair regenerates the whole draft.
- The draft contract is in `src/core/generation.ts`. Citations and activities are inline, and the route shape is enforced by the schema. The stored format is in `src/core/lesson.ts`.
- On the owner's 340-line runbook with Ollama + Qwen3.6, the current draft produced 3/3 valid lessons with one claim error. Distractors were easy and comparisons repetitive.
- All measurements so far came from ad hoc scripts outside the repository. ChatGPT has not been measured.

## Scope and choices

- An evaluation runner inside the repository, driving the app's own generator, with public and private cases.
- A claim-review record kept per lesson.
- A `misconception` field per wrong choice option, in the draft and as an optional field of stored lessons, shown to learners after a wrong answer.
- Distractor heuristics as repairable findings.
- A two-phase pipeline behind a setting, with progress for each phase and repair per page.
- (v2) Fixes for the three failure classes found by the Q1 baseline, each measured against that baseline.

Not included:
- folder, vault or repository import (next plan, gated by Q3's results);
- content-anchored citations;
- LLM-as-judge scoring;
- optimizing for small models;
- learner studies, which belong to T7 of the first plan.

Assumptions taken where the research left questions open; the owner can change them before approval:
- The owner's TeamCity runbook is a **private** case, kept only in `.local/eval/`.
- ChatGPT runs are opt-in per invocation, capped at 2 attempts per case by default.
- The owner reviews claims; a second reader is optional.

## Ordered tasks

### Phase evaluation

#### Q1 — Evaluation runner, cases and baseline

- Purpose: replace ad hoc trials with a repeatable measurement.
- Action:
  - Add a development command that runs the app's `Generator` on named cases, for a chosen route, model and number of attempts.
  - Cases come from a committed public set and from an optional `.local/eval/` folder. Each case is a goal plus sources.
  - Write one JSON line per attempt to `.local/eval/`: case, route, model, validity, repair, timings, output size, page and representation mix, how widely citations cover the source, and distractor heuristics once Q2 exists.
  - Add an original operational runbook to the public cases, comparable in length and shape to the owner's.
  - Provide a claim-review template (correct / imprecise / wrong per claim) stored next to the generated lesson.
- Acceptance:
  - One command reproduces a run.
  - Private cases never enter the repository: they are read only from the ignored folder and their outputs are written there.
  - ChatGPT runs require an explicit flag, stop on `usage-limit`, and report it.
  - A baseline exists for the local route: 3 attempts per public case, plus the private runbook if present.
- Evidence: runner tests with a fake completer; the recorded baseline; claim reviews for one lesson per case.
- Dependencies: none in this plan.

### Phase calibration

#### Q1b — Remove the three baseline failure classes

- Purpose: raise the valid rate of the **local route** where the [baseline](evaluation-baseline.md) failed on this project's own rules or on a gap between grammar and validation, without accepting worse lessons. Every one of the 10 failed local attempts ended in these classes, and none was a reference error. ChatGPT (gpt-6-sol) produced 8/8 valid lessons without repair, so these changes must not alter what the primary route already gets right: the ChatGPT cases are rerun too, within the cap.
- Action:
  - **Variety.** Replace "at least 3 representations" with a rule that a repair can reliably satisfy: besides the opening map, the route uses at least one other explanation type (sequence, comparison or lens). Report how many pages repeat the previous page's `main` type as a metric, not as a rejection. The instructions keep asking for variety.
  - **Long citations.** Raise the per-citation limit from 80 to 120 lines. Keep the instruction to prefer several short citations, and allow up to 6 citations per block as today. Excerpts are never shortened or moved by the host.
  - **Empty strings.** Draft text fields accept empty strings at parse time, so a single empty field no longer fails the whole draft before assembly. An empty field in an optional addition makes that addition unusable, and it is left out. An empty field in a required part becomes a finding located by page and field, so the repair pass can fix it.
- Acceptance:
  - The Q1 set is rerun on the same local route, with 3 attempts per case and the private case included.
  - The local valid rate is higher than the baseline's 5/15, and ChatGPT stays at full validity on the public cases (2 attempts each).
  - A claim review of one lesson per case shows no more wrong claims than the baseline (0 in three lessons).
  - Each change is listed with the failures it removed.
- Evidence: contract tests for each rule; the rerun report; claim reviews.
- Dependencies: Q1.

### Phase distractors

#### Q2 — Structural distractors

- Purpose: make predictions test a real misconception.
- Action:
  - Each draft choice option gets `misconception: string | null`. It is required exactly for wrong options, and its feedback must refute it with the cited lines.
  - Stored lessons accept an optional `misconception` per option, an additive change; prepared fixtures and saved lessons remain valid.
  - After a wrong answer, the player shows "Errore tipico" with the misconception.
  - Add repairable findings: a correct option much longer than the wrong ones (threshold set from the Q1 baseline); absolute words ("solo", "mai", "sempre") in wrong options that the cited lines do not contain.
- Acceptance:
  - Drafts violating the rules produce located findings.
  - Existing lessons load unchanged.
  - The Q1 set shows no drop in valid rate, and a reviewed sample shows distractors that name plausible errors.
- Evidence: contract and interaction tests; before/after Q1 numbers; a reviewed sample of predictions.
- Dependencies: Q1, Q1b. Q2 is measured against the Q1b rerun, so that its effect is not mixed with the calibration.

### Phase pipeline

#### Q3 — Two-phase generation behind a setting

- Purpose: localized repair and smaller context per request, as the path to larger sources.
- Action:
  - Add a plan request returning title, map nodes, and per page its purpose, the type of `main` and its relevant line ranges. The host validates it: ranges exist, every page has ranges, the map is coherent.
  - Then send one writing request per page, carrying the goal, the plan and only that page's ranges.
  - Assemble with the existing contract. A failing page gets one repair of that page only.
  - Progress shows "Piano" and "Tappa k di n". Cancellation and failure keep earlier lessons intact, as today.
  - Expose the pipeline as a per-route setting, default off.
- Acceptance:
  - Measured on the Q1 set against the single-request baseline: valid rate, claim errors, time and number of requests.
  - Adopt the pipeline as the default for a route only if its valid rate and claim errors are no worse and its time is acceptable to the owner. Record the decision and the numbers either way.
  - For ChatGPT, the number of requests per lesson is shown to the learner before generating.
- Evidence: contract tests for plan validation and page assembly; Q1 comparison runs; one witnessed desktop generation with the pipeline on.
- Dependencies: Q1; Q2 is recommended first so that both comparisons share one baseline.

## Definition of done

- Q1, Q1b, Q2 and Q3 meet their acceptance criteria.
- The pipeline decision is recorded with numbers.
- Documentation states which route uses which pipeline, and why.
- No claim is made about learning effectiveness, about small models, or about sources larger than those measured.

## Risks and concrete responses

| Risk | Response |
|---|---|
| Private documents leak into the public repository through the evaluation set. | Private cases and outputs live only in `.local/` (already ignored). The runner never writes private material elsewhere. |
| Manual claim review is slow or subjective. | Use a short rubric, and record the reviewer and date. Review one lesson per case per change, not every attempt. |
| ChatGPT usage limits block measurement of the primary route. | Opt-in runs with a cap; stop and report on `usage-limit`; measure the local route meanwhile. |
| The pipeline multiplies requests and time. | It stays behind a setting; adoption follows the measured decision rule; the request count is shown before ChatGPT runs. |
| A wrong plan propagates to every page. | The host validates the plan before any page is written; a failing plan stops early with a located finding. |
| Distractor heuristics reject good options. | Thresholds come from the baseline; findings are repairable, never silent rewrites. |

## Verification strategy

- **Discovered commands:** `npm run check`, `npm run build`, and the evaluation command added in Q1.
- **Test layers:**
  - contract tests for the draft rules, plan validation and assembly;
  - interaction tests for "Errore tipico" and the phase progress;
  - evaluation runs for quality numbers;
  - a witnessed desktop flow for the pipeline.
- **Limits:** evaluation numbers on a small set are indications, not proof of general quality.

## Review and authorization

Self-review is in [review.md](review.md). Version 2 adds Q1b at the owner's request, after the Q1 baseline. Q1's completed work and evidence are unchanged.

**Activation constraint:** only one plan may be active for implementation. [P-20261021-first-learning-loop](../P-20261021-first-learning-loop/plan.md) is `implementing`. Before this plan is approved, it must leave the active states: `blocked` while T5 waits for ChatGPT plan usage, or `completed`. The owner decides which.

Approval command for this version:

`Approve P-20261022-generation-quality v2`

A later, separate implementation command starts edits, for example:

`implement P-20261022-generation-quality v2 --phase calibration`

Named phases: `evaluation` (Q1), `calibration` (Q1b), `distractors` (Q2), `pipeline` (Q3). Approval does not authorize ChatGPT runs beyond the stated cap, model downloads, dependency changes, publication, or importing private documents into the repository.

## Approval record

Version 2: pending.

Version 1, approved and implemented through Q1; kept as history:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261022-generation-quality v1`, in the same message that set P-20261021-first-learning-loop to `blocked`.
- Approved plan/version: `P-20261022-generation-quality` / `1`.
- Recorded at: `2026-10-22T12:58:04+02:00` (Europe/Rome).
- Approved scope: Q1–Q3 and their acceptance criteria, the `evaluation`, `distractors` and `pipeline` phases, the stated assumptions and exclusions.
- Approved-content SHA-256: `fe17ca0ff12e2d731a03463f2bf3cf11a36a1c2cd3bda2bb7aa5f37faef5d992`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Generation quality` up to, and not including, `## Review and authorization`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. ChatGPT runs beyond the stated cap, model downloads, dependency changes, publication and importing private documents into the repository remain separately protected.

## Execution

Authorized command: `implement P-20261022-generation-quality v1 --phase evaluation`.

- Q1: complete. See the [evaluation baseline](evaluation-baseline.md): the runner, cases, ChatGPT policy, a local baseline of 5/15 valid lessons, three failure classes, and a first-pass claim review. The ChatGPT baseline waits for plan usage.
- Q2, Q3: not started.
- Version 2 adds Q1b, requested by the owner after the baseline: "aggiungi al piano (v2) le correzioni per le tre classi di errore, misurate contro la baseline, prima di Q2".

## Superseded

On 2026-10-25 the owner superseded this plan, in the same message that approved [P-20261024-disassembly v2](../P-20261024-disassembly/plan.md): `Approve P-20261024-disassembly v2 and supersede P-20261022-generation-quality`.

- Q1 (evaluation runner, cases, baselines) is complete and kept as infrastructure. P-20261024 D9 adapts it to disassemblies.
- Q1b and Q2 were never approved or started. They tuned the lesson draft that P-20261024 replaces.
- Q3 (two-phase generation) is absorbed by P-20261024 D9.

Version 2 of this plan was never approved.
