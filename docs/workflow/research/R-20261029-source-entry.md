# Research: understanding a source without a question, and joints the learner can open

Date: 2026-10-29. Question: today a disassembly starts from the learner's question. The owner decided on 2026-10-29 that the default entry is to understand the whole source, with no question required; a question stays as an optional focus. What does the question control today, what would change, and what does a joint need before the learner can open it and put it under load?

## Evidence

- **Codex's analysis** of 2026-10-29 (local file, outside this repository: `~/.codex/visualizations/2026/10/27/01a17c8a-5d20-7b21-a720-ed3e8ac0e23f/reports/2026-10-29-breakthewall-analisi-core.md`). It records the owner's decision and proposes four lines of work: the entry without a question, a loop around one joint, help at the point of difficulty, and contesting the AI's reading.
- **Codex's prototype** (local static page, outside this repository, served on port 5190 from `~/.codex/visualizations/2026/10/27/01a17c8a-5d20-7b21-a720-ed3e8ac0e23f/core-prototype`). It was tried on 2026-10-29 at 1440×900. It is built on a private working document of the owner. This research describes only its behaviour; its content, names and screenshots stay out of the repository.
- **Repository code** at `27a4764` (branch `feature/ui-workbench`); `src/core` is unchanged from `main` for everything cited here.

## What the prototype shows

- **Five modes**: Understand the source, Explore, Put to the test, Reassemble, Bill of materials.
- **Understand the source** opens on a plate of 6 groups, each mapped to a range of the document's sections (for example "§ 0–2 · 3 sections"), with a lead per group. Beside it, a panel answers "What does this source say?" with the thesis, three questions the document answers, a cited line range, and a suggested starting point. A question field is present and marked optional. A counter says "0 of 17 sections opened · opening ≠ understanding".
- **Explore** switches to a second plate: the mechanism, as 7 parts with typed, labelled joints. A joint can be selected. Its card shows the two parts, the relation, its meaning in two sentences, a cited line range, and help buttons ("the concept", "the step", "an example", "the limit"), plus "write it in your own words" and "this step does not convince me".
- **Put to the test** loads one joint: a starting state with instruments, a choice of three starting situations, a prediction with three options, and a run that reveals the result. It says that the numbers are illustrative and that no real system is run.
- **Reassemble** asks for the meaning of one relation between two parts (three options), an optional explanation in the learner's words ("not evaluated by an AI model"), a comparison with a reference, and a variant to reason about.
- The right-hand panel has five tabs in every mode: Link, Source, Understand, Test, Reassemble.

## What the question controls today

The question is required and reaches every layer. The chain runs from the place where it is typed to the place where it changes the content.

| Layer | Where | What the question does |
|---|---|---|
| Contract | [`src/core/disassembly.ts:97`](../../../src/core/disassembly.ts) | `question: text` is required in every stored disassembly |
| Contract | [`src/core/disassembly.ts:28`](../../../src/core/disassembly.ts), `:37` | `outside-question` is an exclusion reason for the bill of materials and for a part's own lines |
| Check | [`src/core/disassembly.ts:364`](../../../src/core/disassembly.ts) | the question's detected language must match the content language |
| Goal | [`src/core/source.ts:81`](../../../src/core/source.ts) | `goalSchema.outcome` needs 10–400 characters; it becomes `question` in [`compose`](../../../src/core/disassembly-generation.ts) (line 371) |
| Generation | [`STRUCTURE_INSTRUCTIONS`](../../../src/core/disassembly-generation.ts) (lines 95–117) | "an exploded view of the whole that answers the question"; take a part apart "only when the question needs its inside"; `relevant: false` for a sub-assembly "the question does not need" |
| Generation | `header` (line 141), `buildExpansionInput` (line 481) | every request, including a later expansion, starts with `QUESTION:` |
| Language | `defaultContentLanguage` (line 440) | the content language follows the question when the learner has not chosen one |
| Suggestions | `SUGGEST_INSTRUCTIONS` (line 541) | "the learner has chosen the sources but not yet the question": the app proposes 3–5 questions |
| Studio | [`src/renderer/Studio.tsx:85`](../../../src/renderer/Studio.tsx), `:122` | step 3 (generation) is disabled until the question is valid |
| Draft | [`src/desktop/generation-draft.ts:15`](../../../src/desktop/generation-draft.ts) | an interrupted generation resumes only with the same question |
| Desktop | [`src/desktop/generator.ts:127`](../../../src/desktop/generator.ts) | a question in another language stops generation before any request |
| MCP | [`src/mcp/server.ts:119`](../../../src/mcp/server.ts), [`src/mcp/assistant.ts:33`](../../../src/mcp/assistant.ts) | `start_disassembly` requires `question` (10–400 characters); `open_in_break_the_wall` already treats it as optional |
| Player and library | [`DisassemblyPlayer.tsx:227`](../../../src/renderer/disassembly/DisassemblyPlayer.tsx), [`Library.tsx:107`](../../../src/renderer/Library.tsx) | the question is shown under the title |
| Product | [`docs/product.md`](../../product.md) lines 105, 152, 215 | "the learner's question decides what opens"; step 1 of the loop is the question; "analysis of a whole repository without a question" is outside the first alpha |

