# Review of P-20261028-mcp-integration v1

Date: 2026-10-28. Reviewer: the agent, before asking for approval.

| # | Finding | Resolution |
|---|---|---|
| 1 | Two plans would be implementing at once. | Resolved: the preconditions block P-20261024-disassembly on approval and resume it at completion, as for the macOS and Windows plans. |
| 2 | Does an assistant writing the disassembly drift towards a chatbot, which the product identity rules out? | Resolved: the output is the same disassembly, checked by the same functions, and the learner still runs and reassembles it in the app; level A only hands over a text. Expansion and suggestions stay in the app. |
| 3 | Level B changes the privacy promise: the source goes to Anthropic. | Resolved: the learner's own Claude app sends it, not Break the Wall; the panel (M4) and the README (M8) say so before and after connecting. |
| 4 | A local socket is a new way into the app. | Resolved in part: off by default, same-user only (0600 / per-user pipe), size-limited lines, and everything imported or validated as a paste or a stored file would be. Accepted residual: any process of the same user can use it while it is on, which gives no power beyond writing the data folder directly. |
| 5 | Adding `assistant` to `generation.provider` changes the stored format. | Resolved for this version: the change is additive and existing files stay valid (M5 tests). Accepted residual: an older app version skips disassemblies written by an assistant. |
| 6 | The level B session lives in the server process; if the assistant conversation ends half-way, the work is lost. | Accepted: no draft for level B in this plan; the learner can start again or use level A. |
| 7 | `ELECTRON_RUN_AS_NODE` depends on Electron's default fuses, and the Windows path changes with each version. | Accepted as residual risks, stated in the plan; Claude Desktop's `.mcpb` does not depend on either. |
| 8 | The `.mcpb` manifest format may have moved since the research. | Resolved: M4 checks it against Anthropic's documentation at implementation time; M9 witnesses the install. |
| 9 | The witnessed level B checks spend the owner's Claude usage. | Resolved: stated in the preconditions; the research's runs cost under $0.25 each for phase 1, and M9 records the cost of full runs. |
| 10 | The working tree holds untracked duplicates named `* 2.ts` / `* 2.tsx` (copies made by file sync), unrelated to this plan. | Resolved: implementation stages files by name and never adds them; whether to delete them is the owner's call. |
| 11 | The CI check the ruleset requires could change name. | Resolved: no job is renamed; the new tests run inside the existing jobs. |

No open findings.

# Review of P-20261028-mcp-integration v2

Date: 2026-10-28. Reviewer: the agent, before asking for approval again.

| # | Finding | Resolution |
|---|---|---|
| 1 | Version 1 excluded MCP prompts; adding one changes the scope. | Resolved: version 2, a new approval; M4a sits in phase `server`, which is not committed yet, so it ships with M3–M4. |
| 2 | The owner wants `/break`, but MCP prompts are named by the client, not the server. | Resolved: M4a states the expected names, checks them at implementation and witnesses them in M9; the short `/break` is the owner's personal Claude Code command, kept outside the repository. |
| 3 | A prompt that tells the model to write an explanation could produce a text over the source limits. | Resolved: the prompt states the limits, and the tool's refusals already tell the model how to shorten; tested in M3. |
| 4 | A prompt without a topic must not invent one. | Resolved: with no topic it sends the last long answer unchanged; tested in M4a. |

No open findings.
