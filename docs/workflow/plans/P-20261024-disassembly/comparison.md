# D9 — ChatGPT model comparison

Run `2026-10-26T13-52-06-228Z`, on 2026-10-26.
- **Route:** Sign in with ChatGPT, the owner's plan.
- **Cases:** the four public ones, two attempts per case and setup, setups interleaved within each case.
- **Report:** `.local/eval/runs/2026-10-26T13-52-06-228Z-chatgpt/`.

## Setups

The models were chosen from the account's list at run time. The account listed `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra` and `gpt-5.6-luna`, in that order.
- **Strong:** the first listed and newest, `gpt-6.1-sol`.
- **Cheap:** the smallest tier of the oldest family, by the account's naming, `gpt-5.6-luna`.

| Setup | Structure | Parts and runs |
|---|---|---|
| A | `gpt-6.1-sol` | `gpt-6.1-sol` |
| B | `gpt-5.6-luna` | `gpt-5.6-luna` |
| C | `gpt-6.1-sol` | `gpt-5.6-luna` |

## Validity

| Case | A | B | C |
|---|---|---|---|
| Atlas runbook (mechanism) | 1/2 | 0/2 | 0/2 |
| Mill (argument) | 2/2 | 2/2 | 1/2 |
| Kessmouth (story) | 2/2 | 2/2 | 2/2 |
| Core pipeline (code) | 1/2 | 0/2 | 2/2 |
| **Total** | **6/8** | **4/8** | **5/8** |

Every valid attempt had 0 forgotten lines, 0 layout findings and content in the requested language.

## Cost and time, valid attempts

| Setup | Median time | Median requests | Median characters sent | Median characters received | Requests, all attempts | Longest correct option |
|---|---|---|---|---|---|---|
| A | 232 s | 9 | 67k | 31k | 65 | 1.29× |
| B | 119 s | 8 | 46k | 21k | 69 | 1.51× |
| C | 253 s | 8 | 84k | 34k | 72 | 1.60× |

B is about twice as fast. C is not faster than A: the structure request takes the same time, and content repairs add requests.

## Why attempts failed

| Cause | A | B | C |
|---|---|---|---|
| A point over 130 characters after one repair (133–150) | — | 2 | 1 |
| A joint label over 24 characters after one repair (25) | 1 | — | — |
| The correct option 1.65–2.19× as long as the wrong ones | — | — | 2 |
| A malformed load test: a brick repeated, or the target used as its own brick | — | 2 | — |
| Service error (`unavailable`), not the model | 1 | — | — |

Most failures are near misses on length limits that a constrained decoder does not enforce. The schema sent to the model drops `maxLength`, and the zod check applies it afterwards.

## Taking a part apart (D14)

| Case | Part | Result |
|---|---|---|
| Core pipeline | `package-schema` | valid, 1 request, 68 s, now 3 levels deep |
| Mill | `sfera-libera` | valid, 1 request, 58 s |
| Kessmouth | — | not attempted: no part has 6 lines, as the rule intends |
| Atlas runbook | — | not attempted: setup C had no valid attempt to take apart |

## Against the acceptance of D9

- **Validity:** at least 6 of 8 valid. Only A meets it, at 6/8. One of A's failures was a service error, which the plan allows to be replaced. B (4/8) and C (5/8) miss it.
- **Forgotten lines, layout findings and language:** met by every valid attempt.
- **Claim review:** not done yet. It is the owner's blind review of the `*.review.md` sheets. Until it is done, no default setup is chosen, because the decision rule needs the wrong-point count.
- **Decision rule as written:** if only A meets the acceptance, A becomes the default. B and C missed on near-miss lengths, giveaway options and malformed load tests, not on forgotten lines.

## Budget

- Public generations: 24 of 28.
- Private generations: 1 of 2.
- Expansions: 2 of 4.

The runner's closing line counted all three together as "27 of 30"; it now reports them separately.

## Claim review and decision (2026-10-26)

The owner delegated the claim review to the agent ("Valuta tu la qualità, se capisci che è meglio con il setup A, procediamo con A"), and noted that a full benchmark can come later.
- **How it was done.** The review was **not blind**: the agent knew the setups. It was not the owner's 11-sheet review either. The agent read each part's points, sub-parts, joints and run explanations against the cited source lines:
  - for all three setups on Mill, the case where they all have valid attempts;
  - for A also on the Atlas runbook and on the core pipeline.

| Setup | Wrong claims found | Quality notes |
|---|---|---|
| A | 0 (Mill, runbook, core pipeline) | The most complete parts. On Mill it is the only setup that kept "abstract right" as a rejected brick, as the hand-made disassembly does. Inferences are labelled. On the code case, the limits and behaviours it states (12 and 20 issues, 80-line spans, `assessDraft` collecting rather than throwing) match the source |
| B | 0 on Mill | Coarser: 4 parts, with the utility ground merged and the rejected brick dropped. One load-test verdict ("falls") overstates a supporting part |
| C | 0 on Mill | The text written by the cheap model has defects: citation markers (`[1:14-26]`) left inside explanations, a Spanish word ("Confunde"), and a load test where all 6 bricks give "weakens", which teaches nothing |

- **Decision: setup A is the default.** It is the only setup that meets the validity bar, and the review found no wrong claim in it. This meets the lesson baseline of 0 wrong claims.
  - Studio already preselects the first model the account lists (`gpt-6.1-sol`) on every phase.
  - The owner's saved choice, `gpt-6-sol` from the lesson era, was changed to `gpt-6.1-sol` at the owner's request.
- **Residual risk.** One non-blind reviewer and a few cases give an indication, not a measurement. A blind benchmark can be repeated later with the same runner.