Fifteen test files mention the question or the goal, among them `disassembly.test.ts`, `disassembly-generation.test.ts`, `studio.test.tsx`, `mcp-server.test.ts`, `mcp-assistant.test.ts`, `generation-draft.test.ts` and `eval.test.ts`.

The prepared examples are all question-led: Atlas (English and Italian) asks how to release to staging and roll back, and uses `outside-question` once; Mill asks when society may coerce an individual, and does not use it.

## What a joint is today

- **No identity.** `jointSchema` is `{ from, to, type, label, cites? }` ([`disassembly.ts:42`](../../../src/core/disassembly.ts)). The check forbids a joint from a part to itself and a second joint in the same direction between the same parts ("Duplicate joint"); a joint each way between two parts is allowed. (Corrected on 2026-10-29: the first version of this research said no duplicate check existed.) The stored state can select a part (`selected`), not a joint ([`disassembly-state.ts:11`](../../../src/core/disassembly-state.ts)).
- **Little content.** A label (at most `short`) and optional citations. In Atlas 6 of 12 joints cite lines; in Mill 3 of 5. No joint explains what it carries, why it exists, or when it fails.
- **Not interactive.** [`JointPath`](../../../src/renderer/disassembly/Sheet.tsx) (line 31) draws a `<g>` with no role, focus or click handler. The joints reach the learner only as words in the part card ("sends to …", [`PartCard.tsx:76`](../../../src/renderer/disassembly/PartCard.tsx)).
- **Already used by runs.** A scenario step's `flow` must follow existing joints (`disassembly.ts:317`), so a run already travels along joints. A `load` run targets a part (removing a brick), not a joint. Reassembly slots accept parts only, and [`checkReassembly`](../../../src/core/disassembly-state.ts) (line 167) compares positions.

The product definition already puts the joint at the centre: "Run. The learner puts a joint under load" ([`product.md:21`](../../product.md)).

## Findings

