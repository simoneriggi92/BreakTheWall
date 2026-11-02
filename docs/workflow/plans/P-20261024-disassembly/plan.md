---
id: P-20261024-disassembly
title: Disassemblies replace lessons - contract, player, two-phase generation, technical-drawing themes
version: 7
state: blocked
current_task: D8
last_evidence: identity and presentation verified, including the owner's Dock icon check; v0.1.0-alpha published as a pre-release
next_action: Blocked while P-20261029-source-entry is approved and implements; then the owner witnesses D8 (library and store) and D10 (generated disassembly in Studio); D11–D12 stay gated
approval: approved
---

# Disassemblies

## Outcome

The app produces and plays **disassemblies** instead of lessons, as defined in the [product identity](../../../product.md#identity):
- a source is taken apart into 3–7 parts per level, with sub-assemblies and typed joints;
- any part can be taken apart further, on request, as deep as the source allows. No fixed number of levels limits it;
- the learner runs a part (a scenario, a load test or a new case) and can reassemble the whole;
- a bill of materials accounts for every source line, and the app checks it;
- the whole app uses the technical-drawing style, with a paper theme and a blueprint theme;
- the whole interface is available in **English and Italian**. The interface language is independent of the language of a disassembly's content.

Generation produces disassemblies in two phases. ChatGPT is the primary route and capable local models the secondary one, per the owner's decision of 2026-10-22. Before a default is chosen, ChatGPT models are compared on the same cases, including a mixed setup where a strong model writes the structure and a cheaper one writes the parts.

Lessons already saved stay readable. Nothing the learner has today is lost.

The owner requires the tool to analyze **code repositories and documents** as well as short text sources. Both arrive as gated phases after two-phase generation, because neither fits in one request.

Version 6 makes the app easier to read and to use, after the owner's first generated disassemblies:
- in the player: numbers that follow the line of reasoning, a way back to the level above, panes the learner can resize, and a rendered view of markdown sources with their diagrams;
- in generation: suggested questions after the source is added, a short lead with the details in the points, fewer failures over a few characters, a failed generation that can resume, and the drawing shown while the parts are written.

Version 7 gives the app the identity the owner chose for the public alpha, and presents the repository with it:
- the name stays **Break the Wall**; the tagline becomes "Take the text apart." / "Smonta il testo.";
- a new mark: four bars, like lines of text, with one terracotta piece pulled out and still linked to its place;
- the header, the home's opening, the desktop icon, the README, the demo, the social card and the GitHub page all use it;
- the first public release, `v0.1.0-alpha`, is cut once they do.

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
- Phase `player` (D4–D8) was implemented under v3 on 2026-10-25 and revised after the owner's first desktop use. D8's witnessed desktop flow is still open. Version 4 does not change D1–D8.
- Owner request of 2026-10-26 (v4): test generation through ChatGPT models, find which models give the best disassemblies, and look for "un'ottima qualità con modelli meno costosi". Also try a markdown document about an architecture and workflow the owner is building at work.
- Owner requirement of 2026-10-26 (v5), after the generation phase was built with two levels: "non possiamo dare un limite di livelli se necessario aggiungerne uno nuovo … quando necessario dobbiamo essere in grado di avere più livelli e sottolivelli per capire pezzo per pezzo". Then, choosing among the options: "qualsiasi pezzo diventa smontabile su richiesta, a qualunque profondità, finché la fonte lo permette. Voglio che sia così".
- Phase `generation` code (D9's generator and evaluation tooling, D10's Studio) was implemented under v4 on 2026-10-26; see the [implementation record](#phase-generation-d9d10). No live generation has run yet.
- Depth today (static inspection, 2026-10-26):
  - layout, learner state, the player and its breadcrumbs already work at any depth;
  - the contract caps depth at three levels, because the schema nests explicitly;
  - generation produces two levels.
- Measured on the fixtures (2026-10-26):
  - **sub-levels do not always account for their parent's lines.** Lines the parent cites but no sub-part or sub-level joint cites: Atlas 9 lines in 3 parts, Mill 14 in 1, Kessmouth 1. In the private fixtures, 1–31 per part.
  - **Lines per leaf part:** median 6 (Atlas), 10 (Mill), 2 (Kessmouth), 9–54 in the private ones.
- The evaluation runner (`eval/runner.ts`) already exists. It has `--allow-chatgpt`, `--list-models` and private cases in `.local/eval/cases/`, and a cap of 2 attempts per case in `eval/policy.ts`. It measures lessons only.
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
- Owner requests of 2026-10-26 (v6), after the D9 comparison. On the three generation improvements proposed by the agent: "Si". Then, in the owner's words:
  - "Ogni pezzo e la relativa descrizione sembra ripetuta: tra bullet point e la descrizione sopra. Quindi la descrizione la terrei breve (magari come incipit), ed a completare i bullet point per i dettagli";
  - "Serve lasciare la possibilità all'utente di ingrandire la griglia con i blocchi … degli split panel, che abbassando verso il basso, ingrandisce la dimensione dei blocchi e della griglia. Stessa cosa per sezione smontaggio. Sezione fonte la ridurrei di dimensione, con possibilità di ingrandire";
  - "La fonte deve avere bottone per visualizzare file .md, come in un editor dedicato, che è in grado di visualizzare rendering .md e flowchart, mermaid, etc";
  - "I numeri dei pezzi sono fuorvianti … Mi serve numerarli per ordine logico del workflow e della linea di ragionamento";
  - "manca tipo una freccia per tornare al livello precedente dai blocchi smontati";
  - then, in a later message: "quando si aggiunge la fonte per la scomposizione … l'AI suggerisca tramite UI all'utente la domanda che si vuole porre per la generazione. Tipo dei suggested break-downs".
- What the code does today, for those requests (static inspection and the D9 outputs, 2026-10-26):

| Request | Where | Today |
|---|---|---|
| Lead and points repeat | `STRUCTURE_INSTRUCTIONS`, `CONTENT_INSTRUCTIONS` in `src/core/disassembly-generation.ts`; `PartCard.tsx` | The structure phase writes `role` as "one sentence on what it does", with no length limit beyond the contract's 2000 characters. The content phase writes the points without seeing a rule against restating it. In setup A's Mill output, roles run 149–238 characters, and the first two points of the first part restate its role clause by clause. The card shows the role, then the points |
| Numbers | `Sheet.tsx` balloons, `PartCard.tsx` eyebrow, `BillOfMaterials.tsx` | The number is the part's position in the stored array. The layout ranks parts along the joints (`layoutLevel` in `src/core/layout.ts`), so the drawing's order and the numbers can disagree. Reassembly already hides the numbers |
| Back to the level above | `DisassemblyPlayer.tsx` | Only the breadcrumbs, above the mode tabs, lead back. The sheet and the card have no control for it, and no key does it |
| Pane sizes | `disassembly.css` | The sheet takes the full width, capped at 1.15× its layout width. The card and the source sit below it in a fixed 1.15 : 1 grid. The source list is capped at 60% of the window height. Nothing can be resized |
| Rendered markdown | `SourcePane.tsx` | Numbered plain lines only. No markdown or diagram rendering exists, and no dependency for it is installed. The renderer runs with `contextIsolation`, `sandbox` and `webSecurity` on |
| Failures over a few characters | `withRepair` in `src/desktop/generator.ts`; comparison report | Half of the failed D9 attempts were lengths 1–20 characters over a limit after the one repair. The schema sent to the model has no `maxLength`; zod applies it afterwards |
| A failed generation is lost | `Generator.generate` | Nothing is kept until the final validation. The first failing part aborts the other parts, and a retry starts again from the structure |
| Choosing the question | `Studio.tsx`, step 2 of 3 | A blank field with one fixed example as placeholder. The question decides which parts open and which stay closed, but the app gives no help in writing it |
| Waiting | `Studio.tsx` | A progress bar with the phase and the request count, for about 4 minutes with setup A. The structure is known after the first phase but not shown |

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
- **Depth guided by the source (v5).** Levels are recursive, with no fixed limit. Two rules stop the descent:
  - a part can be taken apart only when it cites enough lines of its own;
  - each level must account for its parent's lines, the bill of materials applied part by part.
- **Taking a part apart on demand (v5).** The first generation gives the top level and the sub-levels the question needs. Any divisible part can then be taken apart from its card, at any depth, with one small request carrying only that part's lines. Progress carries over to the deeper version.
- **A model per phase.** A generation setup names one model for the structure and one for content and runs; they may be the same. The comparison in D9 chooses the default setup.
- **What "cheaper" means here.** The ChatGPT route uses the learner's plan through Sign in with ChatGPT, not the paid API. Cost is plan usage, the number of requests and waiting time, not a price per token. The comparison reports requests, characters sent and received, and time.
- **Prepared examples.** The two public prototype disassemblies become fixtures: the Atlas Reader runbook and Mill's harm principle. Mill's text is in the public domain. Both get an English version as well. Their sources are English already, so only the disassembly is written again.
- **Lessons become legacy.** Saved generated lessons stay readable in a "Percorsi precedenti" section, with their progress. They are not converted. New generation produces only disassemblies.
- **Two later phases, for repositories and for PDF documents.** Both are gated on the generation results. Both produce a scoped snapshot that the contract records, and a file- or page-level bill of materials.
- **Usability of the player (v6).** Numbers follow the line of reasoning, a control leads back to the level above, the drawing, the card and the source can be resized, and markdown sources can be read rendered, with their diagrams.
- **Usability of generation (v6).** Suggested break-downs when the source is added, a short lead with the details in the points, a cheap second repair for lengths only, a failed generation kept and resumed, and the drawing shown as soon as the structure is accepted. None of these changes the stored format.

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
- A part is divisible when its own citations cover at least **6 non-blank lines**. With fewer, 3 sub-parts would split single lines. On the fixtures, 8 of 15 Atlas leaves, 8 of 11 Mill leaves and none of Kessmouth's could be taken apart further, as expected for a story of short events.
- Taking a part apart uses the structure model of the current Studio setup: deciding how a part splits is structural work.
- Prepared examples are not taken apart further. They are bundled read-only, and expanding one would mean storing a generated copy. This can be added later.
- Runs stay on top-level parts. A deeper level has no runs of its own in this plan.
- **Reading order (v6).** The numbers follow the arrows: a part comes before the parts its joints lead to. For a mechanism, that is the order of the flow; for an argument, grounds come before what they support, up to the conclusion; `depends-on` puts the dependency first, as the layout already does. Parts that only attack or limit another are numbered right after it; parts without joints come last. Ties keep the drawing's order across a rank.
- **"Sezione smontaggio" (v6)** is read as the card of the open part, beside the source. The owner can correct this before approval.
- **Pane sizes (v6)** are a per-device convenience, saved in the renderer's local storage and not in the settings file. A reset returns to the defaults.
- **Rendered view (v6)** is offered for every prose source, not for code. Plain text renders as paragraphs, so it does no harm; markdown gets headings, lists, tables and diagrams. Raw HTML inside the source is shown as text, never run.
- **Saved disassemblies keep their wording (v6).** The short lead applies to new generations and expansions. Saved ones are not rewritten, and the card does not hide points that repeat the role.
- **Suggestions only on request (v6).** The owner chose a button: "Preferisco che i suggerimenti arrivino solo premendo un bottone". Entering the question step sends nothing.
- **One kept generation (v6).** Only the latest failed or cancelled generation is kept for resuming. A new generation discards it. A change of sources, question or language means it is not offered; a change of model does not, since what was kept is already validated.
- ChatGPT evaluation keeps the opt-in flag. The 2-attempts-per-case cap now applies per setup, within the run budget of D9.
- The comparison uses the models the account lists at run time. It picks the strongest and the cheapest available, by the account's own naming, and records their exact slugs in the report. No model name is assumed in this plan.
- The owner's work document is used only after the owner confirms that company policy allows sending it to OpenAI. Otherwise it runs only on the local route, and the source never leaves the Mac.

## Ordered tasks

### Phase contract

#### D1 — Disassembly contract and host checks

- Purpose: one validated format that the player, the store and generation share.
- Action:
  - Add `disassemblySchema` v1:
    - metadata as in lessons: id, revision, kind, generation, title, question, language;
    - sources with full text and sha256;
    - `whole`.
  - Recursive `parts`, depth ≤ 3, 3–7 per level (v5: D13 removes the depth limit). Each part has:
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

#### D9 — Two-phase generation, evaluation and model comparison

- Purpose: generate what the prototype showed, measure it, and choose which ChatGPT setup gives good disassemblies at the lowest plan usage.
- Action, generation:
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
  - **Setup.** The generator takes a setup with a structure route and a content route. Each route is ChatGPT with a model slug, or a local model; the two may differ.
  - Progress shows the phases ("Distinta" / "Bill of materials", then "Pezzo k di n" / "Part k of n", then "Prove" / "Runs"). Cancellation between phases saves nothing.
- Action, evaluation (`npm run eval`, adapted to disassemblies):
  - **Cases.** Four public cases, one per kind of material:
    - the Atlas runbook (mechanism);
    - Mill's harm principle (argument);
    - the Kessmouth story (story, in English);
    - this repository's core pipeline (code).

    Private cases in `.local/eval/cases/` run only when named, and their outputs stay in `.local/`.
  - **Automated metrics per attempt:**
    - valid after the allowed repairs, and the number of repairs by phase;
    - forgotten lines, which must be 0;
    - layout findings from D2, which must be 0;
    - content language matching the request;
    - the answer-length giveaway;
    - the kinds of joint used, parts per level and depth;
    - requests, characters sent and received, and time per phase.
  - **Claim review by the owner, blind.** For each case and setup, the review lists every top-level part's points and every run explanation with its cited lines. Each point is marked correct, imprecise or wrong according to the source. The setups appear as A, B and C, without model names, so the reading is not biased. The review adds a 1–5 "would I use it" rating for the exploded view and for the runs.
  - The report is written under `.local/eval/runs/`. A summary, with no private content, is recorded in this plan's folder.
- Action, model comparison on ChatGPT:
  - **Setup A:** the strongest listed model on every phase.
  - **Setup B:** the cheapest listed model on every phase.
  - **Setup C (mixed):** the strongest model for the structure; the cheapest for content and runs.
  - **Run budget, opt-in with `--allow-chatgpt`:**
    - 3 setups × 4 public cases × 2 attempts = 24 generations;
    - up to 4 more generations to replace attempts lost to a network or service error;
    - up to 2 generations on the owner's private document, below;
    - **at most 30 ChatGPT generations in total**, about 150–270 requests at 5–9 requests each;
    - plus **up to 4 expansions** (D14), one per public case, at 1–2 requests each;
    - stop at the first usage-limit response, and report what was measured.

    The runner enforces the budget in `eval/policy.ts`.
  - **Decision rule:** the default is the cheapest setup that meets the acceptance below. On a tie, the mixed setup wins over A. If only A meets it, A becomes the default, and the report says what B and C missed.
- Action, the owner's work document (private, local-only):
  - The owner places the markdown file and a goal in `.local/eval/cases/`. It is never committed, and public notes describe it only generically, as a private architecture document.
  - **Gate:** the owner states in chat that company policy allows sending it to OpenAI. Until then it runs only on the local route.
  - It runs with the default setup and is reviewed by the owner with the same rubric. It uses the 2 generations reserved for it in the budget, and it is not part of the acceptance.
- Acceptance:
  - The chosen setup is valid in at least 6 of its 8 public attempts (2 per case).
  - Every valid result has 0 forgotten lines and 0 layout findings, and its content is in the requested language.
  - The claim review of the chosen setup shows no more wrong points than setup A on the same cases, and no more than the lesson baseline (0 wrong claims in 3 lessons).
  - The local route is measured on the public cases and reported, not gated.
  - The numbers, the chosen setup with its exact model slugs, and the review summary are recorded in this plan's folder.
  - If no setup meets the acceptance, the plan stops before D10 and the owner decides; the bar is not lowered silently.
- Evidence: contract tests for each phase's schema, assembly and setup routing; the evaluation reports; the claim reviews; a comparison note.
- Order (v5): the generator and the evaluation tooling are done. **The model comparison runs after D13 and D14**, so it measures the generator that ships, including expansions.
- Dependencies: D1, D2.

### Phase depth

#### D13 — Depth guided by the source

- Purpose: any part can open into sub-parts at any depth, as long as the source has lines to take apart. Owner requirement of 2026-10-26 (v5).
- Action:
  - **Recursive parts.** `parts` become truly recursive, with no fixed depth.
    - The 3–7 rule, the length rules and the joint rules apply at every level.
    - Top-level parts keep their points; deeper parts keep one sentence.
    - Files written under the three-level schema stay valid, so `schemaVersion` does not change.
  - **Stopping rule.** A part is *divisible* when its own citations cover at least `DISASSEMBLY_LIMITS.minLinesToSplit` non-blank lines (6).
    - A level under a part that is not divisible is a located finding.
    - The player says why such a part cannot be taken apart further, and shows its line count.
  - **Bill of materials per part.** A part with sub-parts accounts for every non-blank line it cites. Each line is:
    - in a sub-part;
    - in a joint of that level;
    - or in the part's own optional `excluded` list, with a reason: `context`, `repetition`, `detail` or `outside-question`.

    Findings name the part and the range, as the whole-source check does. The existing fixtures, public and private, get part-level exclusions where their sub-levels leave lines uncovered.
  - **Expansion record.** An optional `expansions` list records, for each part taken apart after generation, the part, provider, model and time. The stored origin of every level stays visible.
  - **Revisions and progress.** Taking a part apart saves a new revision and keeps the previous file.
    - The host checks that the new revision is an *expansion* of the old one: identical, except that one part without sub-parts gains sub-parts, their joints, its own exclusions and an `expansions` entry.
    - When it is, the learner state moves to the new revision with everything kept: open path, runs, tried bricks, reassembly, notes. Otherwise the D3 rules apply.
    - The store lists only the latest revision of each disassembly.
  - Layout, state paths and breadcrumbs already work at any depth. Tests at depth 5 confirm it.
- Acceptance:
  - A synthetic disassembly five levels deep validates, lays out every level without geometry findings, and opens down to the deepest level and back through the breadcrumbs.
  - The stopping rule and the per-part bill of materials each have contract tests with located findings.
  - Every fixture, public and private, validates under the new rules, with 0 forgotten lines per source and per part.
  - An expanded revision keeps run steps, tried bricks, reassembly placements, notes and the open path after a restart. A change that is not an expansion still resets, with the D3 notice.
  - The library shows one card per disassembly after an expansion.
- Evidence: `tests/disassembly.test.ts`, `tests/layout.test.ts`, `tests/disassembly-state.test.ts`, `tests/disassembly-store.test.ts`, `tests/progress-store.test.ts`.
- Dependencies: D1, D2, D3, D8.

#### D14 — Take a part apart on demand

- Purpose: "Smonta questo pezzo" / "Take this part apart". The learner goes as deep as they need and pays only for what they open.
- Action:
  - The first generation (D9) keeps its shape: top-level parts and the sub-levels the question needs. Its structure phase also applies D13's rules.
  - **The action.** The card of a divisible part without sub-parts, in a generated disassembly, offers the action, in the desktop app only. It shows that it sends one request, and to which route.
  - **One request, one repair.**
    - The request carries:
      - the question and the content language;
      - the path from the whole to the part, with the part names of each level on that path, as context;
      - the part's role and explanation;
      - only the part's lines.
    - It returns:
      - 3–7 sub-parts with kind, icon, name, role, a one-sentence explanation, an optional critique and citations;
      - their joints;
      - the part's own exclusions.

    One level is small, so structure and content arrive together. The schema's source ids are a closed list of the part's sources.
  - **Checks:** D13's rules, the language check, and citations inside the part's own lines. One repair with located findings, as in D9.
  - **Route:** the structure model of the current Studio setup, ChatGPT or local. Progress, cancellation and the one-at-a-time rule are as for generation. On failure nothing changes, and the summary and findings are shown as in D10.
  - Runs and reassembly are not regenerated.
- Action, evaluation:
  - `npm run eval -- --expand` takes apart one divisible part per public case on the first valid attempt of a setup. That is 4 expansions, each 1–2 requests.
  - The report records validity, repairs, forgotten lines per part (must be 0), layout findings (must be 0) and the language.
  - The blind review sheet lists the new sub-parts with their cited lines.
- Acceptance:
  - Tests:
    - an expansion request carries only the part's lines;
    - a valid answer adds the level, saves a new revision and moves the progress;
    - a forgotten line or a split of a non-divisible part is repaired once, then refused;
    - cancellation and failure change nothing.
  - On ChatGPT, with the default setup chosen in D9, at least 3 of the 4 public expansions are valid, with 0 forgotten lines and 0 layout findings. They are claim-reviewed with the same rubric, with no more wrong points than setup A's top level.
  - The local route is measured and reported, not gated.
- Evidence: `tests/disassembly-generation.test.ts`, `tests/disassembly-player.test.tsx`, evaluation report.
- Dependencies: D9, D13.

#### D10 — Studio flow and witnessed generation

- Purpose: generation inside the app, end to end.
- Action:
  - Studio generates a disassembly with phase progress and the request count, and lets the learner set the content language before generating.
  - The default setup chosen in D9 is preselected. An advanced choice lets the learner pick the structure model and the content model separately.
  - New generation produces only disassemblies. Saved lessons stay readable under "Earlier paths".
  - A failure shows a summary in the interface language and the located findings as technical detail. The validator's findings stay in English, because they also go back to the model as repair instructions.
  - The result opens in the player.
- Acceptance:
  - A witnessed desktop generation on each route (ChatGPT and the chosen local model) from a public case, then a restart with the disassembly and its progress intact. This is the evidence P-20261021 T5 asked for, now for disassemblies.
  - One of the witnessed generations has an English question under an Italian interface, and produces English content.
  - In one witnessed generation, a part is taken apart on demand two levels below the top. After a restart, the deeper levels and the earlier progress are intact.
- Evidence: `tests/studio.test.tsx` updated; a witnessed note.
- Dependencies: D8, D9, D14.

### Phase player-usability

Order: D15 → D16 → D17 → D18. Each task is usable on its own; D18 waits for its dependencies to be added.

#### D15 — Numbers in reading order

- Purpose: a part's number says where it sits in the line of reasoning, not where it was stored. Owner request: "Mi serve numerarli per ordine logico del workflow e della linea di ragionamento".
- Action:
  - **Reading order in the core.** `layoutLevel` also returns `order`, the part ids of the level in reading order, by the rule in the assumptions:
    - by rank along the joints, as the layout already computes them, cycles broken the same way;
    - within a rank, in the drawing's order across it;
    - a side part right after its host;
    - parts without joints last.

    It is pure and deterministic, like the rest of the layout.
  - **Every number uses it:** the sheet's balloons and plate labels for screen readers, the card's "Part 3 of 7", and the bill of materials, whose numbers become paths in reading order ("2.1.3"). Plates are drawn and focused in that order, so the Tab key follows the numbers.
  - **The sheet says what the numbers mean.** The title block reads "numbers: reading order" in the interface language.
  - **Generation speaks the same order.** The content and runs inputs list the parts in reading order, with their numbers, so a run step or a slot hint that names a number matches the drawing.
  - Reassembly keeps hiding the numbers.
- Acceptance:
  - Core tests: on Atlas, the order follows the flow; on Mill, grounds come before the principle and the principle before its consequences, and a part that only attacks or limits follows its host; on Kessmouth, the order of events; a rollback cycle and a part without joints are placed by the rule. Every level of every fixture gets a permutation of its parts.
  - Player tests: a balloon's number, the plate's accessible name, the card's eyebrow and the bill of materials agree for the same part, in both languages.
  - A generation test: the content and runs inputs list parts in reading order.
- Evidence: `tests/layout.test.ts`, `tests/disassembly-player.test.tsx`, `tests/disassembly-generation.test.ts`.
- Dependencies: D2, D5, D7.

#### D16 — Back to the level above

- Purpose: leave a sub-assembly from where the eyes are, not only from the breadcrumbs. Owner request: "manca tipo una freccia per tornare al livello precedente dai blocchi smontati".
- Action:
  - Below the top level, the drawing pane shows a back control at its top left, with an arrow and the name of the level above ("↑ Pipeline di rilascio"). The card of an open sub-assembly shows the same action.
  - Escape and Alt+↑ also go up one level, except while the learner types in a field.
  - Going up selects the part that was just left and moves focus to its plate, so the learner keeps their place.
  - At the top level the control is not shown. Runs and reassembly already work on the top level, so it appears in the exploded view only.
- Acceptance: player tests, in both languages:
  - the control appears only below the top level and names the level above;
  - the control, Escape and Alt+↑ each go up exactly one level, select the part left and focus its plate;
  - Escape in the notes field does not leave the level;
  - a test at depth 5 goes back to the top one level at a time.
- Evidence: `tests/disassembly-player.test.tsx`, `tests/depth.test.ts`.
- Dependencies: D5, D13.

#### D17 — Resizable drawing, card and source

- Purpose: the learner chooses how much room the drawing takes, and makes the plates bigger when they need to read them. Owner request: "degli split panel, che abbassando verso il basso, ingrandisce la dimensione dei blocchi e della griglia … Sezione fonte la ridurrei di dimensione, con possibilità di ingrandire".
- Action:
  - **Two splitters**, in the exploded view and in runs:
    - a horizontal one between the drawing and the row below it. Dragging it down makes the drawing pane taller;
    - a vertical one between the card (or the run panel) and the source.
  - **The drawing grows with its pane.** The sheet fits the pane in both directions, with no 1.15× cap, so a taller pane draws bigger plates and text. When the fit would draw text smaller than today, the drawing scrolls sideways, as it does now.
  - **A narrower source by default.** The source starts at about a third of the row, against about half today. A button in its header widens it to the whole row and back.
  - **The bill of materials** gets the same vertical splitter between its table and the source.
  - **Keyboard and screen readers.** Each splitter is a `separator` with its orientation and current value. Arrow keys move it by 5%, Home and End go to the limits, Enter or a double click resets it. Minimum sizes keep every pane usable: 200 px for the drawing, 280 px for the card, 240 px for the source.
  - **Remembered per device.** Sizes are saved in the renderer's local storage and restored. When storage is unavailable or holds bad values, the defaults apply.
  - Under 900 px of width the panes stack as today, without splitters.
  - A small `SplitPane` component in `src/renderer`, with pointer capture for dragging. No dependency.
- Acceptance:
  - Component tests: keyboard moves stay within the limits, sizes are saved and restored, reset works, and failing or invalid storage gives the defaults.
  - Player tests: the source's widen button, and the splitters present in the exploded view, runs and the bill of materials but not under 900 px.
  - Witnessed by the owner in the desktop app, on Atlas and on the generated disassembly of the work document, in both themes: dragging the drawing pane down makes the plates readable.
- Evidence: `tests/split-pane.test.tsx` (new), `tests/disassembly-player.test.tsx`, a witnessed note.
- Dependencies: D5, D6, D7.

#### D18 — Rendered view of a markdown source

- Purpose: read a markdown source as a document, with its tables and diagrams, and still see which lines a part cites. Owner request: "La fonte deve avere bottone per visualizzare file .md, come in un editor dedicato … rendering .md e flowchart, mermaid".
- Action:
  - **Two views of a prose source.** The source header gets a switch, "Lines | Document". Code sources keep the lines only. The choice is remembered per source while the disassembly is open.
  - **A full-window reader.** An "Open" button shows the document in a dialog over the player, with an outline of its headings on the side. Escape closes it and returns focus to the button.
  - **Rendering.**
    - Markdown is rendered with `markdown-it`, with raw HTML off, so HTML inside a source shows as text and never runs.
    - Tables and strikethrough are rendered; code blocks show as code.
    - Fences tagged `mermaid` are drawn by `mermaid`, loaded on first use as a separate chunk, with `securityLevel: 'strict'` and a theme for paper and one for blueprint. A diagram that does not parse shows its code with a short note.
    - Links are not followed inside the app; their address shows on hover. Images are not fetched; their alt text shows. Nothing leaves the Mac.
  - **Citations still work.** `markdown-it` gives each block the source lines it came from. The rendered blocks carry those ranges, so the focused citation highlights its blocks and scrolls to the first, and the open part's cited blocks are shaded as in the line view.
  - **Dependencies.** `markdown-it`, `mermaid` and the dev dependency `@types/markdown-it`. Exact versions pinned, each the latest stable release at least two weeks old, recorded in `package-lock.json`. The build records the size of the main bundle and of the diagram chunk.
- Acceptance:
  - Tests:
    - headings, lists, tables and code render;
    - a `<script>` or an `<img onerror>` in a source renders as text;
    - the blocks' line ranges match the source, and a citation highlights the right blocks;
    - a mermaid fence calls the diagram renderer, which is mocked in jsdom, and a failing one shows its code;
    - the dialog closes on Escape and returns focus;
    - code sources have no switch.
  - `npm run build` passes. The main bundle grows by no more than 150 kB; the diagram library loads only when a diagram is shown.
  - Witnessed by the owner: the work document opens rendered, with its four diagrams and its tables, and a citation highlights its block.
- Evidence: `tests/source-document.test.tsx` (new), `tests/disassembly-player.test.tsx`, the build output, a witnessed note.
- Dependencies: D5. The dependencies are added only under the v6 approval, which names them.

### Phase generation-usability

Order: D19 → D20 → D21 → D22 → D23. D10's witnessed generations are best done after this phase, because it changes Studio.

#### D19 — A second repair, for lengths only

- Purpose: stop failing a 4-minute generation over a few characters. In D9, half of the failed attempts were 1–20 characters over a limit after the one repair.
- Action:
  - After the one repair, when **every** remaining finding of a phase is a length finding, the host sends one small "shorten" request:
    - it carries only the over-long texts, each with its path, its length and its limit, and the content language;
    - the answer's schema is a closed list of those paths, each with a replacement text.
  - The host puts the replacements in place and checks the whole phase again. Any finding left, of any kind, fails the phase as today.
  - It applies to the structure, content and runs phases and to taking a part apart, on both routes. It counts as a repair in the statistics. Progress says "shortening texts".
  - A mix of length and other findings gets no shorten request: the other findings mean the draft is wrong, not long.
- Acceptance: scripted tests:
  - a part 3 characters over its limit after the repair is shortened with one more request and accepted;
  - an answer that leaves out a path, adds one, or is still over the limit is refused;
  - a mix of findings sends no shorten request;
  - cancelling during the shorten request changes nothing.
- Evidence: `tests/disassembly-generation.test.ts`, `tests/provider.test.ts`.
- Dependencies: D9, D14.

#### D20 — A short lead, the details in the points

- Purpose: the card says each thing once. The lead says what the part is for; the points add how and why. Owner request: "la descrizione la terrei breve (magari come incipit), ed a completare i bullet point per i dettagli".
- Action:
  - **Instructions.**
    - Every `role` becomes a lead of at most 100 characters: what the part is for in the whole.
    - The points of a top-level part, and the explanation of a sub-part, add details the lead does not give: steps, conditions, limits, consequences. They must not say the lead again.
    - The same applies to taking a part apart.
  - **Host checks, on new generations and expansions only:**
    - a lead over 100 characters is a length finding, so D19 can shorten it;
    - a point, or a sub-part's explanation, that restates the lead is a located finding. "Restates" is measured as word overlap, in the same language-independent way as `givesAway`, with a threshold calibrated on the D9 outputs.

    The contract does not change, so saved disassemblies and the fixtures stay valid.
  - **The card** shows the lead as an opening line in a stronger style, then the points.
- Acceptance:
  - Tests: the restate check flags the repeated points of the D9 Mill output of setup A, and none of the hand-made fixtures' points; a long lead is shortened by D19.
  - **Live check, within the remaining budget:** setup A, one attempt on each of the four public cases, which are the 4 public generations left in D9's budget. Required:
    - at least 3 of 4 valid;
    - every lead at most 100 characters;
    - no point flagged as restating its lead.

    The report also records how many attempts D19's shorten request saved.
- Evidence: `tests/disassembly-generation.test.ts`, `tests/disassembly-player.test.tsx`, evaluation report.
- Dependencies: D19.

#### D21 — Keep a failed generation and resume it

- Purpose: a failure late in a generation no longer costs the whole generation.
- Action:
  - **The host keeps a draft** after each accepted step: the structure, each accepted part, and the runs.
    - One file, `generation-draft.json`, in the app's data folder, written atomically.
    - It holds the request (source ids and their sha256, question, language, setup), what was accepted, and the statistics so far.
    - It is deleted on success, on "Start over", and when a new generation starts.
  - **Parts no longer stop each other.** When one part fails, the parts already running finish and are kept. Cancelling still stops everything at once, and keeps what was accepted.
  - **Studio offers to resume.** After a failure or a cancellation, and after a restart, Studio says what was kept, for example "structure and 5 of 7 parts kept". It then offers:
    - "Resume": only the missing parts, then the runs;
    - "Start over".

    Resume is offered only when the selected sources, their content, the question and the language are the same as in the draft. A different model may finish it. The kept structure is already validated.
  - A draft file that cannot be read is set aside with a notice, and generation starts fresh.
- Acceptance: scripted tests:
  - one part fails twice: the other parts are kept, and resuming sends one content request and the runs request;
  - the runs phase fails: resuming sends only the runs request;
  - a changed source, question or language offers only a fresh start;
  - a cancellation keeps what was accepted; a success deletes the draft; an unreadable draft is set aside;
  - Studio shows both actions and what was kept, in both languages, and again after a restart.
- Evidence: `tests/provider.test.ts`, `tests/studio.test.tsx`, a new `tests/generation-draft.test.ts`.
- Dependencies: D9, D10.

#### D22 — The drawing while it is written

- Purpose: the wait becomes reading. With setup A a generation takes about 4 minutes, and the structure is known after the first.
- Action:
  - Once the structure is accepted, progress carries a **preview** of the top level:
    - parts (id, name, kind, icon, number of sub-parts) and joints;
    - each part's status: waiting, writing, done or failed;
    - for each part that is done, its lead and points.

    The preview has a bounded schema in `src/core/provider.ts`. The preload drops a preview that does not parse, and keeps the rest of the progress.
  - **Studio draws the top level** with the same layout and sheet as the player. Plates show their status with the existing state marks. A finished part can be opened to read its lead and points. The phase line stays above the drawing. During the runs phase every plate is done, and the line says the runs are being prepared.
  - A resumed generation (D21) starts its preview from the kept draft.
  - Reduced motion: statuses change without animation.
- Acceptance:
  - Studio tests with a scripted bridge: the drawing appears after the structure; statuses change part by part; a finished part opens its lead and points; a failed part shows ✕; a resumed generation starts with its kept parts done.
  - The preview schema refuses malformed and oversized previews.
  - Witnessed by the owner during one live generation, which can be one of D10's.
- Evidence: `tests/studio.test.tsx`, `tests/provider.test.ts`, a witnessed note.
- Dependencies: D2, D5, D21.

#### D23 — Suggested break-downs

- Purpose: the learner does not start from a blank question. After reading the source, the app proposes a few ways to take it apart, and the learner picks one or writes their own. Owner request of 2026-10-26: "quando si aggiunge la fonte per la scomposizione … l'AI suggerisca tramite UI all'utente la domanda che si vuole porre per la generazione. Tipo dei suggested break-downs".
- Action:
  - **When: only on request.** The question step shows a "Suggest break-downs" button, in the desktop app only. The button says that it sends one request and to which route. Nothing is sent until the learner presses it, and the request can be cancelled. The question field stays usable while it runs.
    - Suggestions are kept per selection, keyed by the sources' sha256. Going back and forth between steps shows them again without a new request.
    - "Other suggestions" asks again, sending the earlier questions so the new ones differ.
  - **One request, one repair.** The request carries the sources as the structure request does, the content language currently chosen, and the learner's prior knowledge when given. It returns 3–5 suggested break-downs, each with:
    - a question, at most 160 characters, that passes the question format check;
    - the kind of joint it would follow: mechanism, argument or story;
    - the 3–7 top-level parts it would give, by name only;
    - the line ranges it rests on, inside the sources.
  - **Checks.**
    - Questions must be distinct, in the content language, and must not repeat each other's parts wholesale.
    - The cited ranges must exist in the sources.
    - D19's shorten request applies to lengths.
  - **The cards.** Each suggestion is a card with its question, its kind and the part names as a short preview. Choosing one fills the question field, where the learner can still edit it; the content language follows it.
  - **Route.** The content model of the current setup: suggesting is short work and needs no structure model. The busy and cancel rules are those of generation. Starting a generation cancels a suggestion request still running.
  - **Failure.** A failed or cancelled request leaves the question step as it is today, with a short notice. Nothing blocks the learner from writing their own question.
  - Suggestions are not stored with the disassembly. Only the question the learner sends is stored, as today.
- Acceptance:
  - Scripted tests:
    - no request is sent until the button is pressed;
    - a valid answer gives 3–5 cards;
    - duplicate questions, a question in the other language or a range outside the sources is repaired once, then refused with a notice;
    - choosing a card fills the field, and the text stays editable;
    - suggestions are reused for the same selection and asked again after a source changes;
    - cancelling, and starting a generation, stop the request;
    - the browser preview shows no suggestions.
  - Studio tests in both interface languages.
  - Witnessed by the owner in the desktop app, on a public case and on the work document: the suggestions arrive, and at least one of them leads to a valid generation. These are the owner's own uses, not evaluation runs, so they do not draw on D9's budget.
- Evidence: `tests/disassembly-generation.test.ts`, `tests/provider.test.ts`, `tests/studio.test.tsx`, a witnessed note.
- Dependencies: D10, D19.

### Phase identity

Order: D24 → D25 → D26 → D27. Source of the decision: the owner's message of 2026-10-27, "Voglio che l'identità, il logo e la UI sia questa", pointing at a launch review prepared outside the repository (identity concept 01, its SVG mark and wordmark, and two static UI proposals). That review is reference material; this phase builds the identity in the repository.

#### D24 — Brand assets

- Purpose: one source of truth for the mark, used by the app, the README and the social card.
- Action:
  - `docs/images/brand/`: `mark.svg` (navy bars, terracotta piece, pale-blue link), `mark-blueprint.svg` (pale bars for dark backgrounds), `wordmark.svg` and `wordmark-blueprint.svg` (mark, "Break the Wall", "Take the text apart."), `app-icon.svg` (the mark in light bars on a navy rounded square).
  - Geometry from the review's mark: bars 54 × 12 on a 104 × 88 grid, the second bar shortened to 36, a link from its end to the extracted piece. Colours: navy `#102B46`, terracotta `#D96B4B`, pale blue `#91A9BE`/`#ADC4D7`, paper `#F6F3EC`.
  - `assets/icon.png` (1024 × 1024) rendered from `app-icon.svg` by a script that uses the Electron already installed (`scripts/brand.mjs`), so the PNG can be regenerated.
- Acceptance: the SVGs are hand-readable and valid; the mark reads at 16, 32 and 64 px (checked by rendering, recorded with a contact sheet); the icon is regenerated by one command.
- Evidence: the files; a contact sheet in the implementation record.
- Dependencies: none.

#### D25 — The mark and tagline in the header

- Purpose: the app says who it is the same way the repository does.
- Action:
  - `Brand` in `src/renderer/icons.tsx` draws the new mark inline: bars in the text colour, the link and the piece from two new theme tokens (`--brand-link`, `--brand-piece`), so paper and blueprint both work. The piece is decorative: never text, never the only cue.
  - Tagline in both catalogs: "Take the text apart." and "Smonta il testo.", replacing "One concept at a time" / "Un concetto alla volta".
  - Both themes keep their palette: paper stays paper, and blueprint keeps its blue (owner, 2026-10-27: "Mantiene il blu della blueprint e aggiunge un accento terracotta"). Terracotta is added as the brand accent in both themes, through `--brand-piece`: the piece pulled out of the mark, and only there. The technical drawing stays the app's signature, and the colours of the joint families and states do not change (owner: "userei il terracotta nel logo, mantenendo i colori già assegnati ai collegamenti").
  - Same size and place as today's brand, so no layout around it moves.
- Acceptance: tests check the brand's accessible name and tagline in both interface languages; the contrast test still passes for every text token; a browser-preview check in both themes at 1280 px and 720 px wide.
- Evidence: `tests/i18n.test.tsx`, `tests/theme.test.ts`, screenshots in the implementation record.
- Dependencies: D24.

#### D26 — The home's opening

- Purpose: the first screen states the product in the identity's words.
- Action: the library's opening becomes eyebrow "Start with a source" / "Parti da una fonte", title "Take the text apart." / "Smonta il testo.", and the line "Turn a wall of text into parts you can inspect, test and put back together." / "Trasforma un muro di testo in parti da esaminare, mettere alla prova e ricomporre." The rest of the home, the player and Studio do not change: no interaction redesign.
- Acceptance: tests on the home's heading and lines in both languages; catalog parity passes; browser-preview check in both themes.
- Evidence: `tests/i18n.test.tsx` or the library test that covers the home; screenshots.
- Dependencies: D25.

#### D27 — The desktop icon

- Purpose: the app is recognisable in the Dock and the window switcher.
- Action: the host sets the icon from `assets/icon.png`: `app.dock.setIcon` on macOS and the window's `icon` elsewhere. No packaging or signing is added; the icon applies to `npm start` and `npm run dev`.
- Acceptance: the build keeps working; the path resolves from `dist-electron/`; witnessed by the owner in the Dock.
- Evidence: build output; a witnessed note.
- Dependencies: D24.

### Phase presentation

Order: D28 → D29 → D30 → D31, after phase `identity`.

#### D28 — The README with the new identity

- Purpose: the repository page states the problem, shows the product and gives a working way to try it, as the reviewed proposal and the Tabularis reference do.
- Action: the README opens with the wordmark, "Take the text apart.", the line "AI gives you a wall of text. Break the Wall turns it into source-linked parts you can explore, test and put back together.", the alpha facts (open source, macOS, English and Italian, Apache-2.0), links to *Try the alpha*, *How it works*, *Roadmap* and *Contribute*, and the demo. Then *Why*, *How it works* (disassemble, run, reassemble), *Try the alpha* with clone, build and start steps, and the existing detailed sections below. Nothing claims an installer, PDF or repository sources.
- Acceptance: every link and image resolves on GitHub; the clone, build and start steps are run in a fresh clone; no claim beyond the verified status.
- Evidence: the README diff; the fresh-clone run in the implementation record.
- Dependencies: D26.

#### D29 — Demo, screenshots and social card

- Purpose: every image shows the app as it now is.
- Action: record the demo GIF again with the same storyboard as the current one (prepared examples, English interface, paper then blueprint), the blueprint screenshot, and a 1280 × 640 social card with the wordmark, rendered by the same script as the icon. The owner uploads the social card in the repository settings, which the API does not expose.
- Acceptance: no old mark in any image; the GIF stays under 1.5 MB; the social card is exactly 1280 × 640.
- Evidence: the files; frames checked in the implementation record.
- Dependencies: D25, D26, D28.

#### D30 — The GitHub page

- Purpose: the About box and topics say what the README says.
- Action: description "Break down AI walls of text into source-linked parts. Explore connections, test what holds them together, and reassemble. Open-source macOS alpha."; topics limited to 20 and to what is true today; issue #12 (favicon) points at the new mark. Website stays empty until a real one exists.
- Acceptance: the API returns the new description and topics; no topic claims PDF, repositories or other platforms.
- Evidence: the API response in the implementation record.
- Dependencies: D28.

#### D31 — The first release

- Purpose: a stable point people can refer to.
- Action: `CHANGELOG.md` gains the identity under `0.1.0-alpha`; once everything above is merged into `main`, tag `v0.1.0-alpha` and publish a GitHub pre-release with the changelog's notes and the clone steps. No binaries.
- Acceptance: the tag points at the merge commit on `main`; the release page shows the notes and is marked pre-release.
- Evidence: the release URL.
- Dependencies: D28–D30, and the merge of the community files.

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

- D1–D10 and D13–D31 meet their acceptance criteria. D11 and D12 meet them, or the owner moves them to a separate plan.
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
| The terracotta piece is used as text or as a status colour | It is decorative only, through `--brand-piece`; text keeps the theme tokens and the contrast test (D25) |
| The mark does not read at small sizes | Checked at 16, 32 and 64 px before it is used (D24) |
| Images and README drift from the app again | The demo, screenshots and social card are re-recorded after the identity, from the same script and storyboard (D29) |
| Models cannot fill the richer contract reliably | Two phases with app validation between them; per-part repair; ChatGPT first; D9's measured gate before D10 |
| Automatic layout produces cluttered sheets | Geometry tests on all fixtures in D2; length rules in D1; generation sees the limits |
| Legacy lessons break while the app changes underneath | They keep their own schema, store and player; tests load a saved lesson and its progress in D3 and D8 |
| The comparison spends too much of the owner's plan | A fixed run budget, enforced by the runner; opt-in flag; stop at the first usage-limit response |
| A cheap model passes the automated checks but writes wrong points | Blind claim review on every case and setup; the decision rule requires no more wrong points than setup A |
| Company material is sent to OpenAI against policy | The owner's document runs on ChatGPT only after the owner confirms the policy in chat; otherwise local route only; it stays in `.local/` |
| Model names change or disappear from the account | Models are chosen from the account's list at run time; the report records exact slugs |
| More requests per ChatGPT generation (about 5–9) | Request count shown before generating; evaluation is opt-in and capped; content requests carry only one part's lines |
| Deep levels lose the learner | 3–7 parts per level at every depth; breadcrumbs name the path; depth grows only when the learner asks |
| A model over-splits small parts | The host-enforced stopping rule: parts under 6 non-blank lines cannot be taken apart |
| Taking a part apart erases progress | An expansion is checked to be additive, and the learner state moves to the new revision; a non-additive change keeps the D3 reset and notice |
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
| Reading-order numbers disagree with what a model wrote ("step 3") | Generation inputs list parts in reading order with their numbers (D15); saved disassemblies may still say an old number in a run text, an accepted residual risk |
| A rendered source runs code or fetches content | Raw HTML off in `markdown-it`; Mermaid in strict mode; links not followed and images not fetched; tests with hostile markup (D18) |
| The diagram library makes the app slow to open | Loaded on first use as a separate chunk; the main bundle may grow by at most 150 kB (D18) |
| A shorten request changes meaning, not only length | It carries only the over-long texts; the whole phase is checked again; claim review in the live check reads the result (D19–D20) |
| The restate check rejects good points | Calibrated on the D9 outputs and the hand-made fixtures; it is a finding the repair can fix, not an outright refusal (D20) |
| Suggestions spend plan usage | Sent only when the learner presses the button, with the cost shown; reused for the same selection; cancellable (D23) |
| A suggestion steers the learner toward what the model finds easy | Suggestions fill an editable field and never replace it; the learner's own question works as today (D23) |
| A kept draft is resumed against changed sources | Resume requires the same sha256 for every source, the same question and language (D21) |
| Generated text derived from a private source stays on disk after a failure | One draft at most, in the app's data folder next to saved disassemblies, deleted on success, on "Start over" and when a new generation starts (D21) |

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
  - evaluation runs for generation quality, including the three-setup comparison and a blind claim review;
  - witnessed desktop flows for persistence and live generation;
  - for v7: brand and home text tests in both languages, the contrast test, browser-preview screenshots in both themes and two widths, a fresh-clone run of the README's steps, and the owner's witnessed Dock icon;
  - for v6: splitter and dialog keyboard tests, hostile-markup rendering tests, scripted generation tests for the shorten request and the kept draft, and witnessed use of the resized panes, the rendered work document and the drawing during a live generation.
- **Limits:**
  - jsdom does not lay out SVG text, so D2's geometry is tested on computed boxes from the layout module;
  - visual quality is witnessed;
  - evaluation on a small set gives indications, not proof.

## Review and authorization

Self-review is in [review.md](review.md).
- Version 7 adds two phases at the owner's request: `identity` (D24–D27) and `presentation` (D28–D31). The owner chose the identity of a launch review prepared outside the repository: "Voglio che l'identità, il logo e la UI sia questa", then "ed il logo dell'app" and "Una volta finito con la repo, devi rifare il Readme, GIF, etc per rispecchiare la nuova identità". D1–D23 are unchanged, and their evidence stays valid. The phases add no dependency and no interaction change.
- Version 6 adds two phases at the owner's request, after the D9 decision for setup A: `player-usability` (D15–D18) and `generation-usability` (D19–D23). The owner accepted the three generation improvements proposed by the agent ("Si") and asked for five more: lead and points without repetition, resizable panes, a rendered markdown view with diagrams, numbers in reading order, and a way back to the level above. In a later message the owner added suggested break-downs (D23). D1–D14 are unchanged, and their evidence stays valid. D18 needs three dependencies, named in the approval boundary.
- Version 5 removes the fixed depth and adds taking a part apart on demand, at the owner's request: "qualsiasi pezzo diventa smontabile su richiesta, a qualunque profondità, finché la fonte lo permette. Voglio che sia così". It adds phase `depth` (D13–D14) before D9's model comparison, four expansions to the run budget, and an expansion to D10's witnessed flow. D1–D8 are unchanged. The generation code built under v4 stays, and its evidence stays valid.
- Version 4 extends D9 with a comparison of ChatGPT models, including a mixed setup, a run budget and a blind claim review. It also adds a private, local-only case for the owner's work document, and D10's setup choice. Request: "Scrivi il piano v4", after the owner asked which OpenAI models give the best disassemblies, ideally cheaper ones. D1–D8 and D11–D12 are unchanged. D1–D8's evidence stays valid.
- Version 3 adds the English and Italian interface, at the owner's request: "rivedi il piano P-20261024-disassembly in v3 con l'interfaccia multilingua inglese e italiano". It changes D4–D10 and the shared sections, and leaves D1–D3 and D11–D12 unchanged. D1–D3 were implemented under the v2 approval, and their evidence stays valid.
- Version 2 revised v1 after [research R-20261025](../../research/R-20261025-repository-and-document.md). Version 1 was never approved.

**Activation constraint:** only one plan may be active for implementation.
- P-20261021 is `blocked`.
- P-20261022 is `superseded`.

Approval command:

`Approve P-20261024-disassembly v7`

The v6 approval no longer covers the remaining tasks, because v7 is a material change. A later, separate command starts edits, for example:

`implement P-20261024-disassembly v7 --phase identity`

Named phases:
- `contract`: D1–D3, done under v2;
- `player`: D4–D8, done under v3 except D8's witnessed desktop flow;
- `generation`: D9–D10. D9's code and D10's Studio were done under v4; D9's model comparison waits for phase `depth`;
- `depth`: D13–D14, done under v5, with D9's comparison and decision;
- `player-usability`: D15–D18;
- `generation-usability`: D19–D23, done under v6;
- `identity`: D24–D27;
- `presentation`: D28–D31;
- `repository`: D11, gated;
- `document`: D12, gated.

Approval does not authorize:
- ChatGPT runs beyond D9's run budget: 30 generations, that is 24 for the comparison, up to 4 replacements and up to 2 on the owner's private document, plus up to 4 expansions. D20's live check uses the 4 public generations still left in it;
- sending the owner's work document to OpenAI before the owner confirms in chat that company policy allows it;
- model downloads or dependency changes, including a PDF extraction library or an internationalization library. The only exception: D18's `markdown-it`, `mermaid` and the dev dependency `@types/markdown-it`, at exact versions;
- publication beyond the repository: no LinkedIn post, no message to anyone. D30's GitHub settings and D31's tag and release are external changes, each confirmed by the owner right before it is made;
- importing private documents or code into the repository;
- starting D11 or D12 before their gate.

## Approval record

Version 7, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261024-disassembly v7`.
- Approved plan/version: `P-20261024-disassembly` / `7`.
- Recorded at: `2026-10-27T10:06:35+01:00` (Europe/Rome).
- Approved scope:
  - D24–D27 (phase `identity`): brand assets, the mark and tagline in the header, the home's opening, the desktop icon. Terracotta only in the logo; paper and blueprint keep their palettes, and the joint and state colours do not change;
  - D28–D31 (phase `presentation`): the README, demo, screenshots and social card with the new identity, the GitHub page, and the first release;
  - the remaining tasks of earlier versions as written: D8's and D10's witnessed flows, and D11–D12 in their gated phases.

  D1–D7, D9 and D13–D23 are recorded as implemented under earlier versions.
- Approved-content SHA-256: `d216769d6d806000f89a2f4962ab8e4feaef6947014537409fb3aecbdae99381`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Disassemblies` up to, and not including, `## Review and authorization`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized:
  - ChatGPT runs beyond D9's run budget, which is spent;
  - model downloads and dependency changes;
  - D30's GitHub settings and D31's tag and release without the owner's confirmation right before each one;
  - publication beyond the repository, such as a LinkedIn post;
  - importing private documents or code into the repository;
  - starting D11 or D12 before their gate.

Version 6, approved and superseded by v7 for the remaining tasks:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261024-disassembly v6`.
- Approved plan/version: `P-20261024-disassembly` / `6`.
- Recorded at: `2026-10-26T17:33:18+01:00` (Europe/Rome).
- Approved scope:
  - D15–D18 (phase `player-usability`) and D19–D23 (phase `generation-usability`), with D23's suggestions sent only when the learner presses the button;
  - the remaining tasks of earlier versions as written: D8's and D10's witnessed flows, and D11–D12 in their gated phases;
  - the stated assumptions and exclusions, including reading-order numbers that follow the arrows, and the card of the open part as the "sezione smontaggio".

  D1–D7, D9, D13 and D14 are recorded as implemented under earlier versions; D9's comparison chose setup A.
- Approved-content SHA-256: `9a78080b014da17fdf2caf9320ec6451023124a07710f21fa70cd1e0c1fb79ec`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Disassemblies` up to, and not including, `## Review and authorization`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized:
  - ChatGPT runs beyond D9's run budget (30 generations, plus up to 4 expansions). D20's live check uses the 4 public generations left in it;
  - sending the owner's work document to OpenAI before the owner confirms in chat that company policy allows it (confirmed on 2026-10-26 for this plan's runs);
  - model downloads and dependency changes, except D18's `markdown-it`, `mermaid` and the dev dependency `@types/markdown-it`, at exact versions;
  - publication;
  - importing private documents or code into the repository;
  - starting D11 or D12 before their gate.

Version 5, approved and superseded by v6 for the remaining tasks:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261024-disassembly v5`.
- Approved plan/version: `P-20261024-disassembly` / `5`.
- Recorded at: `2026-10-26T14:03:14+01:00` (Europe/Rome).
- Approved scope:
  - D13–D14 (phase `depth`), and D9's model comparison and D10 as written in v5;
  - D11–D12 in their gated phases;
  - the stated assumptions and exclusions, including the 6-line stopping rule.

  D1–D8 are recorded as implemented under earlier versions, with D8's witnessed desktop flow still open. The code of phase `generation` is recorded as implemented under v4.
- Approved-content SHA-256: `38716bb735760212570605db0272c3ab7af5ed246abf5c57c9827471f4ac450f`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Disassemblies` up to, and not including, `## Review and authorization`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized:
  - ChatGPT runs beyond D9's run budget: 30 generations (24 for the comparison, up to 4 replacements, up to 2 on the owner's private document), plus up to 4 expansions;
  - sending the owner's work document to OpenAI before the owner confirms in chat that company policy allows it;
  - model downloads and dependency changes;
  - publication;
  - importing private documents or code into the repository;
  - starting D11 or D12 before their gate.

