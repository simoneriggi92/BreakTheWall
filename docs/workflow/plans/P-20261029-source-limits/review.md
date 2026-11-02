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

## Version 3

Date: 2026-10-30. Reviewer: Claude (self-review of S5 against `src/mcp/assistant.ts` and `src/mcp/server.ts` at `a26d76f`, and the S4.3 transcript).

| # | Finding | Resolution |
|---|---|---|
| 1 | The first reply of a 90,096-character source was 103,993 characters; Claude Code wrote it to a file, and the model wrote the structure from headings. | Resolved by S5: every reply stays within 60,000 characters, with the source in pages of at most 45,000. |
| 2 | The limit of each assistant app is not documented in the repository and not measured; Claude Desktop's is unknown. | Accepted as a residual risk, stated under Risks. The page size leaves room under the documented default of Claude Code; S4.3 is repeated in Claude Code. |
| 3 | A model may submit the structure without reading every page. | Resolved in part: `submit_structure` is refused until every page was read, without counting an attempt. Reading is not using; the app's checks on citations and the bill of materials remain the backstop. |
| 4 | A part's own lines can also exceed a page (a part may cite most of a long source). | Resolved: such a part request names the pages instead of sending the lines. |
| 5 | Sources that fit in one page must not change behaviour. | Resolved: the acceptance keeps the Atlas and Mill sessions, and their replies differ only by the line naming page 1 of 1. |
| 6 | Repeating S4.3 spends the owner's usage again. | Resolved: the repeat waits for the owner's confirmation of route and cost, as the plan requires for every generation. |
| 7 | S1–S3 were implemented under version 2. | Resolved: version 3 keeps their text, acceptance and evidence; the approval of version 2 stays as history, superseded. |

No open findings.

## Version 4

Date: 2026-11-02. Reviewer: Claude (self-review of S6 against `src/mcp/assistant.ts` at `032e346` and the transcript of S4.3 repeated).

| # | Finding | Resolution |
|---|---|---|
| 1 | S5 assumed a limit of 60,000 characters. Claude Code wrote the 56,040-character first reply to a file, and the model reached page 1 only because `claude -p` let it use Read. | Resolved by S6: every reply stays within 40,000 characters, under the 44,921 that passed. |
| 2 | A fixed page size cannot fit the first reply, because its instructions and schema take about 11,200 characters and the question and title vary. | Resolved: page 1 gets what the first reply leaves. S6's acceptance includes a 400-character question and a 120-character title. |
| 3 | A `read_source` reply adds a page line and the pages still to read to the page. | Resolved: later pages hold at most 38,000 characters, and the acceptance checks each reply, not only each page. |
| 4 | Part and runs replies could pass 40,000. | Checked: in S4.3 the largest part reply was 21,789 characters and the runs reply 12,421. A part above the limit names its pages (S5). The runs reply carries no source, so with many long parts it could grow; S6's acceptance checks every reply of the 120,000-character session. |
| 5 | The limit is measured once, in one version of Claude Code, and may count tokens. | Accepted as a residual risk, stated under Risks. |
| 6 | One more S4.3 spends the owner's usage again (about $1.70 last time). | Resolved: it waits for the owner's confirmation of route and cost. |
| 7 | S5 is implemented under version 3 and its acceptance names 60,000. | Resolved: S5's text and evidence stay as history, and S6 sets the new sizes. Version 4 needs its own approval. |

No open findings.
