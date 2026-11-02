# Review: P-20261029-source-entry v1

Date: 2026-10-29. Reviewer: Claude (self-review against the research and the code at `13a1a19`).

| # | Finding | Resolution |
|---|---|---|
| 1 | The owner proposed the private document as the third prepared example; the repository is public. | Resolved: E8 is an original document; the private one is used only on the owner's device (E9 private case, E10.4). Stated under "Owner's decisions". |
| 2 | `goalSchema` is shared with lesson generation (`src/core/generation.ts`), which needs a question. | Resolved: E4 keeps lesson generation requiring one. |
| 3 | `exclusionReasonSchema` also covers excluded files, not only lines. | Resolved: E2 names excluded files among the places where `outside-question` is a finding without a question. |
| 4 | Without a question, `relevant: false` has no meaning, but the player draws closed sub-assemblies from it. | Resolved: E2 makes it a finding, E4 never asks for it; question-led disassemblies keep it. |
| 5 | The overview could become a generated summary, which `docs/product.md` excludes. | Resolved: E7 adds only `start` (one sentence) and sections computed from citations; no generated prose about the whole. Listed as a risk. |
| 6 | The prototype's tabs hid the source again. | Resolved: Scope excludes new modes or tabs; E7's acceptance keeps claim and source on screen together. |
| 7 | Generation quality without a question is unmeasured. | Accepted as a residual risk: E10.3–4 observe it; a version 2 would change instructions, not the contract. |
| 8 | E1's section name and E9's acceptance were imprecise in the first draft. | Resolved in v1 before approval. |

No open findings. The plan can go to the owner for approval.