Version 4, approved and superseded by v5 for the remaining tasks:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261024-disassembly v4`.
- Approved plan/version: `P-20261024-disassembly` / `4`.
- Recorded at: `2026-10-26T12:20:33+01:00` (Europe/Rome).
- Approved scope: D9–D12 and their acceptance criteria as written in v4, with D1–D8 recorded as implemented under earlier versions (D8's witnessed desktop flow still open); phase `generation` and the gated phases `repository` and `document`; the stated assumptions and exclusions.
- Approved-content SHA-256: `b7dc8b9b777542afd1a31fd6a9259899de4b425fdbc94033da39096da9924d42`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Disassemblies` up to, and not including, `## Review and authorization`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized:
  - ChatGPT runs beyond D9's run budget (30 generations: 24 for the comparison, up to 4 replacements, up to 2 on the owner's private document);
  - sending the owner's work document to OpenAI before the owner confirms in chat that company policy allows it;
  - model downloads and dependency changes, including a PDF extraction library or an internationalization library;
  - publication;
  - importing private documents or code into the repository;
  - starting D11 or D12 before their gate.

Version 3, approved and superseded by v4 for the remaining tasks:

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

### Phase generation (D9–D10)

Received command: `implement P-20261024-disassembly v4 --phase generation`, on 2026-10-26. The plan ID, version and approval digest matched the v4 approval record.

