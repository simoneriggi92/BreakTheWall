# Research: every level taken apart in advance

Date: 2026-11-02. Question: after trying the guided view, the owner wants "every level already taken apart and openable at once, without waiting". This research asks:
- how depth is produced today, and why generated disassemblies have none;
- what producing it in advance would cost, on each route;
- what a plan should change.

Presentation is out of scope here: plan [P-20261102-guided-reading](../plans/P-20261102-guided-reading/plan.md) version 3 covers the minimap, the x/y/z controls, fewer steps and transitions.

## Evidence

- `src/core/disassembly-generation.ts`:
  - the structure schema (`structureZod`, lines 30–52) and its instructions (`structureInstructions`, lines 104–131);
  - the expansion request (`expansionZod`, `expansionInstructions`, `buildExpansionInput`, lines 505–545).
- `src/core/disassembly.ts`: `DISASSEMBLY_LIMITS` (line 35), `divisible` (line 173), the sub-assembly checks (lines 340–350).
- `src/renderer/disassembly/DisassemblyPlayer.tsx` (`takeApart`) and `src/desktop/preload.ts` (`expandPart`): taking a part apart on request.
- [P-20261029-source-limits](../plans/P-20261029-source-limits/plan.md) S4.3–S4.4: four whole-source generations, through Claude via MCP, with token counts.
- The owner's report after G9–G10 (plan Progress, G8.3).

## How depth is produced today

```
structure request ──▶ top level (3–7 parts) + optional one level of sub-parts per part (schema: a sub-part has no parts)
                              │
                              └─ "Take a part apart only when … its inside is needed …; a deeper level can be asked for later."
later, on request ──▶ expansion: one request per part, with only that part's lines ──▶ 3–7 sub-parts, any depth
```

- **One request can give at most two levels.** In the structure schema a sub-part has no `parts`.
- **The instructions discourage depth.** A part is taken apart only "when its inside is needed to see how the whole works", and "a deeper level can be asked for later". Without a question the model kept every part closed in all four whole-source runs: 0 sub-assemblies out of 7, 6, 7 and 7 parts, on sources of 90,096 and 49,357 characters.
- **Expansion exists, but only on request.**
  - It covers generated disassemblies, through ChatGPT or a local model.
  - The MCP assistant has no expansion step: a disassembly written by Claude can only be taken apart further through one of the app's own routes.
  - The learner waits for each part, one request at a time.
- **Limits.**
  - Each level holds 3–7 parts (`minParts`, `maxParts`).
  - A part can be taken apart only if it cites at least 6 non-blank lines (`minLinesToSplit`).
  - Each level accounts for its parent's lines, as the whole does for the source.

## Options

| Option | What changes | Cost | Risk |
|---|---|---|---|
| **A. Ask for depth in the structure** | the instructions ask for sub-parts for every part above a size (for example 40 lines), instead of "only when needed" | no extra request; a longer structure answer (two levels in one JSON) | one request must get two levels and their bill of materials right; more repairs; still at most two levels |
| **B. An expansion pass after generation** | after the runs, the app expands every part above a size, one request each, then their parts if still large, up to a depth limit | one request per expanded part (with only its lines: the whole source once more in all, split up), plus repairs; the learner waits once, at generation | time and usage grow with depth; a failed part must leave the rest usable |
| **C. The same pass in the MCP assistant** | the assistant session gets an expansion step per part (a tool like `submit_parts`), checked as the app checks expansions | on the owner's Claude plan; the assistant reads each part's lines again (pages already exist) | longer sessions; the S4.3 runs already took 18–19 turns |
| **D. Prepare in the background** | after opening, the app expands parts while the learner reads | the same as B, but spent only for disassemblies that are opened | "without waiting" holds only for parts already done; it spends usage without a click |

## Recommendation

Planning is justified, after one measurement.

1. **Measure first, on the evaluation set** (public cases and the owner's private case):
   - what B costs: requests, input and output tokens, time and repairs, to depth 2 and to depth 3;
   - how good the sub-parts are, judged by the eval's existing checks (bill of materials, forgotten lines, joints) and by the owner on one document.
2. **Then plan B and C together.**
   - B covers the app's routes and C the MCP route, so a disassembly from either route has its levels.
   - Both reuse the expansion contract, which the app already checks.
   - Add A's change of wording only if the measurement shows that the structure request alone gives usable sub-parts more cheaply.
3. **Keep on-request expansion** for what the pass leaves closed, such as parts under the size threshold, or a depth limit reached.
4. **Settle with the owner:** the size threshold, the depth limit, and whether the pass runs always or as a choice in Studio with its cost shown, as every generation now does.

## Assumptions

- The four runs are all through Claude via MCP. ChatGPT and local models may produce sub-assemblies differently under the same instructions; the measurement covers that route.
- "Every level" is read as "every part large enough to have an inside", down to a depth limit. A part of 6 lines has no useful inside.
- The owner's document stays on the owner's device; its measurement is run there, as S4.4 was.

## Risks

- **Cost and time grow with depth.** At depth 3, a 7-part disassembly can need 7 + up to 49 expansions. A depth limit of 2, plus a size threshold, keeps it near 7.
- **Quality.** Sub-parts made from a part's lines alone may repeat the parent's points or cut sentences in odd places. The eval and the owner's judgement decide.
- **One failure must not lose the rest.** An expansion that fails after its repairs leaves its part closed, with "take apart" still offered, as today.
