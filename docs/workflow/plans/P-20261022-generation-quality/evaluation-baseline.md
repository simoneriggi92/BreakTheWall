# Q1 — Evaluation runner and local baseline

Date: 2026-10-22. Branch `feature/generation-eval`. Machine: M4 Pro, 48 GB.

## What was built

- **Command:** `npm run eval` (`scripts/eval.mjs`) bundles `eval/runner.ts` and runs it inside Electron, so the ChatGPT route can use the app's Keychain-backed session. Generated lessons stay in the report folder; the app's library is not touched.
- **Cases:** `eval/cases/*.json`, each with source snapshots under `eval/cases/sources/` (code snapshots end in `.ts.txt`, so they are data, not compiled).
  - `glucose`: original note, Italian.
  - `account-session`: one TypeScript file.
  - `core-pipeline`: four TypeScript files, 45k characters.
  - `release-runbook`: an original 177-line operational runbook in English, written for the set with no real names.
- **Private cases:** read only from the ignored `.local/eval/cases/`. The owner's TeamCity runbook is one of them.
- **Reports:** `.local/eval/runs/<time>-<route>/`, containing:
  - `attempts.jsonl` and `summary.json`;
  - the lesson of each valid attempt;
  - one claim-review sheet per case (`eval/review.ts`).
- **ChatGPT policy** (`eval/policy.ts`):
  - an explicit `--allow-chatgpt` flag is required;
  - at most 2 attempts per case;
  - the run stops at the first usage-limit response.

  The runner also stops when a local server is unreachable or the model is missing.

## Checks

| Check | Level | Result |
|---|---|---|
| `npm run check` | automated test | exit 0, 101 tests. New in `tests/eval.test.ts`: public cases load within import limits; public sources cannot point outside the public folder; private cases come only from `.local`, only when requested; duplicate ids are rejected; metrics and summary values; the ChatGPT cap; review-sheet rows |
| `npm run eval -- --help` and `--route chatgpt` without the flag | command run | usage printed; ChatGPT refused with the opt-in message |
| `.local/` ignored by git | static check | `git status --ignored` lists `.local/` as ignored |

## Baseline: local route

Route: Ollama 0.30.8 with Qwen3.6-35B-A3B Q4_K_M, the model chosen in the app. Draft: inline citations and activities, route shape in the schema (commit `8b4f5a2`). 3 attempts per case, run `2026-10-22T11-06-11-842Z`.

| Case | Valid | Repaired | Median s | Slowest s | Source coverage | Longest correct-answer ratio |
|---|---|---|---|---|---|---|
| account-session | 2/3 | 1 | 114 | 320 | 0.41 | 1.43 |
| core-pipeline | 1/3 | 3 | 305 | 318 | 0.07 | 1.05 |
| glucose | 2/3 | 2 | 246 | 310 | 0.74 | 2.00 |
| release-runbook | 0/3 | 3 | 298 | 322 | — | — |
| teamcity-frontend (private) | 0/3 | 3 | 317 | 331 | — | — |
| **Total** | **5/15** | 12 | | | | |

The earlier 3/3 on the owner's runbook was a small sample. Across more cases and attempts, the same draft is valid a third of the time.

### Why attempts failed

Every failed attempt ended with one to two findings after its repair pass, in three classes:

| Class | Count | Cause |
|---|---|---|
| Fewer than 3 representations | 5 | Every page used the same `main` type and no optional block was added. The rule comes from `assessDraft` |
| A citation longer than 80 lines | 4 | Mostly in the required `reconstruction`, which cites a whole process in one span |
| Empty `feedback` string | 2 | Constrained decoding does not enforce minimum length. The empty string fails zod parsing before optional blocks can be dropped, and once it hit the required prediction |

The first two classes come from rules this project added; the third is a gap between grammar and validation. None is a reference error: those did not appear.

### Claim review (first pass)

A first pass by Claude, on one valid lesson per case, to be confirmed by the owner. The sheets are in the local run folder.

| Case | Claims | ✅ | ⚠️ | ❌ | not verifiable |
|---|---|---|---|---|---|
| glucose | 22 | 20 | 2 | 0 | 0 |
| account-session | 25 | 21 | 2 | 0 | 2 |
| core-pipeline | 20 | 19 | 1 | 0 | 0 |

The imprecisions found:
- a claim cited next to the wrong lines;
- one comparison cell left empty when the claim applies to both sides;
- a relation verb that overstates the code ("chiude il vault");
- a distractor whose feedback half-agrees with it.

There were no outright false claims in these three lessons. They are also uneven in other ways: two reflections give reasons that are not in the cited lines, and `core-pipeline` covers 7% of its sources and omits `validateLesson`, which its goal asks about. Distractors were often trivially wrong ("rinnova ogni 24 ore"), which supports Q2.

## Q1 status

Q1's acceptance criteria are met at the stated levels:
- one command reproduces a run;
- private cases stay in `.local`;
- ChatGPT is opt-in, capped, and stops on the usage limit;
- a local baseline is recorded for every case, with three claim reviews.

The ChatGPT baseline is not recorded: plan usage was unavailable on 2026-10-22.

### Candidate fixes for the three failure classes

Each would be measured against this baseline:
- Express variety in the schema, or relax the rule to "at least two different `main` types".
- Accept several citations in the reconstruction, or raise its span limit.
- Treat empty strings in optional blocks as unusable additions, and reject them in required fields with a located finding.

These are outside Q2 and Q3 as approved, so adopting them needs the owner's go-ahead (a plan revision, or an explicit addition).

## Baseline: ChatGPT route

Recorded on 2026-10-22, when plan usage became available. The run uses the owner's own session through the app's data folder, with model `gpt-6-sol`, which the owner chose as the cheaper option. Public cases only: sending the private runbook to OpenAI needs the owner's separate decision. 2 attempts per case, the approved cap. Run `2026-10-22T12-35-26-043Z`.

| Case | Valid | Repaired | Median s | Slowest s | Source coverage | Longest correct-answer ratio |
|---|---|---|---|---|---|---|
| account-session | 2/2 | 0 | 106 | 107 | 0.69 | 1.35 |
| core-pipeline | 2/2 | 0 | 108 | 114 | 0.30 | 1.93 |
| glucose | 2/2 | 0 | 134 | 140 | 0.79 | 1.78 |
| release-runbook | 2/2 | 0 | 121 | 126 | 0.83 | 1.50 |
| **Total** | **8/8** | 0 | | | | |

An earlier run with `gpt-6.1-sol` was stopped by the owner after one attempt, which was valid in 166 s.

Compared with the local route on the same public cases:

| | Local (Qwen3.6 via Ollama) | ChatGPT (gpt-6-sol) |
|---|---|---|
| Valid | 5/12 | 8/8 |
| Needed a repair | 9/12 | 0/8 |
| Median time | ~250–300 s | ~110–135 s |
| Representation mix | often one `main` type repeated | map, sequence, comparison and lens in every lesson; reflections and excerpts in most |
| Source coverage | 0.07–0.74 | 0.30–0.83 |

What this shows:
- The three failure classes of the local baseline did not occur on the primary route.
- The documented Sign in with ChatGPT route accepted the strict JSON Schema (`text.format`), which T5 of the first plan had left open.
- Distractors remain a problem on both routes: on ChatGPT the correct answer was up to 1.93× longer than the wrong ones in `core-pipeline`, a giveaway that Q2 targets.

Claim review of the ChatGPT lessons has not been done yet.