| Task | Status | Evidence |
|---|---|---|
| D9 generation | Done | `src/core/disassembly-generation.ts` (phase schemas, inputs, checks, assembly), `src/desktop/generator.ts` (phases, repairs, routes, stats); `tests/disassembly-generation.test.ts`, 21 tests (automated test) |
| D9 evaluation | Done, not yet run | `eval/` adapted to disassemblies: setups A/B/C, budget ledger, blind review sheets, four public cases; `tests/eval.test.ts` (automated test); refusals checked by running the command (no request sent) |
| D9 comparison | **Open** | No ChatGPT generation has been run. It needs the owner's go-ahead, the account's model list, and then the blind review |
| D10 Studio | Done | `src/renderer/Studio.tsx`, catalogs, `App.tsx`; `tests/studio.test.tsx`, 15 tests (automated test); the question step was checked in the browser preview by the agent |
| D10 witnessed generation | **Open** | Needs a live generation on each route, by the owner |

Checks:
- `npm run check`: passed, 17 files, 241 tests.
- `npm run build`: passed. The bundle is 597 kB (592 kB before). The lucide-react warning was already there.
- `npm run eval -- --help`, and three refused runs: without `--allow-chatgpt`; with `--runs 3`; with a private case and no `--private-to-chatgpt`. Each refusal came before any request, and no run folder or ledger was written.
- Browser preview (agent): under the English interface, an Italian question sets the content language to Italian. Choosing English then shows "The question looks Italian…".
- Static scan of the new and changed files: no names, code or text from the private cases.

