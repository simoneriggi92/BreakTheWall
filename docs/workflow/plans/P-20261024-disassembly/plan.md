---
id: P-20261024-disassembly
title: Disassemblies replace lessons - contract, player, two-phase generation, technical-drawing themes
version: 2
state: approved
current_task: D1
last_evidence: Research R-20261025-repository-and-document - a repository and a PDF chapter disassembled in the lab, 0 forgotten lines, 23 sheets without layout findings; 15 findings for contract, layout and adapters
next_action: Send a separate implement command, for example implement P-20261024-disassembly v2 --phase contract
approval: approved
---

# Disassemblies

## Outcome

The app produces and plays **disassemblies** instead of lessons, as defined in the [product identity](../../../product.md#identity):
- a source is taken apart into 3–7 parts per level, with sub-assemblies and typed joints;
- the learner runs a part (a scenario, a load test or a new case) and can reassemble the whole;
- a bill of materials accounts for every source line, and the app checks it;
- the whole app uses the technical-drawing style, with a paper theme and a blueprint theme.

Generation produces disassemblies in two phases. ChatGPT is the primary route and capable local models the secondary one, per the owner's decision of 2026-10-22.

Lessons already saved stay readable. Nothing the learner has today is lost.

The owner requires the tool to analyze **code repositories and documents** as well as short text sources. Both arrive as gated phases after two-phase generation, because neither fits in one request.

## Evidence and current state

- [Research R-20261024-lab-prototype](../../research/R-20261024-lab-prototype.md):
  - the hand-made prototype in [`prototypes/lab/`](../../../../prototypes/lab/README.md);
  - the candidate contract `btw-disassembly/0.1`;
  - ten builder observations;
  - the owner's verdict: positive on the exploded view, on running, on the style and on daily use. Reassembly as proof has not been judged.
- [Research R-20261025-repository-and-document](../../research/R-20261025-repository-and-document.md):
  - two private cases disassembled in the lab: a .NET repository (16 files across three projects) and a 22-page PDF chapter;
  - 0 forgotten lines, 23 sheets without layout findings after one fix;
  - 15 findings, including: secrets found by content and not by file name, dead code surfaced by the bill of materials, an extractor that silently dropped ligatures, running headers caught as a forgotten line, and arguments whose supports weaken rather than fall.
- [Product definition](../../../product.md): the identity, the three kinds of joint, sub-assemblies and the bill of materials, the adopted visual direction, and the mapping from lesson to disassembly.
- Current code (static inspection):

| Area | Where | Today |
|---|---|---|
| Stored format | `src/core/lesson.ts` | `lessonSchema` v1: sources with full text and sha256; evidence quotes; pages of blocks (`map`, `sequence`, `comparison`, `lens`, `source`, `reflection`); `choice`/`order` activities; 19 icon names |
| Learner state | `src/core/state.ts`, `src/desktop/progress-store.ts` | Per lesson id + revision; a revision change preserves old progress and restarts |
| Generation | `src/core/generation.ts`, `src/desktop/generator.ts` | One request, one repair for local results only, `assessDraft` quality rules |
| Storage | `src/desktop/lesson-store.ts` | Atomic writes; invalid files counted and skipped, never shown |
| Interface | `src/renderer/App.tsx`, `Library.tsx`, `Studio.tsx`, `blocks.tsx`, `StudyTools.tsx`, `styles.css`, `clarity.css` | Lesson player and library; green-accent palette with a dark variant |
| Prepared content | `src/fixtures/lessons.ts` | Two prepared lessons |
| Evaluation | `eval/`, `npm run eval` | Measures lessons. Baselines: ChatGPT gpt-6-sol 8/8 valid, local 5/15 |
| Tests | `tests/*.test.ts(x)` | 101 tests: contracts, generation, providers, studio and player interactions |

## Scope and choices

- **A new stored format.** `src/core/disassembly.ts` holds `disassemblySchema` v1, derived from the prototype's 0.1 contract, with host checks that return findings located by path.
- **Automatic layout.** A pure, deterministic layout in `src/core` replaces the prototype's hand-placed grid positions.
- **The player.** Exploded view, part card with marked points, source pane, run (scenario, load test, new case), reassembly, and bill-of-materials view. All of it is in Italian, with the vocabulary from the product definition.
- **Themes for the whole app.** Paper and blueprint replace the current palette. The default follows the system setting: light gives paper, dark gives blueprint. An explicit choice is saved in the settings.
- **Two-phase generation:**
  - first a structure request (parts, joints, bill of materials), validated by the app;
  - then one content request per top-level part;
  - then one request for runs and reassembly hints.

  The structure phase can be repaired once on both routes. Content and runs can be repaired per part.
- **Prepared examples.** The two public prototype disassemblies become fixtures: the Atlas Reader runbook and Mill's harm principle. Mill's text is in the public domain.
- **Lessons become legacy.** Saved generated lessons stay readable in a "Percorsi precedenti" section, with their progress. They are not converted. New generation produces only disassemblies.
- **Two later phases, for repositories and for PDF documents.** Both are gated on the generation results. Both produce a scoped snapshot that the contract records, and a file- or page-level bill of materials.

Not included:
- the parts store across disassemblies, recognition of a part met in another disassembly, opt-in review;
- AI-assisted web discovery, packaging or signing;
- document formats other than PDF (Word, EPUB, HTML), scanned PDFs needing OCR, and understanding figures (they are listed as excluded);
- conversion of old lessons into disassemblies;
- LLM-as-judge scoring, optimization for small models, learner studies.

### Relation to other plans: owner decisions needed before approval

1. **[P-20261022-generation-quality](../P-20261022-generation-quality/plan.md) v2** (awaiting approval):
   - Q1, the evaluation runner, is complete and reused here.
   - Q1b and Q2 tune the lesson draft that this plan replaces.
   - Q3, the two-phase pipeline, is absorbed by D9.

   **Proposal:** move that plan to `superseded`, with a link to this one, in the same message that approves this plan. If the owner prefers to keep it, it must not be approved while this plan is active: the workflow allows one active plan.
2. **[P-20261021-first-learning-loop](../P-20261021-first-learning-loop/plan.md)** is `blocked` on T5, a witnessed in-app ChatGPT generation and restart check. D10 produces that evidence for disassemblies. **Proposal:** once D10 passes, the owner decides whether P-20261021 is `completed` with T5 met by D10, or `superseded`. This plan does not change its state.

### Assumptions (the owner can change them before approval)

- Default theme: follow the system. Explicit choice: `system`, `paper` or `blueprint`.
- The two prepared lessons are removed from the library and replaced by the two public disassemblies. Their code stays until legacy support is dropped in a later plan.
- A short **original story-kind case**, a sequence of decisions with causes, is written as a contract fixture and evaluation case. It is not shown as a prepared example unless the owner asks.
- ChatGPT evaluation keeps the opt-in flag and the 2-attempts-per-case cap.

## Ordered tasks

### Phase contract

#### D1 — Disassembly contract and host checks

- Purpose: one validated format that the player, the store and generation share.
- Action:
  - Add `disassemblySchema` v1:
    - metadata as in lessons: id, revision, kind, generation, title, question, language;
    - sources with full text and sha256;
    - `whole`.
  - Recursive `parts`, depth ≤ 3, 3–7 per level. Each part has:
    - a closed `kind`: step, component, artifact, premise, conclusion, ground, limit, objection, consequence, rejected, event, actor;
    - a closed `icon` list, about 30 names mapped to lucide, one per kind of part and joint;
    - `role`;
    - `points`, 2–4 for top-level parts, each with an optional mark (`step`, `keeps`, `caveat`), or a one-sentence `explain` for sub-parts;
    - optional `metaphor` with its limit, `lens`, `critique`, `relevant`;
    - citations.
  - `joints` with typed relations in three families:
    - mechanism: sends-to, causes, depends-on;
    - argument: supports, attacks, limits;
    - story: leads-to, because.
  - `bom.excluded`, each entry with a reason: context, outside-question, repetition, detail, secrets, generated. `bom.excludedFiles` for whole files or groups, with the same reasons.
  - `scope`: what was analyzed. For a repository: root, commit, and modified files. For a document: title and page range.
  - Sources may carry `pages`, a map of page to first line, so citations name pages.
  - `runs`: scenario, load or case, with an `inference` flag. A load test brick has `verdict: falls | weakens | holds` (finding 12 of R-20261025).
  - `reassemble` with slots and hints. A slot's `accepts` is one part or a set of interchangeable parts (finding 14).
  - Add `validateDisassembly`, with findings located by path, e.g. `parts[2].parts[0].cites[1]`. It checks:
    - citations inside their source, with the quote copied by the app;
    - unique ids;
    - joints within one level;
    - run references to existing parts and joints;
    - scenario states from a closed vocabulary;
    - load-test bricks and targets on the top level;
    - reassembly slots that each accept one distinct top-level part;
    - length rules from the prototype: joint label ≤ 24 characters, part name ≤ 48, point ≤ 130;
    - language of the question (`detectLanguage`);
    - the bill of materials: every non-blank source line in a part, the whole or a joint, or excluded with a reason.
  - Convert the two public prototype files and the three private ones (TeamCity, the repository case, the document case) to v1. Write the story-kind case.
- Acceptance:
  - The public fixtures and the story case validate. The private files are checked in local-only tests that are skipped when the files are absent.
  - A load test with a `weakens` verdict, a slot set, a page-cited source and a file-level exclusion each validate, and each malformed variant produces a located finding.
  - Each rule has a contract test that produces a located finding.
  - The bill-of-materials check reports forgotten ranges as `from–to` per source.
- Evidence: `tests/disassembly.test.ts`; the fixture list.
- Dependencies: none.

#### D2 — Automatic layout

- Purpose: generated disassemblies have no hand-placed positions (observation 4 of the research).
- Action:
  - Add a pure layout module in `src/core`. It is deterministic and has no DOM:
    - mechanism joints flow left to right in layers along `sends-to` and `causes`, and back edges (such as rollback → deploy) are drawn as returns;
    - arguments stack bottom to top along `supports`, with the conclusion above its grounds, `attacks` on the side, `limits` on the side, and consequences above;
    - story joints flow left to right along `leads-to`.
  - Unconnected parts, such as a rejected brick, go to a side column.
  - Output: plate rectangles, joint polylines, label boxes, and the sheet size.
- Acceptance:
  - For every level of all fixtures, public and private, there are no overlaps between plates, between labels, or between a label and a plate, and **no joint line crosses a plate** other than its two ends (finding 13 of R-20261025). This is checked with geometry, as the research's browser script did.
  - The order matches the hand layout: the chain order for Atlas and TeamCity, the conclusion above its supports for Mill.
  - The same input always gives the same output.
- Evidence: `tests/layout.test.ts`.
- Dependencies: D1.

#### D3 — Learner state for disassemblies

- Purpose: the run, the reassembly and the notes resume after a restart.
- Action:
  - Add `disassemblyStateSchema`, keyed by id and revision. It records:
    - open path and selected part;
    - per run: step, choices and tried bricks;
    - reassembly placements and locked slots;
    - notes per part.
  - Restore follows the lesson rules: a revision change preserves the old file and restarts; invalid references reset with a notice.
  - `ProgressStore` and the bridge accept both state kinds through a discriminated schema. Lesson progress keeps loading.
- Acceptance:
  - State round-trips.
  - Revision and reference resets behave as for lessons.
  - Existing lesson progress files still load: tested with a saved v1 lesson state.
- Evidence: `tests/disassembly-state.test.ts`, `tests/progress-store.test.ts`.
- Dependencies: D1.

### Phase player

#### D4 — Paper and blueprint themes

- Purpose: the adopted visual direction, for the whole app.
- Action:
  - Replace the palette in `styles.css` and `clarity.css` with technical-drawing tokens for paper and blueprint, as in `prototypes/lab/lab.css`.
  - Kind-of-joint colors are always paired with line style and label.
  - Add `theme` (`system`, `paper`, `blueprint`) to `settingsSchema` as an optional field, so existing settings files stay valid, with a toggle in the header.
  - Respect `prefers-reduced-motion`.
- Acceptance:
  - Text and line tokens reach WCAG AA contrast against their background in both themes: an automated test over the token table.
  - Existing settings load.
  - Library, Studio and both players render in both themes.
- Evidence: a contrast test; a settings test; screenshots in both themes.
- Dependencies: none. It can run in parallel with D1–D3.

#### D5 — Exploded view, part card and source

- Purpose: Q1 of the research in the real app.
- Action:
  - React components under `src/renderer/disassembly/`:
    - the sheet in SVG, drawn from D2: balloons, title block, hatched closed sub-assemblies, typed joints;
    - breadcrumbs to enter and leave sub-assemblies;
    - keyboard navigation: plates are buttons, and Enter opens;
    - the part card: marked points, lens, metaphor with its limit, critique and inference labels, joints in words, citations;
    - the source pane, which highlights and scrolls only itself, shows page breaks for documents, and offers a file picker when there are many sources;
    - citations that name the file when there are several, and the page when the source has a page map.
  - Animation is decoration: state never waits for an animation frame (observation 8).
- Acceptance: interaction tests cover:
  - selecting a part shows its points and highlights its lines;
  - entering and leaving a sub-assembly;
  - closed sub-assemblies stay reachable;
  - no stray text when optional blocks are absent.
- Evidence: `tests/disassembly-player.test.tsx`.
- Dependencies: D1, D2, D3, D4.

#### D6 — Run: scenario, load test, new case

- Purpose: the interaction the owner called "fantastica", made durable.
- Action:
  - The scenario shows setup, then a prediction before each step, then execution: states, instruments and highlighted lines change, then the explanation.
  - The load test removes a brick: the target falls, weakens or holds, with the verdict, the explanation and the inference label.
  - The new case shows a choice with feedback, labelled as a constructed case.
  - Progress persists through D3.
- Acceptance: interaction tests cover:
  - a full scenario;
  - every brick of the Mill fixture;
  - a case;
  - resuming a half-finished scenario after a reload.
- Evidence: tests; a witnessed run in the desktop app.
- Dependencies: D5.

#### D7 — Reassembly and bill of materials

- Purpose: the optional proof, and the "nothing disappears" view.
- Action:
  - Reassembly by click or drag:
    - item numbers are hidden and the tray never starts in solution order (observation 6);
    - feedback names the first misplaced part with its hint;
    - it is labelled optional.
  - The bill-of-materials view shows:
    - the scope: repository snapshot or document pages;
    - parts with their line ranges;
    - exclusions with their reasons, including whole files;
    - a strip per source;
    - the result of the app's check.
- Acceptance:
  - A wrong placement names the first misplaced part.
  - A full reassembly locks every slot.
  - The bill-of-materials view of every fixture shows 0 forgotten lines.
- Evidence: tests.
- Dependencies: D5.

#### D8 — Library, store and vocabulary

- Purpose: disassemblies become what the app opens and saves.
- Action:
  - Add a `DisassemblyStore` in `src/desktop`, with the `LessonStore` pattern: atomic writes, size limit, invalid files skipped and counted.
  - Add IPC calls `disassemblies:list` and `disassemblies:find`.
  - The library lists:
    - prepared disassemblies (Atlas, Mill);
    - generated disassemblies;
    - a "Percorsi precedenti" section for saved lessons, played by the existing lesson player.
  - Interface terms follow the [mapping](../../../product.md#from-lesson-to-disassembly): smontaggio, pezzo, esploso, fai girare, rimonta, distinta base.
- Acceptance:
  - Existing generated lessons and their progress open unchanged.
  - Prepared disassemblies open.
  - The store tests mirror the `LessonStore` tests.
  - A witnessed desktop flow: library → disassembly → restart → resume.
- Evidence: tests; a desktop note in this plan's folder.
- Dependencies: D3, D5, D6, D7.

### Phase generation

#### D9 — Two-phase generation and evaluation

- Purpose: generate what the prototype showed, and measure it.
- Action:
  - **Structure request.** Strict JSON Schema; the source ids are a closed list. It returns:
    - `whole`;
    - the parts tree with kinds, roles and citations;
    - joints;
    - `bom.excluded`;
    - for each top-level part, whether it suits a scenario, a load test or a case.

    The app validates it with D1's structural checks, including the bill of materials, and allows one repair on both routes. ChatGPT gets this repair too, because a forgotten range is cheap to fix and costly to ship.
  - **Content requests**, one per top-level part, each carrying the goal, the structure and only that part's lines. They return points with marks, a metaphor with its limit, a lens, a critique when needed, and its sub-parts' sentences. A failing part gets one repair of that part only.
  - **Runs request.** It returns the runs and reassembly hints. The app derives the slots from the top-level parts and joints. It adds a repairable finding when the correct option is much longer than the wrong ones, with the threshold from the Q1 baseline.
  - Progress shows "Distinta", then "Pezzo k di n", then "Prove". Cancellation between phases saves nothing. Before a ChatGPT generation, the interface shows the number of requests.
  - **Evaluation.**
    - Adapt `npm run eval` and `eval/metrics.ts` to disassemblies: validity, repairs, requests, time, excluded share, layout overlaps from D2, the answer-length giveaway, the kinds of joint used.
    - Add the story case.
    - The claim-review template lists points and verdicts.
- Acceptance:
  - ChatGPT (gpt-6-sol, 2 attempts per public case, opt-in): at least 7 of 10 valid.
  - The local route is measured and reported, not gated.
  - One claim review per case shows no more wrong claims than the lesson baseline (0 in 3 lessons).
  - Every valid result has 0 forgotten lines and 0 layout overlaps.
  - The numbers are recorded in this plan's folder.
- Evidence: contract tests for each phase's schema and assembly; evaluation reports; claim reviews.
- Dependencies: D1, D2.

#### D10 — Studio flow and witnessed generation

- Purpose: generation inside the app, end to end.
- Action:
  - Studio generates a disassembly with phase progress and the request count.
  - A failure shows located findings.
  - The result opens in the player.
- Acceptance: a witnessed desktop generation on each route (ChatGPT and the chosen local model) from a public case, then a restart with the disassembly and its progress intact. This is the evidence P-20261021 T5 asked for, now for disassemblies.
- Evidence: `tests/studio.test.tsx` updated; a witnessed note.
- Dependencies: D8, D9.

### Phase repository (gated)

#### D11 — Local repository as a source

- Gate: starts only after the owner accepts D9's numbers. The owner may move it to a separate plan instead.
- Purpose: "analyze a repository" (Q5 of R-20261024), as tried by hand in R-20261025.
- Action:
  - Choose a local folder, read-only, and take a **snapshot with an identity**: the root, the commit, and the files modified in the working copy. The disassembly's `scope` records it (finding 5).
  - Before anything is previewed or sent:
    - list text files and respect `.gitignore`;
    - exclude binaries and build output (`generated`);
    - **detect secrets by content**: known key formats, connection strings with passwords, high-entropy tokens. A file with secrets is excluded whole with reason `secrets`, whatever its name (finding 2);
    - exclude language boilerplate (imports, namespace lines, closing braces) automatically with reason `context` (finding 3).
  - The structure request (D9) receives the question and a file list with sizes and short outlines. It chooses which files to read, and lists the others in `excludedFiles` with a reason (finding 1).
  - Sub-assemblies follow **responsibilities**, not directories, and cite file paths (finding 6).
  - Each content request carries only its part's files, so sizes stay within limits.
  - The preview shows the snapshot identity, the files that will be sent, and those excluded, with their reasons.
- Acceptance:
  - On this repository's `src/core`, a disassembly is produced with 0 forgotten lines.
  - On a fixture folder with planted secrets (a JSON settings file, a source file with a connection string, a `.env`), no secret reaches the preview or a request, and each file appears as excluded with reason `secrets`.
  - The preview matches the request text.
  - The private repository case from R-20261025, run locally and never committed, produces a valid disassembly. The owner judges whether it explains the workflow at least as well as the hand-made one.
- Evidence: adapter tests with fixture folders; one public evaluation case; a witnessed run.
- Dependencies: D9, D10.

### Phase document (gated)

#### D12 — PDF document as a source

- Gate: the same as D11. It can run in parallel with D11.
- Purpose: "analyze documents", as tried by hand in R-20261025.
- Action:
  - Import a text-based PDF. Extract page by page, with an **extraction quality check**: the share of dictionary words, and the rate of broken ligatures and hyphenation. If the check fails, try a second extractor; if both fail, refuse with a clear message (finding 8).
  - Build the page map, and remove running headers and footers, such as repeated chapter titles and page numbers (findings 9, 10).
  - Choose the range: the whole document, or chapters and pages from the outline. The disassembly's `scope` records title and pages.
  - Figures and tables that do not extract as text are listed in `excludedFiles` with reason `detail`, so their absence stays visible (finding 11).
  - The source text stays on the device. The request preview shows which pages go to a hosted model. Copyrighted documents never enter prepared examples or evaluation fixtures (finding 15).
- Acceptance:
  - On a public-domain PDF fixture with ligatures, running headers and a figure:
    - the extracted text passes the quality check;
    - no running header remains;
    - the figure appears as excluded;
    - citations show the correct pages.
  - A PDF whose extractor drops ligatures is either repaired by the fallback or refused. It is never accepted silently.
  - The private document case from R-20261025, run locally, produces a valid disassembly with page citations.
- Evidence: adapter tests with PDF fixtures; one public evaluation case; a witnessed run.
- Dependencies: D9, D10. The extractor choice must not add a dependency without the owner's separate approval.

## Definition of done

- D1–D10 meet their acceptance criteria. D11 and D12 meet them, or the owner moves them to a separate plan.
- New generation produces disassemblies only. Saved lessons remain readable.
- Both themes ship, and the default follows the system.
- Documentation is updated:
  - the README, with what is verified;
  - `docs/architecture.md`;
  - `docs/development.md`, for evaluation;
  - the product definition's mapping section, which then marks what is built.
- No claim is made about learning effectiveness, small models, or sources larger than those measured.

## Risks and concrete responses

| Risk | Response |
|---|---|
| Models cannot fill the richer contract reliably | Two phases with app validation between them; per-part repair; ChatGPT first; D9's measured gate before D10 |
| Automatic layout produces cluttered sheets | Geometry tests on all fixtures in D2; length rules in D1; generation sees the limits |
| Legacy lessons break while the app changes underneath | They keep their own schema, store and player; tests load a saved lesson and its progress in D3 and D8 |
| More requests per ChatGPT generation (about 5–9) | Request count shown before generating; evaluation is opt-in and capped; content requests carry only one part's lines |
| Interpretations presented as facts | `inference` and `critique` are contract fields; the app labels them; claim review checks them |
| Private material leaks through fixtures or evaluation | The TeamCity file stays in `.local/`; local-only tests skip when it is absent; public fixtures are original or public domain |
| Repository analysis sends secrets | D11 detects secrets by content, not by file name, before preview; files with secrets are excluded whole with the reason shown; a fixture with planted secrets is part of acceptance |
| A PDF is extracted wrongly and nobody notices | D12 checks extraction quality, falls back to a second extractor, and refuses rather than accept bad text |
| Copyrighted or company material leaks into the public repository | Private cases stay in `.local/`; public docs describe them generically; fixtures are original or public domain |
| A snapshot is analyzed but nobody can tell which version | `scope` records commit and modified files, or document pages |
| Reassembly does not prove understanding (Q3 open) | It ships as optional; the owner's use after D8 is recorded; the plan does not claim learning effects |

## Verification strategy

- **Project commands:**
  - `npm run check`: TypeScript and Vitest;
  - `npm run build`;
  - `npm run eval`, with the ChatGPT route opt-in and capped.
- **Test layers:**
  - contract and layout tests, pure and in `src/core`;
  - state and store tests;
  - interaction tests in jsdom for the player, run, reassembly and Studio;
  - evaluation runs for generation quality;
  - witnessed desktop flows for persistence and live generation.
- **Limits:**
  - jsdom does not lay out SVG text, so D2's geometry is tested on computed boxes from the layout module;
  - visual quality is witnessed;
  - evaluation on a small set gives indications, not proof.

## Review and authorization

Self-review is in [review.md](review.md). Version 2 revises v1 after [research R-20261025](../../research/R-20261025-repository-and-document.md), at the owner's request: "rivedi il piano P-20261024-disassembly in v2 con i risultati della ricerca R-20261025". Version 1 was never approved.

**Activation constraint:** only one plan may be active for implementation.
- P-20261021 is `blocked`.
- P-20261022 is `awaiting_approval`; the owner decides its fate, as described above.

Approval command:

`Approve P-20261024-disassembly v2`

The proposed handling of P-20261022 can be stated in the same message, for example "and supersede P-20261022-generation-quality". A later, separate command starts edits, for example:

`implement P-20261024-disassembly v2 --phase contract`

Named phases:
- `contract`: D1–D3;
- `player`: D4–D8;
- `generation`: D9–D10;
- `repository`: D11, gated;
- `document`: D12, gated.

Approval does not authorize:
- ChatGPT runs beyond the stated cap;
- model downloads or dependency changes, including a PDF extraction library;
- publication;
- importing private documents or code into the repository;
- starting D11 or D12 before their gate.

## Approval record

Version 2, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261024-disassembly v2 and supersede P-20261022-generation-quality`.
- Approved plan/version: `P-20261024-disassembly` / `2`.
- Recorded at: `2026-10-25T10:57:10+01:00` (Europe/Rome).
- Approved scope: D1–D12 and their acceptance criteria; phases `contract`, `player`, `generation`, and the gated phases `repository` and `document`; the stated assumptions and exclusions.
- Approved-content SHA-256: `5bbb3814bfc72a788b09ff5862fd717a40caef80634aaca4bf59b6c83ad1e66f`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Disassemblies` up to, and not including, `## Review and authorization`.
- Related decision in the same message: P-20261022-generation-quality is `superseded` by this plan.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized:
  - ChatGPT runs beyond the stated cap;
  - model downloads and dependency changes, including a PDF extraction library;
  - publication;
  - importing private documents or code into the repository;
  - starting D11 or D12 before their gate.

Version 1: never approved; superseded by v2.
