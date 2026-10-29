# Review of P-20261029-ui-workbench v1

Date: 2026-10-29. Reviewer: the agent, before asking for approval.

| # | Finding | Resolution |
|---|---|---|
| 1 | Two plans would be implementing at once. | Resolved: the preconditions block P-20261024-disassembly on approval and resume it at completion, as for the earlier plans. |
| 2 | Codex's redesign weakened the source link, which belongs to the product identity. | Resolved: U4 puts explanation and source side by side again; its tests check that a citation never hides the explanation. |
| 3 | Codex's work was recorded in `docs/ui-workbench.md`, without a workflow plan. | Resolved: this plan adopts it as its starting point (U1) and links the record. |
| 4 | The Codex branch lacks the version commit on `main`. | Resolved: U1 starts from `origin/main` and merges `1f09169`. |
| 5 | Taking the origin out of the top bar could hide "Written by your assistant", which the MCP plan made visible. | Resolved: the origin moves to the overview, and U2's test checks it is there. |
| 6 | Hiding "Saved on this device" could leave screen-reader users without the save status. | Resolved: the status element keeps `role="status"` and only its visible text changes. |
| 7 | Two splitters in one column may be fiddly. | Accepted: sizes are kept per device and reset on double-click; U9's witnessed check decides, and a fixed share is the fallback. |
| 8 | Graph drawings such as Mill stay small. | Accepted: out of scope for the layout algorithm; U9 measures it, and a separate plan follows if needed. |
| 9 | The measurement script is not part of the repository. | Accepted: it is a diagnostic tool; its numbers are recorded in the plan as evidence, as in the research. |
| 10 | The main checkout is on `fix/release-draft-check`, someone else's open work. | Resolved: the plan files stay untracked until U1 creates `feature/ui-workbench`; that branch is left alone. |

No open findings.
