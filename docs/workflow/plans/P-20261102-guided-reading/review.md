# Review: P-20261102-guided-reading

## Version 1

Date: 2026-11-02. Reviewer: Claude (self-review against `main` at `b0d7113`, `origin/codex/guided-source-reading` at `98e9f0f`, research R-20261102-guided-reading and its prototype).

| # | Finding | Resolution |
|---|---|---|
| 1 | Codex's branch carries a plan that authorises itself and marks itself completed, outside this workflow. | Resolved: G1 cherry-picks its two code commits only, keeping their author, and leaves its plan, research and verification files out. Its branch is not deleted without the owner's confirmation. |
| 2 | Codex's branch conflicts with `main` in the player and its test. | Resolved: G1 resolves them toward the current workbench player and keeps Codex's tests as the check. |
| 3 | Codex's code opens a disassembly in the guided view the first time. This is a change of behaviour. | Accepted and stated in G3: a first opening starts in the guided view, and saved progress keeps its view. The owner named reading the core of the product. |
| 4 | The player already uses arrow keys on its pane splitters, and Escape or Alt+↑ to go up a level. | Resolved: G3 takes the arrow keys only where the focus is on the drawing or the passage. G4 reuses Escape and Alt+↑. Every action also has a button. |
| 5 | Reading marks on the sheet could collide with the run decorations (`states`, `flow`, `bricks`). | Resolved: G3 adds a separate reading decoration, used only in the guided view; G3's acceptance checks that Run behaves as before. |
| 6 | Joint citations are optional in the contract, so some joints have no passage. | Resolved: G2 relates such a joint at the passage where its later end is added, and the drawing shows it unmarked (Risks). |
| 7 | A route cut at 1,800 characters (Codex) gives different passages from the research table, which is cut at headings. | Resolved: G2's acceptance builds a route cut at headings to compare with the table, and checks the invariants on the real route. |
| 8 | Generated disassemblies rarely have sub-assemblies, so y often leads to a generation. | Accepted as a residual risk. y uses the existing expansion and never requests one by itself; the finding on generation stays outside this plan. |
| 9 | The object prototype could be read as product scope. | Resolved: shapes are excluded from the contract, generation and player. G7 stays under `prototypes/`, on public fixtures, and its README says what is drawn by hand. |
| 10 | Codex's prototypes run on the owner's private document. | Resolved: tests, examples and the prototype use public fixtures only (preconditions). |

No open findings. The plan can go to the owner for approval.