1. **The decision changes the product definition, not only the code.** `docs/product.md` says the question decides what opens and lists a whole-source analysis outside the first alpha. The owner's decision of 2026-10-29 reverses both. The plan must update `product.md` first; otherwise every later check is judged against the old identity.
2. **The gap is smaller than a new mode.** The top level of a disassembly is already the structure of the whole: 3–7 parts, typed joints, and a bill of materials that accounts for every line. Expansion already opens deeper levels on request. Without a question, three things change: the instructions ask for the whole source instead of an answer; `outside-question` is not allowed (nothing can be outside a question nobody asked); and `relevant: false` has no meaning, so every sub-assembly starts closed and opens on request.
3. **Orientation can mostly come from what exists.** `whole` already carries `name`, `does`, `why` and `cites`. Two things are missing: a suggested starting part (with a reason), and how the source is organised. The organisation can be computed by the app, with no model: the Markdown headings are already parsed for the reader's outline (`SourceDocument.tsx:67`), and every part cites lines, so the app can show which sections each part covers and which are excluded. That gives the prototype's "sections → groups" view as a property of the bill of materials, not as a second plate.
4. **The prototype has two decompositions of one source.** Its first plate groups the document's sections; its second shows the mechanism's parts. An outline is not an exploded view, and two plates leave the learner unsure which one is the structure. Finding 3 keeps one plate.
5. **The prototype brings the tabs back.** Its right panel hides the source behind a tab in every mode. Plan P-20261029-ui-workbench removed exactly that (tasks U4–U6) after the owner called the visible source a regression of the most important feature. Any plan from this research keeps claim and source on screen together.
6. **Joints need an identity before they need a screen.** Selection, notes, a joint-targeted run and a reassembly slot all need to refer to a joint. The check already makes the ordered pair `(from, to)` unique within its level, so that pair can serve as the identity; an explicit `id` is the alternative.
7. **A joint card needs content the contract does not hold.** The prototype's card shows what the relation means and cites it. The contract has a label and, in half the cases, citations. Two optional fields would cover it: a sentence on what the joint carries or why it holds, and a condition under which it fails. Their citations follow the same rules as parts.
8. **Joint tests can reuse runs.** The prototype's "Put to the test" is a scenario or a case focused on one joint. The existing run types can carry that: a `load` that cuts a joint instead of removing a part, or a scenario whose steps travel one joint. A separate test system per joint would duplicate Run.
9. **Two risks to the product's boundary.** The panel "What does this source say?" is close to a summary, and the help buttons ("the concept", "the step", "an example") are close to a tutor chat. `AGENTS.md` and `product.md` exclude both. They stay inside the identity only if the orientation is short, cited and leads into the drawing, and if the help is prepared content in the contract, not free generation in a conversation.
10. **Language without a question.** The content language follows the question today. Without one, it follows the learner's choice, then the sources' detected language, then the interface.

## Assumptions

- Stored disassemblies stay readable: a schema that makes `question` optional still accepts every existing file, so `schemaVersion` stays 1. This holds only if no new required field is added.
- A whole-source request costs about what a question-led one costs: the structure request already sends every source in full. The content and runs phases may grow, because fewer lines are excluded. Not measured.
- The 3–7 parts per level are enough for a long document because deeper levels open on request. Not measured on a document of several hundred lines.
- Prepared content comes first, as the analysis recommends: the interaction is judged on hand-checked fixtures before generation is asked to match them.

## Risks

- **Generation quality.** The evaluation set (`eval/`, research R-20261022-generation-quality) is question-led. Whole-source generation needs its own cases before any model is trusted with it.
- **Scope.** The analysis holds four lines of work; each is a plan. Contesting the AI's reading and help at the point of difficulty depend on the first two and on a test with real people.
- **Privacy.** The prototype's document is private. Fixtures for this work must be original or suitably licensed (`AGENTS.md`, publication boundary).
- **Effectiveness is a hypothesis.** Neither the analysis nor the prototype measured understanding. A plan can check that the interaction works; whether it helps needs observation of people on their own documents.

## Owner's answers (2026-10-29)

1. **Where the optional question lives:** before generation, in Studio. A question added later means a new generation.
2. **Two plans in sequence:** first the entry without a question, then openable joints. Help at the point of difficulty and contesting the AI's reading come only after a test with real people.
3. **Prepared examples:** add a third, whole-source example, and keep Atlas and Mill as the question-led path. The owner suggested the document the prototype is built on. That document is private (internal code, names and infrastructure), so it cannot be a prepared example in this public repository. It fits the existing private routes instead: the ignored `.local/eval/cases` folder (`eval/cases.ts`, `PRIVATE_CASES`) and the learner's own library, where a disassembly generated on the device stays on the device. The public example is an original document on the same kind of subject.

## Recommendation

Planning is justified. The owner's decision is recorded, the current behaviour is traced from Studio and MCP to the stored file, and the change fits the existing contract without a new mode.

Suggested order:
1. **Source-first entry** (plan 1): update `product.md`; make `question` optional; forbid `outside-question` and `relevant: false` without a question; add a suggested starting part; show the section coverage computed from headings and citations; Studio and `start_disassembly` without a required question; prepared whole-source fixtures; evaluation cases. Claim and source stay together on screen.
2. **Openable joints** (plan 2): joint identity and its check; optional joint content with citations; a focusable, selectable joint in the drawing with its card beside the source; one run that targets a joint, reusing the existing run types.
3. Later, only after a test with people: help at the point of difficulty and contesting the reading.