Acceptance, as far as code can show it:
- **Each phase is checked before the next one starts:**
  - the structure goes through the contract's own checks: levels, joints, citations and the bill of materials, with a forgotten range reported as `sources[i]`. It also gets a language check;
  - a part's content is checked for point length, for each sub-part explained exactly once, and for language;
  - the runs go through the contract's checks on runs and reassembly, plus the giveaway check and a language check.
- **Repairs:** each phase may be repaired once on both routes. A content repair repeats only the failing part. When a repair fails too, the findings are named by phase, for example `structure · sources[0]: …`, and nothing is saved.
- **Closed lists:** source ids, top-level part ids and sub-part ids. Every object in the three schemas has all its fields required and no extra fields.
- **Round trip:** each of the five public fixtures, given back as phase answers, passes the three phases. It assembles into a valid disassembly with 0 forgotten lines and the same parts and slots.
- **Setup:** the structure goes to the structure route; parts and runs go to the content route. ChatGPT and local routes can be mixed.
- **Before any request:**
  - a question in another language than the chosen content is refused;
  - so are tampered sources;
  - so is a local address off this machine.
- **Failures:** a provider failure in one part is reported as itself, not as a cancellation, and stops the other parts. Cancellation and a second concurrent generation save nothing.
- **Studio:**
  - the request preview is exactly the structure request;
  - the content language follows the question and can be changed, and a mismatch blocks generation;
  - a second model for parts and runs is optional and remembered;
  - progress shows the phase, "Pezzo k di n", repairs and the request count;
  - a failed check shows a summary in the interface language, with the English findings as technical detail;
  - the result opens in the player, and the library lists it under "Smontaggi".

