# Review: P-20261029-source-limits v1

Date: 2026-10-29. Reviewer: Claude (self-review against the research and the code at `0a7e588`).

| # | Finding | Resolution |
|---|---|---|
| 1 | The owner asked to remove the limit; the plan keeps a total. | Accepted with a reason stated in the research: the MCP route receives the source in the assistant's context several times, and a request must have some bound before it reaches any provider. The total rises from 60,000 to 120,000 and the per-source limit goes. |
| 2 | The stored source schema (`lesson.ts`, 100,000 characters) is a second, hidden limit. | Resolved: S1 raises it with the total, and its acceptance saves a 120,000-character disassembly. |
| 3 | Raising limits could invalidate stored files. | Not possible: limits only rise. S1 checks every stored fixture. |
| 4 | The local route could truncate silently above Ollama's window. | Resolved: S2 refuses before sending, with the existing `local-context` failure. |
| 5 | Removing the sources from the MCP runs step changes what the assistant sees. | Accepted as a residual risk: the app's checks still reject citations outside a source, and S3 runs a full session on Atlas and Mill. |
| 6 | ChatGPT's context window is not recorded. | Accepted as a residual risk, checked by S4.3 when that route is chosen. |
| 7 | One plan implements at a time. | Resolved: the precondition waits for P-20261029-source-entry to complete. |

No open findings. The plan can go to the owner for approval.

## Version 2

Date: 2026-10-30. Reviewer: Claude (self-review of the change in preconditions, against `feature/source-entry` at `7f05151`).

| # | Finding | Resolution |
|---|---|---|
| 1 | Version 1 starts from `main`, but this plan and the code it changes (`server.ts`, `assistant.ts`) exist only on `feature/source-entry`. A branch from `main` would miss both. | Resolved: version 2 starts from `feature/source-entry`. |
| 2 | Two plans cannot be active at once, and P-20261029-source-entry is still `implementing`. | Resolved: that plan moves to `blocked` with its reason recorded; it resumes for E10.3 and E10.4 after this one. |
| 3 | A pull request stacked on #36 merges in the wrong order if it is merged first. | Resolved: its base is `feature/source-entry`; #36 merges first, and the stacked request is retargeted to `main`. |
| 4 | E10.4 and S4.4 both ask for the owner's document. | Resolved: one trial with an empty question serves both, recorded in each plan. |
| 5 | The tasks are unchanged, but the approval of version 1 named a starting point that no longer holds. | Resolved: version 2 needs its own approval; the version 1 record stays as history. |

No open findings.
