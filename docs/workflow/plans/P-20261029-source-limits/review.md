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
