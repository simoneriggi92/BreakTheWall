---
id: P-20261024-disassembly
title: Disassemblies replace lessons - contract, player, two-phase generation, technical-drawing themes
version: 3
state: implementing
current_task: D8
last_evidence: Phase player (D4-D8) implemented and revised after the owner's first desktop use - npm run check 223 tests passed, npm run build passed
next_action: Owner witnesses the desktop flow of D8 (library, disassembly, restart, resume, language switch); then implement P-20261024-disassembly v3 --phase generation
approval: approved
---

# Disassemblies

## Outcome

The app produces and plays **disassemblies** instead of lessons, as defined in the [product identity](../../../product.md#identity):
- a source is taken apart into 3–7 parts per level, with sub-assemblies and typed joints;
- the learner runs a part (a scenario, a load test or a new case) and can reassemble the whole;
- a bill of materials accounts for every source line, and the app checks it;
- the whole app uses the technical-drawing style, with a paper theme and a blueprint theme;
- the whole interface is available in **English and Italian**. The interface language is independent of the language of a disassembly's content.

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
- Phase `contract` (D1–D3) was implemented under v2 on 2026-10-25; see the [implementation record](#implementation-record). Version 3 does not change D1–D3.
- Owner requirement of 2026-10-25, given during that phase: "L'app deve essere multi-lingua: inglese ed italiano".
- Current code before this plan (static inspection):

| Area | Where | Today |
|---|---|---|
| Stored format | `src/core/lesson.ts` | `lessonSchema` v1: sources with full text and sha256; evidence quotes; pages of blocks (`map`, `sequence`, `comparison`, `lens`, `source`, `reflection`); `choice`/`order` activities; 19 icon names |
| Learner state | `src/core/state.ts`, `src/desktop/progress-store.ts` | Per lesson id + revision; a revision change preserves old progress and restarts |
| Generation | `src/core/generation.ts`, `src/desktop/generator.ts` | One request, one repair for local results only, `assessDraft` quality rules |
| Storage | `src/desktop/lesson-store.ts` | Atomic writes; invalid files counted and skipped, never shown |
| Interface | `src/renderer/App.tsx`, `Library.tsx`, `Studio.tsx`, `blocks.tsx`, `StudyTools.tsx`, `styles.css`, `clarity.css` | Lesson player and library; green-accent palette with a dark variant; every string hard-coded in Italian, `<html lang="it">` |
| User-facing messages from the host | `src/core/source.ts`, `src/core/provider.ts`, `src/desktop/**` | Italian sentences. Import errors and provider failures already carry a `code`; counts are formatted with `it-IT`; the sign-in callback page is Italian |
| Prepared content | `src/fixtures/lessons.ts` | Two prepared lessons |
| Evaluation | `eval/`, `npm run eval` | Measures lessons. Baselines: ChatGPT gpt-6-sol 8/8 valid, local 5/15 |
| Tests | `tests/*.test.ts(x)` | 101 tests: contracts, generation, providers, studio and player interactions |

## Scope and choices

- **A new stored format.** `src/core/disassembly.ts` holds `disassemblySchema` v1, derived from the prototype's 0.1 contract, with host checks that return findings located by path.
- **Automatic layout.** A pure, deterministic layout in `src/core` replaces the prototype's hand-placed grid positions.
- **The player.** Exploded view, part card with marked points, source pane, run (scenario, load test, new case), reassembly, and bill-of-materials view, with the vocabulary from the product definition in both languages.
- **Two interface languages, English and Italian.**
  - Every interface string comes from a message catalog per language, with no new dependency. The English and Italian catalogs have the same keys; the type checker and a test enforce it.
  - Messages that start in the core or the desktop host travel as a code with parameters and are worded by the interface. Import errors and provider failures already have codes. Disassembly restore notices have been codes since D3.
  - Numbers and dates are formatted for the interface language.
  - The page declares the interface language. Content blocks declare the disassembly's language, so a screen reader reads Italian content in an Italian voice under an English interface.
  - Content is never translated by the app. A disassembly is written in one language, recorded in its `language` field.
- **Themes for the whole app.** Paper and blueprint replace the current palette. The default follows the system setting: light gives paper, dark gives blueprint. An explicit choice is saved in the settings.
- **Two-phase generation:**
  - first a structure request (parts, joints, bill of materials), validated by the app;
  - then one content request per top-level part;
  - then one request for runs and reassembly hints.

  The structure phase can be repaired once on both routes. Content and runs can be repaired per part.
- **Prepared examples.** The two public prototype disassemblies become fixtures: the Atlas Reader runbook and Mill's harm principle. Mill's text is in the public domain. Both get an English version as well. Their sources are English already, so only the disassembly is written again.
- **Lessons become legacy.** Saved generated lessons stay readable in a "Percorsi precedenti" section, with their progress. They are not converted. New generation produces only disassemblies.
- **Two later phases, for repositories and for PDF documents.** Both are gated on the generation results. Both produce a scoped snapshot that the contract records, and a file- or page-level bill of materials.

Not included:
- interface languages other than English and Italian, right-to-left scripts, and translation of sources or of a disassembly from one language to the other;
- the parts store across disassemblies, recognition of a part met in another disassembly, opt-in review;
- AI-assisted web discovery, packaging or signing;
- document formats other than PDF (Word, EPUB, HTML), scanned PDFs needing OCR, and understanding figures (they are listed as excluded);
- conversion of old lessons into disassemblies;
- LLM-as-judge scoring, optimization for small models, learner studies.

### Relation to other plans

1. **[P-20261022-generation-quality](../P-20261022-generation-quality/plan.md) v2**, now `superseded`:
   - Q1, the evaluation runner, is complete and reused here.
   - Q1b and Q2 tune the lesson draft that this plan replaces.
   - Q3, the two-phase pipeline, is absorbed by D9.

   **Decided** with the v2 approval: that plan is `superseded` by this one.
2. **[P-20261021-first-learning-loop](../P-20261021-first-learning-loop/plan.md)** is `blocked` on T5, a witnessed in-app ChatGPT generation and restart check. D10 produces that evidence for disassemblies. **Proposal:** once D10 passes, the owner decides whether P-20261021 is `completed` with T5 met by D10, or `superseded`. This plan does not change its state.

### Assumptions (the owner can change them before approval)

- Default theme: follow the system. Explicit choice: `system`, `paper` or `blueprint`.
- Default interface language: follow the system locale. Italian gives Italian; any other locale gives English. Explicit choice: `system`, `it` or `en`, saved in the settings.
- Content language of a generated disassembly: the language of the learner's question, when the app can tell. Otherwise, the interface language. The learner can change it before generating.
- The library shows prepared examples in the interface language first, and the other language under a filter.
- Saved lessons keep their Italian content. Only the legacy player's own controls follow the interface language.
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

#### D4 — Paper and blueprint themes, English and Italian interface

- Purpose: the adopted visual direction and the owner's two interface languages, for the whole app. Both are shell-wide settings with a toggle in the header, so they are one task.
- Action, themes:
  - Replace the palette in `styles.css` and `clarity.css` with technical-drawing tokens for paper and blueprint, as in `prototypes/lab/lab.css`.
  - Kind-of-joint colors are always paired with line style and label.
  - Add `theme` (`system`, `paper`, `blueprint`) to `settingsSchema` as an optional field, so existing settings files stay valid, with a toggle in the header.
  - Respect `prefers-reduced-motion`.
- Action, languages:
  - Add message catalogs under `src/renderer/i18n/` (`it`, `en`) and a small `t(key, params)` with a React context. No library is added.
  - Move every existing string of the shell, Library, Studio, StudyTools and the lesson player into the catalogs.
  - Add `language` (`system`, `it`, `en`) to `settingsSchema` as an optional field. Resolve `system` from the locale reported by the host, and keep a browser fallback.
  - Word host messages by code: source import errors (with their counts as parameters), provider failures, and disassembly restore notices. Where a host message has no code yet, add one. Lesson restore notices get codes too; the lessons' own content stays as it is.
  - Format numbers and dates with `Intl` for the interface language; remove the hard-coded `it-IT`.
  - Set `<html lang>` from the interface language. The sign-in callback page opened in the system browser follows it too.
- Acceptance:
  - Text and line tokens reach WCAG AA contrast against their background in both themes: an automated test over the token table.
  - Existing settings load, with and without the new fields.
  - Library, Studio and both players render in both themes and both languages.
  - The two catalogs have the same keys and no empty value: type check and test.
  - Rendered in English with English content, the Library, Studio and lesson player read as English by `detectLanguage`, and as Italian when rendered in Italian. This catches strings left out of the catalogs.
  - Every import-error and provider-failure code has a message in both catalogs.
- Evidence: a contrast test; a settings test; `tests/i18n.test.tsx`; screenshots in both themes and both languages.
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
  - Joint verbs, kinds of part, point marks and exclusion reasons come from the catalogs. Content blocks carry `lang` from the disassembly.
  - Joint labels are drawn in the 11px monospaced font that D2's layout assumes.
- Acceptance: interaction tests cover:
  - selecting a part shows its points and highlights its lines;
  - entering and leaving a sub-assembly;
  - closed sub-assemblies stay reachable;
  - no stray text when optional blocks are absent;
  - an Italian disassembly under an English interface: controls in English, content in Italian with `lang="it"`, and the reverse with the English story fixture.
- Evidence: `tests/disassembly-player.test.tsx`.
- Dependencies: D1, D2, D3, D4.

#### D6 — Run: scenario, load test, new case

- Purpose: the interaction the owner called "fantastica", made durable.
- Action:
  - The scenario shows setup, then a prediction before each step, then execution: states, instruments and highlighted lines change, then the explanation.
  - The load test removes a brick: the target falls, weakens or holds, with the verdict, the explanation and the inference label.
  - The new case shows a choice with feedback, labelled as a constructed case.
  - Progress persists through D3. Restore notices are worded from their codes.
  - Verdicts, labels for constructed cases and inference marks come from the catalogs.
- Acceptance: interaction tests cover:
  - a full scenario;
  - every brick of the Mill fixture;
  - a case;
  - resuming a half-finished scenario after a reload;
  - the load-test verdicts in both interface languages.
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
    - the result of the app's check, worded from the bill of materials data, not from the validator's English findings.
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
  - Interface terms follow the [mapping](../../../product.md#from-lesson-to-disassembly) in both languages: smontaggio / disassembly, pezzo / part, esploso / exploded view, fai girare / run, rimonta / reassemble, distinta base / bill of materials. The product definition lists both columns.
  - Add the English versions of Atlas and Mill as prepared disassemblies, validated by D1 and laid out by D2 like the others.
  - The library lists prepared examples in the interface language first, and offers the other language through a filter. Each entry shows its content language.
- Acceptance:
  - Existing generated lessons and their progress open unchanged.
  - Prepared disassemblies open.
  - The store tests mirror the `LessonStore` tests.
  - A witnessed desktop flow: library → disassembly → restart → resume, once per interface language, including a switch of language with progress intact.
  - The English versions of Atlas and Mill pass D1 and D2 with 0 forgotten lines and no layout findings.
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
  - **Language.** Every request names the content language. The app checks the result with `detectLanguage` on the question, the part names and the points, and adds a repairable finding when they disagree.
  - Progress shows the phases ("Distinta" / "Bill of materials", then "Pezzo k di n" / "Part k of n", then "Prove" / "Runs"). Cancellation between phases saves nothing. Before a ChatGPT generation, the interface shows the number of requests.
  - **Evaluation.**
    - Adapt `npm run eval` and `eval/metrics.ts` to disassemblies: validity, repairs, requests, time, excluded share, layout overlaps from D2, the answer-length giveaway, the kinds of joint used.
    - Add the story case. It is in English, so evaluation covers both content languages.
    - The claim-review template lists points and verdicts.
- Acceptance:
  - ChatGPT (gpt-6-sol, 2 attempts per public case, opt-in): at least 7 of 10 valid.
  - The local route is measured and reported, not gated.
  - One claim review per case shows no more wrong claims than the lesson baseline (0 in 3 lessons).
  - Every valid result has 0 forgotten lines and 0 layout overlaps, and its content is in the requested language.
  - The numbers are recorded in this plan's folder.
- Evidence: contract tests for each phase's schema and assembly; evaluation reports; claim reviews.
- Dependencies: D1, D2.

#### D10 — Studio flow and witnessed generation

- Purpose: generation inside the app, end to end.
- Action:
  - Studio generates a disassembly with phase progress and the request count, and lets the learner set the content language before generating.
  - A failure shows a summary in the interface language and the located findings as technical detail. The validator's findings stay in English, because they also go back to the model as repair instructions.
  - The result opens in the player.
- Acceptance:
  - A witnessed desktop generation on each route (ChatGPT and the chosen local model) from a public case, then a restart with the disassembly and its progress intact. This is the evidence P-20261021 T5 asked for, now for disassemblies.
  - One of the witnessed generations has an English question under an Italian interface, and produces English content.
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
- Both interface languages ship, the default follows the system locale, and no interface string is hard-coded outside the catalogs.
- Documentation is updated:
  - the README, with what is verified;
  - `docs/architecture.md`;
  - `docs/development.md`, for evaluation;
  - the product definition's mapping section, in both languages, which then marks what is built.
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
| A string escapes the catalogs and shows Italian under an English interface | Key parity test; the `detectLanguage` render test over every screen in both languages; host messages travel as codes |
| The two catalogs drift: a change in one language is not made in the other | Same keys enforced by the type checker; the review of each task checks both catalogs |
| A coarse language check accepts mixed-language generated content | It only flags clear disagreement; claim review in D9 reads the content; the learner can see the language label |
| Reassembly does not prove understanding (Q3 open) | It ships as optional; the owner's use after D8 is recorded; the plan does not claim learning effects |

## Verification strategy

- **Project commands:**
  - `npm run check`: TypeScript and Vitest;
  - `npm run build`;
  - `npm run eval`, with the ChatGPT route opt-in and capped.
- **Test layers:**
  - contract and layout tests, pure and in `src/core`;
  - state and store tests;
  - interaction tests in jsdom for the player, run, reassembly and Studio, in both interface languages where wording matters;
  - catalog parity and rendered-language tests;
  - evaluation runs for generation quality;
  - witnessed desktop flows for persistence and live generation.
- **Limits:**
  - jsdom does not lay out SVG text, so D2's geometry is tested on computed boxes from the layout module;
  - visual quality is witnessed;
  - evaluation on a small set gives indications, not proof.

## Review and authorization

Self-review is in [review.md](review.md).
- Version 3 adds the English and Italian interface, at the owner's request: "rivedi il piano P-20261024-disassembly in v3 con l'interfaccia multilingua inglese e italiano". It changes D4–D10 and the shared sections, and leaves D1–D3 and D11–D12 unchanged. D1–D3 were implemented under the v2 approval, and their evidence stays valid.
- Version 2 revised v1 after [research R-20261025](../../research/R-20261025-repository-and-document.md). Version 1 was never approved.

**Activation constraint:** only one plan may be active for implementation.
- P-20261021 is `blocked`.
- P-20261022 is `superseded`.

Approval command:

`Approve P-20261024-disassembly v3`

The v2 approval no longer covers the remaining tasks, because v3 is a material change. A later, separate command starts edits, for example:

`implement P-20261024-disassembly v3 --phase player`

Named phases:
- `contract`: D1–D3, done under v2;
- `player`: D4–D8;
- `generation`: D9–D10;
- `repository`: D11, gated;
- `document`: D12, gated.

Approval does not authorize:
- ChatGPT runs beyond the stated cap;
- model downloads or dependency changes, including a PDF extraction library or an internationalization library;
- publication;
- importing private documents or code into the repository;
- starting D11 or D12 before their gate.

## Approval record

Version 3, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261024-disassembly v3`.
- Approved plan/version: `P-20261024-disassembly` / `3`.
- Recorded at: `2026-10-25T11:34:31+01:00` (Europe/Rome).
- Approved scope: D4–D12 and their acceptance criteria as written in v3, with D1–D3 recorded as done under v2; phases `player`, `generation`, and the gated phases `repository` and `document`; the stated assumptions and exclusions, including the English and Italian interface.
- Approved-content SHA-256: `8a8dd3fae51cf2ddee8c88a8217df3ecbd5eff2d6ec3755b879fb2d31b4ca8b9`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Disassemblies` up to, and not including, `## Review and authorization`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized:
  - ChatGPT runs beyond the stated cap;
  - model downloads and dependency changes, including a PDF extraction library or an internationalization library;
  - publication;
  - importing private documents or code into the repository;
  - starting D11 or D12 before their gate.

Version 2, approved and superseded by v3 for the remaining tasks:

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

## Implementation record

### Phase contract (D1–D3)

Received command: `implement P-20261024-disassembly v2 --phase contract`, on 2026-10-25. The plan ID, version and approval digest matched the approval record; no other plan was implementing.

| Task | Status | Evidence |
|---|---|---|
| D1 | Done | `src/core/disassembly.ts`; `tests/disassembly.test.ts` (automated test) |
| D2 | Done | `src/core/layout.ts`; `tests/layout.test.ts` (automated test) |
| D3 | Done | `src/core/disassembly-state.ts`, `src/desktop/progress-store.ts`; `tests/disassembly-state.test.ts`, `tests/progress-store.test.ts` (automated test) |

Checks:
- `npm run check`: passed, 12 files, 185 tests. These include the local-only tests of the three private fixtures, which are present on the owner's machine.
- Without `.local/fixtures/`, the private-fixture tests drop out and the others pass.
- `npm run build`: passed. The lucide-react "use client" warning was already there before this phase.
- Static scan of the new and changed tracked files: no names, code or text from the private cases.

Fixtures:

| Fixture | Where | Kind of joint | Tracked |
|---|---|---|---|
| Atlas Reader release | `src/fixtures/disassemblies/atlas-release.json` | mechanism, with an argument sub-assembly | yes, original text |
| Mill's harm principle | `src/fixtures/disassemblies/mill-harm.json` | argument | yes, public-domain text |
| The harbour bell of Kessmouth | `tests/fixtures/disassemblies/kessmouth-quay.json` | story; English, so the `en` path is exercised | yes, original fictional text |
| Three private cases: the deploy runbook, the repository case, the document case | `.local/fixtures/disassemblies/` | mechanism, mechanism, argument | no |

Acceptance, by task:
- **D1.**
  - All six fixtures validate.
  - A `weakens` verdict, a slot set, a page map, a repository scope and file-level exclusions with reasons `secrets` and `generated` validate.
  - 35 malformed variants each produce a finding at the expected path, e.g. `parts[1].parts[0].cites[0]` or `runs[0].steps[0].flow[0]`.
  - The bill of materials reports forgotten ranges as `from–to` per source, merging the blank lines inside a range.
- **D2.**
  - Every level of the six fixtures (25 sheets) has no overlapping plates or labels and no joint crossing a plate.
  - Atlas runs left to right in chain order, with the rollback drawn as the only return.
  - Mill stacks its grounds below the claim and the consequence above it. Attack and limit sit beside the claim, and the rejected brick sits in the side column.
  - The output is identical across runs.
  - A visual look at a debug drawing of every level found the sheets readable. It was not the app, so the rendered quality is still to be witnessed in D5.
- **D3.**
  - State round-trips.
  - A changed revision, an invalid shape, and 14 kinds of dangling reference all restart, and the store keeps the old file.
  - A lesson progress file in the exact pre-existing shape loads unchanged.
  - The bridge, preload, desktop host and browser storage accept both kinds of state. This is checked by type checks and store tests, not yet in a witnessed desktop run.

Decisions taken within the approved scope:
- **Icons.** The closed list has 37 lucide names. The lab's 80 decorative icons were mapped onto it during conversion.
- **Quotes.** Citations store only `source`, `from` and `to`. `citedLines` copies the text from the source, so a quote can never drift from it.
- **Source origin.** Sources gain an origin `public-domain` for Mill, since `original-prepared` would be untrue.
- **Contract strictness.** Top-level parts must have 2–4 points and no sentence; sub-parts must have a sentence and no points. Every top-level part must sit in a reassembly slot and have a hint.
- **Restore notices.** For disassemblies these are codes (`invalid`, `revision-changed`, `references-changed`, `unreadable`), not Italian sentences, so the interface can word them in either language. Lesson notices are unchanged.
- **Storage.** Disassembly progress is stored under `_disassemblies/<id>/<revision>.json`, apart from lesson folders.
- **Layout and renderer.** The layout estimates label width for an 11px monospaced font. D5 must draw labels in that font, or the geometry guarantee does not hold.
- **Conversion.** The lab files were converted once by a scratch script. Its output was checked by the tests above. The script was not committed.

Owner requirement raised during this phase (2026-10-25), and addressed by v3: the app must be **multilingual, English and Italian**. Disassembly content already carries its own `language`, and this phase keeps interface text out of `src/core`. The plan, however, says the player is "all in Italian" (Scope, D5–D8). Making the interface bilingual is a material change: it needs a plan v3 and a new approval before the `player` phase starts.

### Phase player (D4–D8)

Received command: `implement P-20261024-disassembly v3 --phase player`, on 2026-10-25. The plan ID, version and approval digest matched the v3 approval record.

| Task | Status | Evidence |
|---|---|---|
| D4 | Done | `styles.css` tokens, `src/renderer/i18n/`, `preferences.tsx`, codes on host messages; `tests/theme.test.ts`, `tests/i18n.test.tsx` (automated test); browser preview in paper, blueprint, Italian and English (witnessed by the agent, not the owner) |
| D5 | Done | `src/renderer/disassembly/` (Sheet, PartCard, SourcePane, DisassemblyPlayer); `tests/disassembly-player.test.tsx` |
| D6 | Done | `RunPanel.tsx` and pure transitions in `src/core/disassembly-state.ts`; `tests/disassembly-player.test.tsx` |
| D7 | Done | `Reassemble.tsx`, `BillOfMaterials.tsx`; `tests/disassembly-player.test.tsx` |
| D8 | Done except the witnessed desktop flow | `src/desktop/disassembly-store.ts`, IPC `disassemblies:list` and `disassemblies:find`, library sections, English Atlas and Mill; `tests/disassembly-store.test.ts`. The desktop flow is **not yet witnessed**: the app starts without errors, but the agent cannot see or drive its window |

Checks:
- `npm run check`: passed, 16 files, 221 tests.
- `npm run build`: passed. New warning: the renderer bundle is 592 kB, above Vite's 500 kB hint, because the four prepared disassemblies, with their sources, are bundled. The lucide-react warning was already there.
- `npm start`: the desktop app started, loaded the prepared disassemblies in the main process, and printed no error.
- Static scan of the new and changed files: no names, code or text from the private cases.

Acceptance, by task:
- **D4.**
  - Every text/background pair, including joint labels in their kind's color, reaches WCAG AA in both themes. The test reads the tokens from the stylesheet itself. The lowest ratios are 4.54 on paper and 5.25 on blueprint.
  - Settings files with or without `theme` and `language` load.
  - The two catalogs have the same keys and no empty text.
  - Library, Studio and the lesson player read as English or Italian by `detectLanguage` when rendered in that interface language.
  - Switching language and theme from the header saves them together with the existing settings.
  - Every failure code, failure reason, import error and account notice has wording in both catalogs. The type checker enforces this, because the interface indexes the catalogs by those codes.
- **D5.**
  - Selecting a part shows its marked points and highlights its first citation, scrolling only the source pane.
  - A citation button moves the highlight.
  - A closed sub-assembly is hatched, says so, and opens; breadcrumbs lead back.
  - Plates open from the keyboard, and the card shows no stray text when lens, metaphor or critique are absent.
  - An Italian disassembly under an English interface keeps English controls and `lang="it"` content, and the reverse holds with the story fixture.
- **D6.**
  - The full Atlas scenario runs. Each predicted step asks before executing, then shows states, instruments and the explanation.
  - Every brick of the Mill load test gives its verdict, with the inference label only where the fixture marks one.
  - The new case is labelled as constructed.
  - A half-finished scenario resumes after closing the player.
  - The verdicts are worded in English too.
- **D7.**
  - The tray never starts in solution order (all public fixtures), and no item number is drawn.
  - A wrong placement names the part and its hint; a full reassembly locks all six Atlas slots.
  - The bill-of-materials view of every public fixture shows the app's check with 0 forgotten lines, and lists scope and file-level exclusions.
- **D8.**
  - The store tests mirror the lesson store: validate, save, list newest first, find, refuse prepared or invalid input, skip and keep unreadable or misplaced files.
  - The prepared disassemblies are listed in the interface language first, and the other language is one checkbox away.
  - Saved lessons are listed under "Percorsi precedenti" and open in the lesson player. The existing lesson tests pass against that section.
  - The English Atlas and Mill pass D1 and D2: validation, 0 forgotten lines, and no layout findings.
  - **Still open: the witnessed desktop flow** of library → disassembly → restart → resume, in each interface language, including a language switch with progress intact.

Decisions taken within the approved scope:
- **Prepared lessons leave the library**, as the plan's assumption says. `App` shows lessons only from the store, or from its `prepared` prop, which the tests use to keep exercising the lesson player.
- **Settings have one owner in the renderer**: a preferences provider that Studio and the header share. This way a theme switch cannot be overwritten by Studio's older copy of the settings.
- **Codes on host messages.** Messages from the host now carry codes. The Italian `message` stays for logs and older tests:
  - provider failures carry a `reason` code;
  - account notices carry a `noticeCode`;
  - import errors carry a `code` and `params`;
  - local format checks carry `reason` and `sample`.

  Lesson restore notices also carry a code. The lesson player's own controls follow the interface language; lesson content is shown unchanged, without a `lang` attribute, because a lesson does not record its language.
- **Run and reassembly logic** lives in `src/core/disassembly-state.ts` as pure transitions. The components only draw what those transitions return.
- **Sheets keep a minimum scale of 0.7.** A wide drawing scrolls sideways inside its own frame instead of shrinking below readable lettering.
- **English fixtures** were written by a helper agent from the Italian files and checked by the agent: identical sources and structure, and English questions.

Owner steps for the open D8 check (`npm start`):
1. Open a disassembly, select a part, run two scenario steps, and write a note.
2. Quit the app and start it again: "Riprendi" leads back to the same state.
3. Switch the language in the header: the interface changes, while progress and content stay.
4. Repeat steps 1–3 with the other language and with the blueprint theme.

#### Owner's first desktop use, and the fixes (2026-10-25)

The owner ran the desktop app, from Rider and `npm start`, and reported four points.

| Report | Response |
|---|---|
| After a language switch on "Run", the parts' text stayed Italian | This is by design, since content keeps its language. But two versions of Atlas and Mill exist, so the player now offers the other one. The contract gains an optional `family`, shared by the language versions of one disassembly. When the disassembly's language differs from the interface's and a version in the interface language exists, a notice offers to open it. Progress stays separate for each version |
| "Esegui" changes everything at once; the prototype's yellow dot is missing | A step now runs in two beats. Its parts first show the pulsing amber "running" mark, with the step's flow animated and the controls replaced by "In esecuzione…". After 0.9 s the effects, instruments and explanation land. The delay is zero under `prefers-reduced-motion` |
| Everything is squeezed into the right column | The drawing now takes the full width. Below it, the card or run sits on the left and the source on the right; the source is taller. Narrow windows stack them |
| Rename to "WreckIt" | Not done. A quick search found Disney's "Wreck-It Ralph" and a US application for "WRECK-IT" covering an app. The owner chose to keep "Break the Wall" |

Also found while taking screenshots:
- Long part names overflowed the plate's right edge, and three-line names touched the kind label.
- The names now wrap at 17 characters and sit in a band below the label.
- Plates are 84 px tall instead of 76; the layout geometry tests pass with the new size.
- A browser check found no name outside its plate or over its label on the prepared sheets.

New tests:
- the two-beat step, with fake timers and a non-reduced-motion media query;
- the offer of the other version under an English interface.

The README now describes the disassembly product, with a new blueprint screenshot of Mill. It says plainly that Studio still generates lessons until the generation phase.

D8's witnessed desktop flow stays open until the owner confirms it on this version.
