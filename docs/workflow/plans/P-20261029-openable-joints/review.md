# Review: P-20261029-openable-joints v1

Date: 2026-10-29. Reviewer: Claude (self-review against the two research documents and the code at `55eeaa1`).

| # | Finding | Resolution |
|---|---|---|
| 1 | The run variety research recommended one plan for joints and run primitives. | Resolved by the owner's decision: joints first ("Prima i giunti"). The run primitives are out of scope; J3 adds only the anchor they need. |
| 2 | A scenario that travels a whole chain, or a load test on a part, tests no single joint. Requiring every run to name one would force a false anchor. | Resolved: `joint` is optional; J6 names it only on the importer's scenario, the one run that tests one joint. |
| 3 | Joint labels were covered by plates in the source-entry integration check, and were fixed only by shortening them. | Resolved: J4 draws labels in a layer after the plates, which also puts joints after parts in the Tab order. |
| 4 | Content for joints inside sub-assemblies would need the content and expansion requests to change too. | Accepted as scope: their card shows the relation, label and lines without the two new fields. Stated under Scope. |
| 5 | Adding joint content to the runs request makes the largest answer larger. | Accepted as a residual risk, measured by J8.3; a version 2 moves it to its own request if repairs or truncation rise. |
| 6 | A joint that explains itself without citations would break the rule that every statement rests on the source. | Resolved: J2 makes `meaning` or `fails` without cites a finding. Joints without the new fields are unaffected, so stored files stay valid. |
| 7 | `docs/product.md` still lists typed joints as not built. | Resolved: J1 corrects it. |
| 8 | Only one plan implements at a time; source-entry is implementing and source-limits is approved and queued. | Resolved: the plan is `awaiting_approval`, which is not active; Preconditions leave the order to the owner. |
| 9 | The examples could carry private content. | Resolved: J6 uses only the three public examples; the owner's document is not mentioned in the plan. |

No open findings. The plan can go to the owner for approval.
