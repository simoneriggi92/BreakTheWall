# Generation quality: evaluation set, distractors, staged pipeline

Date: 2026-10-22. Scope: research for a follow-up plan. No source, configuration or dependency is changed by this note.

## Owner decision

**Prioritize correctness with large models.**
- ChatGPT is the primary route.
- Capable local models are the secondary route; Qwen3.6-35B-A3B on a 32 GB+ Mac is the current reference.
- No optimization for 8–14B models now. Revisit when the evaluation set shows that a smaller model holds up.

**Rationale.** The product's value is a correct explanation. In the [local inference trial](R-20261022-local-inference.md), LFM2.5-24B-A2B (≈2B active parameters) failed structurally. Qwen3.6 makes factual slips that validation cannot catch. A smaller model would teach wrong things more often.

## Current flow (evidence)

```
Studio "Genera" → StudioBridge.generate → IPC generation:start → Generator.generate
  → Completer.complete (one request; local route: + one repair)
  → assembleLesson: parse draft → flattenDraft → cite/ids/answers → assessDraft → validateLesson
  → LessonStore.save
```

| Step | Where | Notes |
|---|---|---|
| Request | `src/desktop/generator.ts` | One completion. One repair is added for local results only. The whole draft is regenerated on repair: about 1–2 minutes locally |
| Draft contract | `src/core/generation.ts` (`draftZod`, `flattenDraft`, `assembleLesson`, `assessDraft`) | The route shape is enforced by the schema: opening map with prediction, `main` per page, final reconstruction. Citations are inline and sources are a closed list |
| Quality checks | `assessDraft` | Map present; at least 3 representations; at least one activity; every page explains something; language of the goal |
| Stored format | `src/core/lesson.ts` | Unchanged by the draft work |
| Tests | `tests/generation.test.ts` (14), `tests/local.test.ts` (14), `tests/provider.test.ts` (14), `tests/studio.test.tsx` (14) | Structural and interaction checks with fixed drafts; no quality measurement |

## Evidence so far

| Source | Route | Result |
|---|---|---|
| Original glucose note (45 lines) | llama.cpp + Qwen3.6 | Valid; 2 claim errors |
| `account.ts` (130 lines) | llama.cpp + Qwen3.6 | Valid; 3 claim errors, including a wrong sign-out order in an activity |
| Owner's TeamCity runbook (340 lines) | Ollama + Qwen3.6 | Earlier drafts: 2/5 valid, both thin. Current draft: 3/3 valid, 1 claim error; distractors easy, comparisons repetitive |
| Same cases | ChatGPT | Not run: plan usage unavailable |

All of these runs were ad hoc scripts in a scratch directory with 3–5 attempts each, and claim review was manual. Without a repeatable set they cannot show whether a change helps; that is the main gap.

## 1. Repeatable evaluation set

**Purpose:** measure every generation change (prompt, schema, pipeline, model) on the same inputs.

**Cases:**
- **Public, committable:** original or repository-owned sources only, because the repository is public.
  - the glucose note, original;
  - `src/desktop/chatgpt/account.ts`;
  - four `src/core` files;
  - an **original** operational runbook of comparable length and shape to the owner's, written for the set.
- **Private, local only:** owner-supplied documents such as the TeamCity runbook. They contain internal service and host names, so they live under the ignored `.local/eval/` and never in commits.

**Runner:** a development command that drives the app's own `Generator` against a chosen route, the way the trial scripts did.
- **Output:** one JSON line per attempt in `.local/eval/`.
- **Spending:** ChatGPT runs spend the owner's plan, so they must be explicit and bounded.

**Metrics:**

| Metric | How | Automatic? |
|---|---|---|
| Valid rate, repair rate | the generator's result per attempt | yes |
| Time (median and slowest), output size | wall clock and characters | yes |
| Structure: pages, representation mix, activities, citation spread over the source | from the assembled lesson | yes |
| Distractor heuristics (below) | from activities | yes |
| Claim errors per lesson | a short review against the cited lines, recorded per lesson | no: owner or reviewer |
| First-attempt solve rate | learner attempts | no: needs learners (T7 and later) |

