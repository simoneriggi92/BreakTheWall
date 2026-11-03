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

## Version 2

Date: 2026-11-02. Reviewer: Claude (self-review after the owner's first look at G3–G6 on `feature/guided-reading` at `eedd18b`, against `prototypes/guided-reading`).

| # | Finding | Resolution |
|---|---|---|
| 1 | Version 1 named the prototype as evidence but never as the reference for the app's layout. G3's acceptance checked that things were "visible", not where they were. The result kept Codex's text-first layout. | Resolved: G9 makes the prototype the reference. Its acceptance names the regions, requires the drawing to be the largest, and forbids a second copy of the passage. |
| 2 | Version 1 kept shapes out of the product because they seemed to need the contract and generation. | Resolved: G10 derives shapes from `icon` and `kind`, which every part already has. A test checks that every icon (37) and every kind (12) is in the table; all 37 icons occur in the fixtures. |
| 3 | A shape suggests a function more strongly than an icon, and the model chose the icon. | Accepted as a residual risk, stated under Risks. Shapes stay general, only joints are drawn as relations, and plain plates are one switch away. |
| 4 | The overview's layout was made for flat plates; on an isometric board parts may crowd. | Accepted, to be fixed in G10's projection if it happens. The core layout keeps its tests. |
| 5 | Suspending a premise works in the prototype and the owner may expect it in the app. | Out of scope, stated: it is a run, and runs are outside this plan. |
| 6 | G4, G5 and G6 were verified on the old structure. | Resolved: G9's acceptance reruns their tests on the new structure, and G8 is repeated after G9 and G10. |
| 7 | Version 1 is approved and partly implemented. | Resolved: version 2 needs its own approval. Phases route, player and object keep their evidence. The version 1 record stays as history. |

No open findings.

## Version 3

Date: 2026-11-02. Reviewer: Claude (self-review after the owner's second look, against `feature/guided-reading` with G9–G10 uncommitted, Codex's object prototype on port 5188 and `prototypes/guided-reading`).

| # | Finding | Resolution |
|---|---|---|
| 1 | Codex's prototype always shows where the learner is; the app's guided view does not. | Resolved by G11: a minimap with "You are here" and the path. Its acceptance checks that it never covers a part. |
| 2 | x, y and z exist only as keys; the HTML prototype showed them as controls. | Resolved by G12: labelled controls with their keys in the tooltips, disabled where they do not apply. |
| 3 | The owner's document gives 61 entries in the route. | Resolved by G13: a step starts only where the drawing changes, so the steps are at most 1 + parts + joints. Measured on the public fixtures: 14 → 9, 5 → 4, 15 → 10. The owner's document should give about 16 or fewer with 7 parts. |
| 4 | Every level taken apart in advance changes generation, its cost and its checks. | Out of this plan: research R-20261102-depth-in-advance recommends measuring an expansion pass first, then a plan covering the app's routes and the MCP assistant. |
| 5 | Transitions can be decoration. | Resolved by G14: each motion says one thing (taken apart, back, added, related, returned to), lasts 300–500 ms, never blocks a click, and stops under "reduce motion", checked by test. |
| 6 | Grouping passages changes Codex's route and the saved position. | Resolved: the position stays a line, so older progress finds its step. G13's acceptance keeps G2's invariants on steps. |
| 7 | Version 2 is approved and partly verified. | Resolved: version 3 needs its own approval; phases layout and drawing keep their evidence. |

No open findings.

## Version 4

Date: 2026-11-02. Reviewer: Claude (self-review after the owner's third look, against `feature/guided-reading` with G9–G14 uncommitted).

| # | Finding | Resolution |
|---|---|---|
| 1 | ↓ opens and ↑ does nothing: an asymmetry introduced in G12. | Resolved by G15, with a test that ↑ still scrolls in the source band. |
| 2 | The route's heading says "Contents" and its marks have no legend. | Resolved by G16: "Reading steps" and an always-visible legend in both languages. |
| 3 | Steps cut from one long section, or from a source without headings (Mill), repeat the same name. | Resolved by G16: such a step is named by its first words, checked on Mill. |
| 4 | The guided view opens only one level below the whole, held in `open` as a single id; the stack needs any depth. | Resolved by G17: the open path is a list of ids, and `deepDisassembly(5)` checks four levels. |
| 5 | Stacking levels makes the sheet taller than the drawing area. | Accepted: the sheet scrolls, the level in focus comes into view, and the minimap keeps the whole present. |
| 6 | G14's backdrop and its test describe the replaced behaviour. | Resolved: G17 states the replacement, and G14's backdrop test is rewritten for the stack. The other G14 motions stay. |
| 7 | Generated disassemblies seldom have a second level, so the stack may look empty on the owner's documents. | Accepted as a residual risk (Risks). It is tied to research R-20261102-depth-in-advance; the prepared examples and "take apart" show it now. |

No open findings.
