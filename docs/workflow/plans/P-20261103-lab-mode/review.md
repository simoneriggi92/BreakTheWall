# Review: P-20261103-lab-mode

## Version 1

Date: 2026-11-03. Reviewer: Claude. A self-review against:
- `feature/guided-reading` at `eedd18b`, with G9–G17 uncommitted;
- research R-20261103-lab-mode;
- `prototypes/lab-representation`.

| # | Finding | Resolution |
|---|---|---|
| 1 | P-20261102-guided-reading v4 is still `implementing`, with G8.3 open, and only one plan may be active for implementation. | Resolved as a precondition. v4 is closed before L1: G8.3 is recorded, its work is committed on the owner's request, and its state becomes `superseded` for G10 and G17. This plan can await approval meanwhile; it cannot be implemented. |
| 2 | The prototype's library texts are Italian strings inside `metaphor.js`, but the app is bilingual. | Resolved: L1 returns stable ids for components, connections and failures; L11 translates them in `en.ts` and `it.ts`, and `i18n.test` covers them. |
| 3 | Bench components are keyed by `icon`, which generation chooses, so the decision depends on the model's icon. | Accepted as a residual risk (Risks). The research measured its effect: 6 of 11 private disassemblies became atlases through unmapped icons. L13.3 records the missing components. |
| 4 | The prototype also tests a frame for arguments, which the app would have to draw if an argument passed. | Resolved by scope. The library holds the bench only in this version, so an argument is always an atlas, which is the cautious default. The frame enters with its own task. |
| 5 | The app opens levels at any depth; the prototype's lift showed only one. | Resolved in L9: the strip always shows the level the opened part belongs to, and the minimap and the path show the way up. |
| 6 | Parts without a sub-assembly offer "take apart" in the guided view today. Replacing the drawing could drop it. | Resolved: L8's acceptance keeps it. |
| 7 | Context annotations and the margin (z) both read the excluded lines. | Resolved: L11 reuses the margin data. |
| 8 | The object/plates switch is a stored device preference, and removing it could break an old setting. | Resolved: an old value is ignored (preconditions). The overview keeps the plates, and the loss of choice is stated under Risks. |
| 9 | FLIP motion cannot be measured in the test environment (jsdom has no layout or `animate`). | Accepted. L9's tests check state and classes: the strip, the outlined place, the return. The motion itself is checked in integration (L13.2), and under "reduce motion" it does not run. |
| 10 | The rule-made bench measured 1,250 units wide for the importer, which makes text small at 1280×800. | Resolved: L3 folds long flows into a second band and bounds the width-to-depth ratio, with a test on every public fixture. |
| 11 | `GuidedReading.tsx` would grow past maintainability if the drawing went into it. | Resolved: the drawing lives in `src/renderer/lab/`, and the view keeps the orchestration (Risks). |

No open findings. The plan can go to the owner for approval, after the preconditions.

### Version 1, revised before approval

After the owner tried `prototypes/lab-representation` (2026-11-03).

| # | Finding | Resolution |
|---|---|---|
| 12 | In Mill's atlas, the drawing said "Perde il sostegno" while the card said "Crolla" and the question spoke of making the claim fall. The weight metaphor came back through the run's texts, which is the very risk the atlas was chosen to avoid. The app's Run has the same wording for every source ("Togli un mattone", "CROLLA", "Portanti"). | Resolved by L12. In an atlas the run suspends a support, asks which justifications stay explicit, and answers from the `supports` joints. The disassembly's own explanation comes apart, with its opening verdict sentence left out and inferences marked, and a note separates the result from the conclusion's truth. The prototype now behaves this way. |
| 13 | The atlas verdict said "Nessun oggetto regge senza inventare", which claims more than the test can show: it compares only the library's metaphors. | Resolved in L11: the verdict reads "Tra le metafore disponibili, nessuna rappresenta questa fonte senza forzature". The prototype is changed. |
| 14 | The fixtures' and generation's run explanations are written for the weight metaphor. | Accepted as a residual risk (Risks): L12 leaves out an opening verdict sentence; changing generation is outside this plan. |

No open findings.