Decisions taken within the approved scope:
- **Two levels are generated:** top-level parts and their sub-parts, as in all prepared disassemblies. The contract still accepts a third level; generation does not produce one.
- **Two schema additions, found by the fixture round trip:**
  - Structure joints may cite lines. Without that, lines that only state a connection would count as forgotten.
  - A sub-part may carry a critique; Mill's colonial exclusion needs one.
- **Parts are written in parallel:** three at a time on ChatGPT, one at a time on a local server, which would queue them anyway. Account token refresh was already shared between concurrent requests.
- **Giveaway threshold: 1.6×.** Q1 accepted lessons at 1.35–1.5 and called 1.78–2.0 giveaways.
- **Slots are derived by the app.** Interchangeable parts share the model's label, their kind, and the same neighbours; slot ids are assigned by the app. Run ids are assigned by the app too.
- **Stored origin:** the contract keeps one provider and one model per disassembly.
  - Setups with two models are stored as `structure + content`.
  - The provider is `chatgpt` whenever any phase sent the sources to OpenAI.
- **Prompts are in English, and every request names the content language.** Findings are in English because they go back to the model.
- **Lesson generation is replaced.**
  - The lesson `Generator`, its IPC result and its tests give way to the disassembly generator.
  - The lesson draft code in `src/core/generation.ts` stays, with its tests, until legacy support is dropped.
  - Saved lessons stay readable.