An LLM judge for claim errors is possible later, but it would be another model checking a model: treat it as a hint, never as the metric.

## 2. Distractors

**Observed:** some wrong options were trivially wrong ("Deploy immediato senza test"), so a prediction did not test anything.

**Structural proposal**, in the same spirit as `correct`:
- **Field:** each option gets `misconception: string | null`. It must be non-null exactly for the wrong options, and it names the plausible reasoning error the option represents. The existing `feedback` must then refute that error with a citation.
- **Interface:** the feedback for a wrong answer can show "Errore tipico: …".
- **Heuristics:**
  - the correct option must not be much longer than the wrong ones, a classic cue (for example more than 1.6× the mean distractor length);
  - options must not contain absolute giveaways ("solo", "mai", "sempre") unless the source says so.

These checks are repairable findings, not silent fixes. The stored format would need an optional `misconception` per option: an additive schema change, and existing lessons stay valid.

## 3. Two-phase pipeline

**Proposal:**
- **Plan request:** title, pages with purpose, the type of `main`, and the relevant line ranges per page, plus the map nodes.
- **Validation:** the host validates the plan (ranges exist, every page has ranges, the map is coherent).
- **Writing requests:** one per page, each carrying the goal, the plan and only that page's ranges.
- **Assembly:** as today.

| | Single request (today) | Two phases |
|---|---|---|
| Requests per lesson | 1 (+1 local repair) | 1 + pages (4–7) |
| Repair scope | the whole lesson | one page |
| Context per writing request | all sources | the page's ranges |
| ChatGPT plan usage | lowest | several times higher |
| Local time | 3–5 min on the runbook | unknown; to measure |
| Error propagation | none between parts | a wrong plan spreads to every page |
| Sources beyond 60k characters | impossible | possible once the plan step selects ranges |

**Assessment:**
- **Not justified yet on reliability grounds.** The current draft reaches 3/3 on the runbook, and the remaining problems are about content quality.
- **Justified as the path to larger sources.** A folder or Markdown vault, and later a repository, cannot fit one request; a selection step is needed there.
- **Recommended mode split:** two phases first for large sources and the local route. Single request stays the default for ChatGPT on small sources, to save plan usage. Decide with evaluation numbers, not by assumption.

## Related items, deferred

- **Content-anchored citations:** each lesson stores its own copy of the source and its hash, so editing the original file cannot shift existing citations. Anchoring citations to content is needed for regeneration after source edits and for live repositories; design it with the repository adapter.
- **Folder/vault import:** a bounded selection of `.md` files from a chosen folder, with no background crawl. It is close to the current T4 boundaries and depends on the plan step above for large selections.

## Risks

- **Unvalidated metrics:** manual claim review is slow and subjective. Use a short rubric (correct / imprecise / wrong per claim), and record the reviewer and date.
- **Private material:** private documents could leak into the public repository through the evaluation set. Keep them in `.local/` (ignored) and add a pre-commit check if the set grows.
- **ChatGPT usage limits:** these can block measurement of the primary route, as they blocked T5. The runner must stop on `usage-limit` and report it.

## Recommendation

**Planning is justified** for a small follow-up plan, after or alongside the current plan's T5 and T7:
1. Evaluation runner and public cases, with private cases kept local. Record a baseline on the current draft for the local route; record ChatGPT when usage allows.
2. Structural distractors: `misconception` per wrong option, plus the length heuristic. Measure against the baseline.
3. A two-phase pipeline prototype behind a flag, measured on the same set. Adopt it per route only if the numbers support it.
4. Folder/vault import, only after step 3 shows that the plan step selects relevant ranges reliably.

**Open questions for the owner:**
- Should the evaluation set include the TeamCity runbook as a private case?
- How many ChatGPT attempts per change is the plan's usage worth?
- Who reviews claims: the owner alone, or also a second reader?
