# Foundation plan review

Plan: [P-20261021-first-learning-loop v1](plan.md). Date: 2026-10-21.

Review type: author self-review and static document validation. No independent reviewer, application build, UI test, provider integration, or learner study was performed.

## Findings resolved before requesting approval

| Finding | Resolution |
|---|---|
| The implementation phase selector must match the named phases. | Headers and selectors use `player`, `generation`, and `alpha-verification`. Ordered tasks T1–T7 have explicit dependencies. |
| General-subject support must be verifiable rather than a slogan. | T2 allows non-code source locators; T3 and T6 require both code and non-code lessons with a shared renderer. |
| The source-discovery vision could be mistaken for an implemented alpha feature. | Product, architecture, README, and plan explicitly separate the first text-source loop from later AI-assisted discovery. |
| A prepared lesson or valid schema could be mistaken for successful AI generation or factual correctness. | T3 labels prepared fixtures; T5/T6 require real inference; T6/T7 retain semantic source review as a separate check. |
| Sign-in could be implemented through copied credentials or plain workspace files. | T5 and the architecture require supported sign-in, OS-protected credential storage, and no import from another app. |

## Checks

- Relative Markdown file links resolve.
- No trailing whitespace was found.
- Required plan front matter, ordered tasks, phase identifiers, and pending approval are consistent.
- The workflow status generator runs successfully. It reports no active implementation plan because this proposal is not approved; the plan and README provide the pending-review entry point.
- The authored files contain product/workflow documentation only. Private prototype source snapshots, application code, credentials, dependencies, CI, commits, and publication are outside this setup result.

## Remaining planned uncertainties

Dependency versions and actual commands are established in T1. Account eligibility, generation behavior, and recovery are verified in T5/T6. Visual quality and generalization need witnessed flows and learner observations. License selection remains an owner decision before an open-source release. None of these future checks is claimed as passed by this review.

No unresolved document-blocking finding remains. This is a proposal ready for owner review, not approval or implementation.

## Subsequent approval event

The project owner approved plan v1 with `Approve P-20261021-first-learning-loop v1`. The approval record, time, and scope digest are in the plan. The earlier checks above describe the pre-approval review; generated status now reports the plan as approved and T1 as the next task. No implementation or publication was performed by this approval action.

## Version 2 self-review

Date: 2026-10-22. Change: T5b adds a local-model route chosen in the app. The digest of the v2 plan body is computed at approval, not here. Review type: author self-review. No independent reviewer, and no implementation of T5b.

| Finding | Resolution |
|---|---|
| Adding a provider is a material change to v1's "one provider adapter" scope. | The version is now 2. Approval is pending, and v1's record is kept as history. |
| A runtime can accept a schema and ignore it. The trial observed this with Ollama 0.30.8 for both tested models. | T5b requires an enforcement probe before generation and an explicit UI state. Validation still applies to every result. |
| Sources sent to a local server must stay on the device. | Addresses are limited to loopback hosts, and sending starts only after the learner selects a model. Servers on other machines are excluded. |
| A local lesson could be mistaken for a ChatGPT lesson, or treated as equally reliable. | Provider, runtime and model are recorded and shown. Claim review is required for T5b as for T6. |
| T6 previously depended on T5 alone, while T5 is blocked by plan usage. | T6 now depends on T5 or T5b and records which route produced each lesson. The definition of done is unchanged: one real code lesson and one real non-code lesson. |
| A repair pass changes the architecture's "one bounded request" starting point. | It is justified by observed structural failures, limited to one pass, and applied only to local results, so it costs no ChatGPT usage. |

Residual risks accepted for owner review:

- **Simplicity depends on the runtime.** With the owner's current setup (Ollama 0.30.8 and the trialled models), the probe is expected to report that the format is not enforced. LM Studio's enforcement is unverified. llama.cpp server enforces the schema through `/completion`, as the trial showed, but it is a command-line tool. The guidance must say which setup works, based on what the implementation verifies.
- **Local model quality is lower.** Even Qwen3.6, the stronger trialled model, made factual slips that validation cannot catch.
- **Product documentation needs updating.** `docs/product.md` and `docs/architecture.md` still describe ChatGPT as the only access route. They are updated during implementation, not by this review.

Checks: the plan's relative links resolve. Phase identifiers, task dependencies and the approval command match. The status generator runs.