- **Evaluation cases:**
  - the public set is the four cases of D9. The Mill and Kessmouth sources are the fixtures' own. `glucose` and `account-session`, which were lesson-only, were removed;
  - private cases run only when named;
  - on ChatGPT, a private case also needs `--private-to-chatgpt`;
  - the ledger `.local/eval/chatgpt-budget.jsonl` counts every generation that sent at least one request.
- **Default setup:** until D9 chooses one, Studio uses the selected model for every phase, with the second model as an advanced choice. D9's result will set the preselection.
- **Vocabulary:** Studio now speaks of "smontaggio" / "disassembly" and of a question, following the product's vocabulary table. The failure messages changed the same way.

Not done in this phase, and why:
- **ChatGPT comparison (24 generations, up to 4 replacements):** it spends the owner's plan, and the agent said it would start only with the owner's explicit go-ahead.
- **Local route measurement:** no model server was running on the Mac, and starting a 35B model was left to the owner.
- **Blind claim review and decision of the default setup:** owner steps, after the comparison.
- **The owner's private document:** gated on the owner's statement about company policy. On the local route it needs a running server.
- **D10 witnessed generations,** on each route, with a restart, and one English question under an Italian interface.

Owner steps:
1. `npm run eval -- --list-models`, to pick the strongest and the cheapest model the account lists.
2. `npm run eval -- --route chatgpt --allow-chatgpt --setups A,B,C --strong <slug> --cheap <slug>`. That is 4 cases × 3 setups × 2 attempts = 24 generations, each of about 5–9 requests.
3. Fill in the `*.review.md` sheets before opening `setups.json`.
4. Optionally, with a local server running: `npm run eval`.

### Phase depth (D13–D14)

Received command: `implement P-20261024-disassembly v5 --phase depth`, on 2026-10-26. The plan ID, version and approval digest matched the v5 approval record.

| Task | Status | Evidence |
|---|---|---|
| D13 | Done | `src/core/disassembly.ts` (recursive parts, `minLinesToSplit`, per-part bill of materials, part `excluded`, `expansions`, `isExpansionOf`, `nextRevision`), `src/core/disassembly-state.ts` (`carryOver`), `ProgressStore.carry`, latest revision in `DisassemblyStore.list`; `tests/depth.test.ts` (automated test) |
| D14 code | Done | `acceptExpansion`, `buildExpansionInput` and `expandPart` in `src/core/disassembly-generation.ts`; `Generator.expand`; IPC `disassembly:expand`; `TakeApart` on the part card; App reopening the new revision; `eval --expand`. Tests: `tests/depth.test.ts`, `tests/disassembly-player.test.tsx` (automated test) |
| D14 measurement | **Open** | Runs with D9's comparison: up to 4 expansions on ChatGPT, and the local route when a server is running |

Checks:
- `npm run check`: passed, 18 files, 256 tests.
- `npm run build`: passed. The bundle is 605 kB.
- Static scan of the new and changed public files: no names, code or text from the private cases. The private fixtures in `.local/` gained part-level exclusions and stay uncommitted.

Acceptance, as far as code can show it:
- **Depth:**
  - a synthetic disassembly five levels deep validates;
  - its five levels lay out without geometry findings;
  - the state opens to the deepest level and back.
- **Stopping rule:** a level under a part with 4 non-blank lines is a located finding, naming the count and the minimum.
- **Per-part bill of materials:**
  - an uncovered parent line is reported as a range, like a forgotten source range;
  - an exclusion outside its part, an exclusion on a part without sub-parts, and a sub-part citing every line of its parent are each a finding.
- **All fixtures validate under the new rules:** the five public ones and the three private ones.
- **Expansions:**
  - `isExpansionOf` accepts exactly one part gaining a level and rejects any other change;
  - `carryOver` moves runs, choices, reassembly, notes and the selection to the new revision, and opens the part;
  - the store keeps both revision files and lists one card;
  - the progress store moves the saved file and keeps the old one.
- **Taking a part apart:**
  - the request carries the question, the path, and exactly the part's lines; the sources form a closed list;
  - a valid split saves `v2` and moves the progress;
  - a split that forgets lines is repaired once, then refused with nothing saved;
  - parts that are too small, already open, or in a prepared disassembly are refused before any request;
  - cancellation saves nothing.
- **Player:**
  - a generated disassembly offers "Smonta questo pezzo" with its cost and route;
  - a small part says why it stops;
  - after the split, the player reopens on the new level with the learner's note intact;
  - prepared disassemblies show neither.

Decisions taken within the approved scope:
- **Kessmouth's `vote` lost its sub-level.** It cites 4 lines, below the approved minimum of 6, and its three sub-parts were one line each, which is exactly the split the rule forbids. Its points still tell the vote. The tests that used it now use Mill's `bounds`. If the owner wants such splits, the threshold is the place to change, not the fixture.
- **Fixture gaps were closed with reasons, not by widening sub-parts.**
  - Headings are `context`.
  - Table rows that summarize their section are `repetition`.
  - Lines about the part as a whole, such as Mill's definition and conclusion of the region, are `context` with a note.
  - The private fixtures got `context` entries for the same kind of lines.
- **The descent always ends.**
  - The contract forbids a sub-part that cites all of its parent's lines.
  - An expansion's sub-parts must cite only the part's own lines.
  - So each expanded level has strictly fewer lines than the one above.

  Hand-made sub-parts may still cite a line outside their parent (Atlas `rb-identity` does), as a cross-reference.
- **The first generation also emits part-level exclusions,** so its sub-levels meet the same rule. Its instructions say not to open a part under 6 lines, and that deeper levels can come later.
- **Learner state:**
  - `path` accepts up to 32 levels. This is a storage bound on a file, not a product rule; the line count stops real depth far below it.
  - After an expansion, the learner lands inside the new level.
- **The route for taking a part apart** is the structure model of the Studio settings. When none is saved, it is the structure model that generated the disassembly.

Incident during verification:
- **What happened.** While checking the runner's refusals, the agent ran `npm run eval -- --route chatgpt --allow-chatgpt --setups A,B,C --strong x --cheap y --expand --cases kessmouth`. It expected a refusal, but the combination was within budget.
  - The runner sent 6 structure requests to OpenAI through the owner's session, with the made-up slugs `x` and `y`.
  - Each carried the public Kessmouth story and the instructions, about 4.8k characters.
  - Each was rejected at once with `model-unavailable`, and no output was received.
  - No private material was involved.
- **Fixes:**
  - the runner now checks every slug against the account's model list before sending anything;
  - it stops at the first `model-unavailable`;
  - the ledger counts only attempts that got past admission.
- **Cleanup.** The run folder and the ledger file, which held only those 6 entries, were removed. The comparison budget is intact.
- The same command now ends with "The account does not list x, y", and no request is sent.

Owner steps (D9 comparison, now including D14):
1. `npm run eval -- --list-models`.
2. `npm run eval -- --route chatgpt --allow-chatgpt --setups A,B,C --strong <slug> --cheap <slug> --expand`: 24 generations and 4 expansions.
3. Review the `*.review.md` and `*.expanded.review.md` sheets before opening `setups.json`.

#### The owner's private work document (2026-10-26)

- **Gate (D9).**
  - Asked whether company policy allows sending the document to OpenAI, the owner answered in chat: "Sì, è consentito".
  - The document is a private architecture and deployment proposal of about 330 lines. It stays in `.local/eval/cases/` and is not named in commits.
  - Before sending, the agent checked it for keys, passwords and IP addresses, and found none.
- **Run.** Requested by the owner before the A/B/C comparison, to judge generation on real work material.
  - One generation with setup C: the strong model for the structure, the cheap one for parts and runs.
  - It uses one of the 2 private generations in the budget.
  - The owner's question asks how the described system is built, released and deployed.
- **Result:** valid on the first attempt, the first live disassembly generation.
  - 11 requests in 207 s: structure 105 s; 7 parts with 2 content repairs, 94 s; runs 62 s.
  - About 101k characters sent and 33k received.
  - 0 forgotten lines, 0 layout findings, content in Italian.
  - The longest correct option is 1.54× the wrong ones, under the 1.6 limit.
  - 7 top-level parts, no sub-levels, 3 runs (two scenarios, one case).
  - The sections the question does not need were excluded as `outside-question`.
  - The disassembly was copied into the app's library, so the owner can review it in the app and take parts apart there.
- **Defect found: the reassembly gives the answer away.** The model used each part's name as its slot label, so the blank drawing shows the names. The instructions asked for a step number or a kind. No check catches this yet.
- **Fixed after the run, at the owner's request (2026-10-26):**
  - **Slot labels that give a part away are now a repairable finding in the runs phase.** A label gives a part away when it shares two words of four letters or more with the part's name, or when shared words make up at least half of the label.
    - The instructions now ask for a step number or a kind, never the part's words.
    - Every public fixture passes, except Kessmouth's "Rival" (for "The railway, a rival cause"). That label is now "Objection", the part's kind.
    - The disassembly already generated from the private document keeps its labels; a new generation would follow the new rule.
  - **Joint labels in run mode.** The owner noted that a label could hide the animation of a running arrow. While a joint's line runs, `labelBeside` moves its label off the line: perpendicular to the segment it sits on, to a side that touches no plate, label or line.
    - The geometry test covers every fixture: 11 of 12 Atlas joints have a free side, as do all 26 of the private code case.
    - Where neither side is free, the label turns see-through while its line runs.
    - Other labels and the exploded view are unchanged. Checked in the browser preview on the Atlas scenario.

#### D9 model comparison (2026-10-26)

Run on the owner's request ("I test con i vari modelli? Se si, inizia"), with the budget approved in v5. The numbers are in [comparison.md](comparison.md).
- **Validity:** A (`gpt-6.1-sol` on every phase) 6/8, B (`gpt-5.6-luna`) 4/8, C (`gpt-6.1-sol` structure + `gpt-5.6-luna` parts and runs) 5/8.
  - Every valid attempt has 0 forgotten lines, 0 layout findings and the requested language.
  - One of A's failures was a service error.
- **Why the others failed:**
  - points or a joint label a few characters over the limit after one repair;
  - giveaway options;
  - malformed load tests (B).
- **Expansions:** 2 of 2 valid, on core pipeline and Mill. Kessmouth has no divisible part. The runbook had no valid C attempt to take apart.
- **Budget used:** 24 of 28 public generations, 1 of 2 private, 2 of 4 expansions.
- **Default setup: A** (`gpt-6.1-sol` on every phase). The owner delegated the claim review to the agent; the review was not blind and found 0 wrong claims in A. See [comparison.md](comparison.md#claim-review-and-decision-2026-10-26).
- Commit `2e91e95` was pushed; [PR #7](https://github.com/simoneriggi92/BreakTheWall/pull/7) is open to `main`. [PR #6](https://github.com/simoneriggi92/BreakTheWall/pull/6), with the earlier phases, was already merged.

### Phase player-usability (D15–D18)

Received command: `implement P-20261024-disassembly v6 --phase player-usability`, on 2026-10-26. The plan ID, version and approval digest (`9a78080b…`) matched the approval record; no other plan was implementing.

| Task | What was built | Evidence |
|---|---|---|
| D15 | `layoutLevel` returns `order`, the reading order (rank along the joints, across each rank as drawn, side parts right after their host in drawn order, loose parts last); `readingNumbers` and `readingPaths` in `src/core/layout.ts`. Balloons, plate names, Tab order, the card's eyebrow and the bill of materials ("2.1.3", listed in that order) use it. The title block band says "numbers: reading order". Content and runs inputs list parts in reading order with their numbers | `tests/layout.test.ts` (Atlas flow, Mill grounds → claim → objection, limit → consequence, Kessmouth events, a rollback cycle, a level without joints, permutation on every level of every public and private fixture, paths); `tests/disassembly-player.test.tsx` (balloon, plate name, card and bill of materials agree, in both languages); `tests/disassembly-generation.test.ts` |
| D16 | Below the top level, "↑ <level above>" at the top left of the drawing pane and "Back to <level above>" in the sub-assembly card; Escape and Alt+↑ go up one level except while typing or inside a dialog; the part just left is selected and its plate focused | `tests/disassembly-player.test.tsx` (control only below the top level, three ways up, notes field, five levels down and back in English) |
| D17 | `src/renderer/disassembly/SplitPane.tsx`: two `separator` splitters (drawing height, source width), keyboard, pointer drag, reset by Enter or double click, sizes in local storage with fallback to defaults. The source starts at a third of the row and can widen to the whole row. The bill of materials has the source splitter | `tests/split-pane.test.tsx`; `tests/disassembly-player.test.tsx` (splitters per mode, sizes restored after a remount, widen and back, none on a narrow window) |
| D18 | `src/renderer/markdown.ts` (`markdown-it`, raw HTML off, line ranges on every block, links inert, images as alt text, mermaid fences as placeholders); `SourceDocument` and `SourceReader` (dialog with outline); `src/renderer/diagrams.ts` (Mermaid loaded on first use, strict); `src/renderer/svg-mount.ts` | `tests/source-document.test.tsx` (rendering, hostile markup as text, line maps, innermost-block highlight, drawn and failing diagrams, view switch, reader with outline and Escape keeping the level, no switch for code, styles moved out of the markup) |

Checks: `npm run check` passed, 20 files and 298 tests. `npm run build` passed. `npm audit`: 0 vulnerabilities.

**Bundle.** The main bundle went from 605,283 to 721,178 bytes (+116 kB; the limit was 150 kB). Mermaid and its diagram types are separate chunks, about 5 MB in all, loaded only when a diagram is shown. The built `index.html` keeps the strict policy (no `'unsafe-inline'`).

Browser preview (dev server, 1280×800), checked by the agent:
- Atlas fits the drawing pane at first; dragging the bar down makes the plates bigger and the sheet scrolls sideways; a double click fits it again.
- The document view of the Atlas runbook renders its headings, lists and table; selecting `deploy-staging` highlights its table row and paragraph and scrolls to them. The reader shows the outline and closes on Escape.
- Mill numbers grounds 1–2, the claim 3, the objection 4 and the limit 5 beside it, the consequence 6, the loose part 7. Escape inside "Bounds" returns to the top level with "Bounds" selected.
- Mermaid renders a flowchart and a sequence diagram and rejects a broken one. Under the production style policy, reproduced in an iframe, an SVG inserted as markup lost its styles (black fill), while the mounted one kept them.

Deviations from the plan text, decided during implementation:
- **Versions.** The plan asked for the latest releases at least two weeks old: `markdown-it` 15.0.2 and `mermaid` 12.1.0. Both had published advisories fixed in the next release: a high-severity quadratic-time parse in `markdown-it` (fixed in 15.0.3, 10 days old) and a low-severity issue through `katex` in `mermaid` (fixed in 12.2.0, 13 days old). The fixed releases were pinned instead. `@types/markdown-it` was not added, because `markdown-it` 15 ships its own types. The lockfile only adds packages; no existing one changed.
- **Drawing size.** "Fits the pane in both directions" kept wide sheets small whatever the pane height, which is what the owner asked to fix. The drawing now follows the pane's height and scrolls sideways when wider; until the learner sets a height, the pane is as tall as the whole sheet needs at its width.
  - Owner feedback in the desktop app, the same day: "il disegno non entra più nello schermo, con 6 pezzi … rimettendo la barra al default, i 6 blocchi non rientrano … In quel caso riduci la dimensione dei blocchi". The 70% minimum width still forced a scroll on a window narrower than the sheet. Fix: until the learner sets a height (or after a reset by double click or Enter) the sheet is contained in the pane with no minimum width, so plates shrink and the whole sheet shows; once a height is set, the drawing follows it as above. Checked in the browser preview at 1000×700: Atlas's 6 parts fit. `npm run check`: 299 tests passed.
- **Breakpoint.** Panes stack at 960 px and under, the stylesheet's existing breakpoint, not 900 px.
- **Side parts** are numbered in drawn order after their host, so Mill's objection (left) comes before its limit (right).
- **Diagram styles** go through the CSS object model because the production policy blocks inline styles; the policy was not loosened.

Not done here: D17's and D18's witnessed checks in the desktop app (the owner, on Atlas and on the generated disassembly of the work document, whose four diagrams are the real case for D18).

#### Verification of phase player-usability (2026-10-26)

No CI is configured; checks come from `package.json`.

| Check | Command | Result |
|---|---|---|
| Phase tests | `npx vitest run tests/layout.test.ts tests/split-pane.test.tsx tests/source-document.test.tsx tests/disassembly-player.test.tsx tests/disassembly-generation.test.ts tests/i18n.test.tsx` | passed: 6 files, 105 tests |
| Types and all tests | `npm run check` | passed: 20 files, 298 tests |
| Production build | `npm run build` | passed; main bundle 721,178 bytes; strict policy kept in `dist/index.html` |
| Dependency advisories | `npm audit` | passed: 0 vulnerabilities |
| Browser preview | `npm run dev:web`, driven by the agent | passed for the points listed in the implementation record |
| Desktop app, witnessed by the owner | — | not run: needs the owner |

| Task | Acceptance | Verdict |
|---|---|---|
| D15 | Core order on Atlas, Mill, Kessmouth, a cycle and loose parts; a permutation on every level of every fixture; balloon, plate name, card and bill of materials agree in both languages; generation inputs in reading order | **verified** |
| D16 | Control only below the top level, naming the level above; the control, Escape and Alt+↑ go up one level, select and focus the part left; Escape in the notes field stays; five levels back one at a time | **verified** |
| D17 | Component and player tests pass. The witnessed check in the desktop app, on Atlas and on the work document in both themes, is still open. The narrow-window breakpoint is 960 px, not 900 px, as recorded | **verification pending** (owner) |
| D18 | Rendering, hostile markup, line ranges, citations, mocked diagrams, failing diagram, dialog and code tests pass; build passes; the main bundle grew by 116 kB of the allowed 150 kB; Mermaid is a separate chunk. Diagram styles under the production policy were checked in a browser reproduction, not in the desktop app. The witnessed check on the work document's four diagrams is still open | **verification pending** (owner) |

Confidence: automated and browser-preview evidence for all four tasks; desktop-app evidence for none yet. The plan is not complete: D17 and D18 wait for the owner's witnessed check, and phase `generation-usability`, D8 and D10 remain.

### Phase generation-usability (D19–D23)

Received command: `implement P-20261024-disassembly v6 --phase generation-usability`, on 2026-10-27. The plan ID, version and approval digest (`9a78080b…`, recomputed) matched the approval record; no other plan was implementing.

| Task | What was built | Evidence |
|---|---|---|
| D19 | `longTexts`, `SHORTEN_INSTRUCTIONS`, `shortenJsonSchema`, `applyShortened` in `src/core/disassembly-generation.ts`. After the one repair, when every finding left is a length finding that leads to a text in the answer, `withRepair` in `src/desktop/generator.ts` sends one shorten request with only those texts (path, length, limit, content language) and checks the whole phase again. It applies to structure, parts, runs, expansions and suggestions; it counts as a repair, and also in `shortens`; progress carries `shortening` and Studio and "Take this part apart" say "shortening texts that are too long" | `tests/disassembly-generation.test.ts` (a point 3 characters over shortened and accepted; a missing, duplicated, added or still-too-long text refused; a mix of findings sends no shorten request; cancelling during the shorten request saves nothing) |
| D20 | Instructions ask for a lead of at most 100 characters and points or explanations that add to it. Host checks on new generations and expansions only: `LEAD_LIMIT` (a length finding, so D19 can shorten it) and `restates` (a located finding). The card shows the lead as an opening line in a stronger style (`.role.lead`). The evaluation report records the longest lead, restated texts and attempts saved by a shorten request | `tests/disassembly-generation.test.ts` (Mill setup A points flagged; no point or explanation of the five public fixtures flagged; a long lead shortened through D19; restated point and split explanation located); `tests/fixtures/d9-mill-setup-a.json`; `tests/disassembly-player.test.tsx`; `tests/eval.test.ts`; live check below |
| D21 | `src/desktop/generation-draft.ts`: `DraftStore` keeps one `generation-draft.json` in the app's data folder, written atomically after each accepted step (request key with source ids and sha256, question, language, setup, id and creation time, structure, parts, runs, statistics). The generator deletes it on success and when a new generation starts; parts no longer stop each other; cancelling stops everything and keeps what was accepted. `resume: true` asks only for what is missing. Studio reads the draft on opening and after a failure, says what was kept, and offers "Resume" and "Start over" when `resumable` holds; otherwise it says that generating discards the other draft | `tests/generation-draft.test.ts` (one part failing twice, then one content and one runs request; a failed runs phase, then only the runs request; changed source, question or language; cancellation; success; an unreadable draft set aside); `tests/studio.test.tsx` (both actions and what was kept, in both languages, again after a restart; another question offers no resume; set-aside notice) |
| D22 | `previewSchema` in `src/core/provider.ts` (3–7 parts with id, name, kind, icon, number of sub-parts, status, and for done parts lead and up to 4 points; up to 20 joints; every text bounded). The generator sends it with each progress once the structure is accepted; the preload drops a preview that does not parse and keeps the rest; the host sends every status change. `src/renderer/disassembly/GenerationPreview.tsx` draws the top level with the player's layout and sheet, state marks for writing, done and failed, and opens a done part's lead and points. During runs the line says the runs are being prepared | `tests/provider.test.ts` (malformed and oversized previews refused); `tests/generation-draft.test.ts` (no preview during the structure; statuses one part at a time; leads and points of done parts; a failed part; every plate done during runs; a resumed generation starts with its kept parts done); `tests/studio.test.tsx` |
| D23 | `SUGGEST_INSTRUCTIONS`, `buildSuggestionInput`, `acceptSuggestions` (question check, at most 160 characters, distinct from each other and from those already shown, content language, different parts, ranges inside the sources); `Generator.suggest` on the setup's content route, one repair and D19's shorten, cancellable, refused while a generation runs, and cancelled when one starts. Studio's question step shows "Suggest break-downs" with the route it goes to, only in the desktop app; cards with question, kind and part names fill the editable field and set the content language; suggestions are kept per selection (sources' ids and sha256) in the session draft and never stored with a disassembly; "Other suggestions" sends the questions already shown | `tests/disassembly-generation.test.ts`; `tests/generation-draft.test.ts` (one request only when asked; repaired once then refused; cancel; a generation cancels it; busy); `tests/studio.test.tsx` (no request before the button; cards; the field stays editable; reuse across steps; asked again after the selection changes; cancellation and failure notices; no route; English; none in the browser preview) |

Deviations from the plan text, decided during implementation:
- **Lengths from the schema.** Texts over a schema limit (for example a 160-character question) are worded like the app's own length findings, so D19 can shorten them too. A finding on a point names the point; its `text` is what is shortened.
- **Restate threshold.** A text restates its lead when it shares at least 6 words with it (words of four letters or more, compared by their first five letters), making up at least 60% of its own words. On the D9 outputs, setup A's Mill points share up to 11 words with their leads; no point or explanation of the hand-made fixtures shares more than 5. One Atlas point, "Nothing changes outside the build server.", nearly repeats its lead with 5 shared words and is left by this threshold.
- **Resume re-checks the draft.** Kept steps are accepted again against the current sources before use, so a draft cannot carry anything the checks would refuse; a step that no longer passes is asked for again.
- **Start over** starts a new generation at once, which deletes the draft; there is no separate "discard" call.
- **Retry.** While a matching draft can be resumed, the failure banner shows no "Retry" button: "Resume" and "Start over" replace it.
- **Unreadable draft** is renamed to `generation-draft.unreadable.json` (one file at most) and reported once.
- **Account state at Studio level.** Suggestions need the setup's content route before the generation step, so the account status, and the model list when signed in with plan usage, are read when Studio opens instead of at the generation step. No source is sent by these calls.
- **Preview of sub-assemblies.** The preview carries only the number of sub-parts, so a sub-assembly's plate shows its count; it opens nothing until the disassembly is saved.

**D20 live check** (2026-10-27, run `2026-10-27T07-40-10-019Z`, setup A on every phase, one attempt on each of the four public cases: the last 4 public generations of D9's budget, now 28 of 28 used):

| Case | Valid | Requests | Repairs (structure/parts/runs) | Shorten requests | Longest lead | Restated texts | Forgotten lines |
|---|---|---|---|---|---|---|---|
| core-pipeline | yes | 9 | 0/0/1 | 0 | 98 | 0 | 0 |
| kessmouth | yes | 8 | 0/0/0 | 0 | 99 | 0 | 0 |
| mill-harm | yes | 10 | 1/0/0 | 0 | 99 | 0 | 0 |
| release-runbook | yes | 12 | 0/2/1 | 0 | 99 | 0 | 0 |

4 of 4 valid (required: 3), every lead at most 100 characters, no point or explanation flagged as restating its lead. D19's shorten request was not needed in this run, so it saved no attempt here; its evidence is the scripted tests. Median 375 s per generation. The report stays in `.local/eval/runs/`.

#### Verification of phase generation-usability (2026-10-27)

| Check | Command | Result |
|---|---|---|
| Phase tests | `npx vitest run tests/disassembly-generation.test.ts tests/generation-draft.test.ts tests/provider.test.ts tests/studio.test.tsx tests/disassembly-player.test.tsx tests/eval.test.ts` | passed |
| Types and all tests | `npm run check` | passed: 21 files, 331 tests |
| Production build | `npm run build` | passed; main bundle 730.7 kB (+10 kB) |
| D20 live check | `npm run eval -- --route chatgpt --allow-chatgpt --setups A --strong gpt-6.1-sol --runs 1` | passed: 4 of 4 valid, longest lead 99, 0 restated |
| Browser preview with a scripted bridge | dev server, driven by the agent | passed: suggestion cards fill the field; the drawing shows done, writing and failed plates and opens a done part's lead and points |
| Desktop app, witnessed by the owner | — | not run: needs the owner |

| Task | Acceptance | Verdict |
|---|---|---|
| D19 | Scripted tests for shortening, refusals, mixed findings and cancellation pass | **verified** |
| D20 | Restate check on Mill setup A and the fixtures; long lead shortened; live check 4 of 4 valid, leads ≤ 100, 0 restated | **verified** |
| D21 | Host and Studio tests pass, in both languages and after a restart | **verified** |
| D22 | Schema, host and Studio tests pass. The witnessed live generation is still open | **verification pending** (owner) |
| D23 | Core, host and Studio tests pass. The owner's witnessed use, on a public case and on the work document, is still open | **verification pending** (owner) |

Confidence: automated evidence for all five tasks and live evidence for D20. The plan is not complete: D17, D18, D22 and D23 wait for the owner's witnessed checks, and so do D8 and D10.

#### Owner's desktop check (2026-10-27)

After the build with both v6 phases was started in the desktop app, the agent listed what to try: the resizable panes and the rendered markdown source (D17, D18), the drawing while a disassembly is generated, the suggested break-downs on a public case and on the work document, and resuming a cancelled generation (D21–D23). The owner answered: "tutto ok". The report does not detail each point; it is recorded as the owner's witnessed check of these tasks.

| Task | Verdict |
|---|---|
| D17 | **verified** (owner's report) |
| D18 | **verified** (owner's report) |
| D22 | **verified** (owner's report) |
| D23 | **verified** (owner's report) |

The plan is not complete: D8's and D10's witnessed flows remain, and D11–D12 stay behind their gate.

### Phase identity (D24–D27)

Received command: `implement P-20261024-disassembly v7 --phase identity`, on 2026-10-27. The plan ID, version and approval digest (`d216769d…`, recomputed) matched the approval record; no other plan was implementing.

| Task | What was built | Evidence |
|---|---|---|
| D24 | `docs/images/brand/`: `mark.svg`, `mark-blueprint.svg`, `wordmark.svg`, `wordmark-blueprint.svg`, `app-icon.svg`, hand-written on the review's 104 × 88 grid (the link now starts at the short bar's end and meets the piece's centre). `npm run brand` (`scripts/brand.mjs`, `scripts/brand-render.cjs`) renders `assets/icon.png` at 1024 × 1024 with transparency, using the installed Electron | `xmllint` on every SVG; a contact sheet at 16, 32, 64 and 128 px in paper, blueprint and as the icon: readable at 32 px and above; at 16 px the shape stays recognisable but the bars nearly touch |
| D25 | `Brand` draws the mark inline with classes `brand-bars`, `brand-link`, `brand-piece`, coloured by new tokens in both themes (paper: navy bars; blueprint: pale-blue bars; terracotta piece in both). Tagline "Take the text apart." / "Smonta il testo.", capitalised by CSS. Joint, state and text colours are unchanged; the old `.brand svg` colour rules are gone | `tests/i18n.test.tsx` (brand, tagline and mark in both languages); `tests/theme.test.ts` (bars at 3:1 or more on both backgrounds, same tokens in both themes) |
| D26 | Home eyebrow, title and line in both catalogs. The title for a learner with progress ("Pick up your connections again.") stays | `tests/i18n.test.tsx` (eyebrow, title and line in both languages; language switch) |
| D27 | `src/desktop/main.ts` sets `assets/icon.png` as the Dock icon on macOS (`app.dock.setIcon`) and as the window icon elsewhere, when the file exists | `npm run build`; witnessed check pending |

Checks: `npm run check` passed, 21 files and 335 tests. `npm run build` passed; main bundle 730,830 bytes.

Visual check by the agent, on the dev server captured offscreen with Electron (system theme light and dark): home at 1280 and 720 px wide and the Atlas player at 1280 px, in paper and blueprint. The header shows the mark and tagline at the old brand's size; the home opens with the new copy; the player, its drawing and its colours are unchanged.

Deviations from the plan text:
- **Terracotta contrast.** `#D96B4B` measures 3.0:1 on the paper background. It stays as the owner chose it: a logo is exempt from the non-text contrast criterion, and the piece is never text or the only cue. The contrast test covers the bars, which carry the mark's shape.
- **Tagline case.** The catalogs hold the sentence ("Take the text apart."); the header shows it in capitals through CSS, so screen readers read words, not letters.
- **Resume title.** Only the opening a new learner sees changes; the title shown when there is progress to resume stays.
- **Link stroke.** In the header the link is drawn 5 units wide (about 1.8 px at 38 px), against 3 in the masters, so it does not vanish at header size.

Not done here: the owner's witnessed check of the Dock icon (D27) and of the header in the desktop app.

### Phase presentation (D28–D31)

Received command: `implement P-20261024-disassembly v7 --phase presentation`, on 2026-10-27. The approval digest (`d216769d…`) was recomputed and matched. Work continues on a branch from `main` after the community files (#11) were merged, carrying the identity phase's changes.

| Task | What was built | Evidence |
|---|---|---|
| D28 | The README opens with the wordmark (the blueprint version in dark mode, through `<picture>`), "Take the text apart.", the problem in one line, the alpha facts, badges in the brand's colours, links to *Try the alpha*, *How it works*, *Roadmap* and *Contribute*, and the demo. New sections *How it works* and *Try the alpha* (clone, `npm ci`, build, start; the first start downloads Electron); *Getting started* is folded into *Try the alpha*; the detailed sections stay. The status table gains the identity and presentation phases | A fresh clone of the public `main` (1c6d74a): `npm ci` (0 vulnerabilities), `npm run build`, and `npm start`, which downloaded Electron and opened the app |
| D29 | The demo GIF re-recorded with the same storyboard (10 frames, 25 s, 799 kB, 960 × 720), the blueprint screenshot of Mill retaken at 1440 × 980, and the social card as `docs/images/brand/social-card.html`, rendered by `npm run brand` to `.github/assets/social-preview.png` (1280 × 640) | Frames checked on a contact sheet: the new mark in every header; no old mark in any image |
| D30 | Applied on the owner's confirmation ("Poi applica D30"): description "Break down AI walls of text into source-linked parts. Explore connections, test what holds them together, and reassemble. Open-source macOS alpha."; 20 topics (artificial-intelligence, ai, llm, chatgpt, local-llm, ollama, llama-cpp, lm-studio, knowledge-visualization, interactive-learning, active-learning, source-grounded, reverse-engineering, learning, desktop-app, macos, electron, react, typescript, mermaid), none claiming PDF, repositories or another platform; issue #12 points at `docs/images/brand/mark.svg`. Website left empty | API responses: description and 20 topics returned; issue #12 updated |
| D31 | `CHANGELOG.md` records the identity under `0.1.0-alpha`. After the owner merged #20 and confirmed, the agent pushed the annotated tag `v0.1.0-alpha` on the merge commit `ac79c78` (CI green). The stored token may not create releases (403), so the owner published the pre-release from a prefilled form with the agent's notes | [Release page](https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.1.0-alpha): pre-release, published 2026-10-27 09:33 UTC, not marked latest |

Checks: `npm run check` passed, 21 files and 335 tests.

Deviations from the plan text:
- **`npm run brand` runs one Electron process per image.** A second offscreen window in the same process hung in this environment; the render script now exits explicitly.
- **Owner request outside the plan, applied on 2026-10-27:** two rulesets on `main`. "main: changes through pull requests" (no bypass): no deletion, no force push, a pull request with resolved threads, and the CI check "Types, tests and build". "main: only the owner merges": only the repository admin may update `main`. Together, every change reaches `main` through a pull request, and only the owner can merge it. Required approvals are 0, since the owner cannot approve their own pull request.

#### Verification of phases identity and presentation (2026-10-27)

| Check | Command | Result |
|---|---|---|
| Types and all tests | `npm run check` | passed: 21 files, 335 tests |
| CI on the merge of #20 | GitHub Actions, "Types, tests and build" on macOS | passed |
| Fresh clone | `git clone`, `npm ci`, `npm run build`, `npm start` | passed |
| Visual check | Electron captures of the dev server, paper and blueprint, 1280 and 720 px | passed |
| Dock icon in the desktop app, witnessed by the owner | `npm start` | passed: "l'icona dell'app è ok" (2026-10-27) |

| Task | Acceptance | Verdict |
|---|---|---|
| D24 | Valid SVGs, readable from 32 px (16 px recognisable), icon regenerated by one command | **verified** |
| D25 | Brand and tagline tests in both languages, contrast test, visual check in both themes and widths | **verified** |
| D26 | Home text tests in both languages, catalog parity, visual check | **verified** |
| D27 | Build passes, the path resolves, and the owner confirmed the Dock icon | **verified** |
| D28 | Links and images resolve on GitHub; fresh clone runs; no claim beyond the verified status | **verified** |
| D29 | No old mark in any image; GIF 799 kB; social card 1280 × 640. Uploading the card in the repository settings is the owner's step | **verified** |
| D30 | API returns the description and 20 topics; none claims PDF, repositories or another platform | **verified** |
| D31 | Tag on the merge commit of `main`; release page published as a pre-release with the notes | **verified** |

The plan is not complete: D8's and D10's witnessed flows remain, and D11–D12 stay behind their gate. The owner also uploaded the social card in the repository settings.

## State changes

- 2026-10-27: `implementing` → `blocked`, as P-20261027-macos-dmg's approved precondition requires (one implementing plan at a time). Waiting for the owner's witnessed checks (D8, D10); D11–D12 gated. It returns to `implementing` when P-20261027-macos-dmg is completed or when the owner resumes it.
- 2026-10-27: `blocked` → `implementing`, as P-20261027-macos-dmg is completed.
- 2026-10-27: `implementing` → `blocked`, as P-20261027-windows-alpha's approved precondition requires. It returns to `implementing` when that plan completes or the owner resumes it.
- 2026-10-27: `blocked` → `implementing`, as P-20261027-windows-alpha is completed.
- 2026-10-28: `implementing` → `blocked`, as P-20261028-mcp-integration's approved precondition requires. Waiting for the owner's witnessed checks (D8, D10); D11–D12 gated. It returns to `implementing` when that plan completes or the owner resumes it.
- 2026-10-28: `blocked` → `implementing`, as P-20261028-mcp-integration is completed.
- 2026-10-29: `implementing` → `blocked`, as P-20261029-ui-workbench's approved precondition requires. Waiting for the owner's witnessed checks (D8, D10); D11–D12 gated. It returns to `implementing` when that plan completes or the owner resumes it.
- 2026-10-29: `blocked` → `implementing`, as P-20261029-ui-workbench is completed.
- 2026-10-29: `implementing` → `blocked`, as P-20261029-source-entry's approved precondition requires. Waiting for the owner's witnessed checks (D8, D10); D11–D12 gated. It returns to `implementing` when that plan completes or the owner resumes it.
