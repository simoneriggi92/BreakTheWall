---
id: P-20261029-source-entry
title: Understand a source without a question - the question becomes an optional focus
version: 1
state: implementing
current_task: E4
last_evidence: Phase contract (E1-E3) verified - typecheck passed; 29 files, 423 tests passed
next_action: Owner confirms the commit of phase contract, then "implement P-20261029-source-entry v1 --phase generation"
approval: approved
---

# Understand a source without a question

## Outcome

A learner can give the app a source and take the whole of it apart without typing or choosing a question:
- **No question needed.** Studio, the MCP server and the generator accept a request with no question. A question stays available, before generation, as an optional focus.
- **The whole source, nothing silently left out.** Without a question, no line can be excluded as "outside the question" and no sub-assembly is drawn closed as "not needed".
- **Orientation that leads into the drawing.** The overview says what the whole does and why (as today), suggests a part to start from and says why, and shows how the source is organised: each section of the source with the parts that take it apart. All of it is cited or computed from citations; none of it is a summary.
- **A third prepared example** shows this path, next to Atlas and Mill, which stay question-led.

Openable joints are the next plan. Help at the point of difficulty and contesting the AI's reading wait for a test with real people.

## Evidence

[Research R-20261029-source-entry](../../research/R-20261029-source-entry.md): what the question controls today, from Studio and MCP to the stored file; what Codex's prototype shows; and the owner's answers.

## Owner's decisions (2026-10-29)

- The default entry is to understand the whole source, with no question required; a question is an optional focus.
- The optional question lives before generation, in Studio. A question added later means a new generation.
- Two plans in sequence: this one, then openable joints. Help and contesting come after a test with real people.
- A third, whole-source example is added; Atlas and Mill stay question-led.

The owner suggested building the third example on the private document behind Codex's prototype. It cannot enter this public repository (internal code, names and infrastructure). This plan uses it only on the owner's device: as a private evaluation case in the ignored `.local/eval/cases`, and as a disassembly the owner generates in their own library (E10). The public example is an original document written for this plan (E8).

## Scope

Included: `docs/product.md`; the disassembly contract and its check (`src/core/disassembly.ts`); the goal (`src/core/source.ts`), generation requests and acceptance (`src/core/disassembly-generation.ts`); the desktop generator and its draft (`src/desktop/generator.ts`, `generation-draft.ts`); Studio; the MCP server and assistant (`src/mcp`); the player's overview, the library card; prepared fixtures; evaluation cases; English and Italian.

Not included:
- joints (identity, content, selection, joint runs): the next plan;
- a question added after generation, or refocusing an existing disassembly;
- help buttons, free-text explanations, contesting the reading, any chat;
- progress counters ("sections opened"): opening is not understanding, and the product keeps them apart;
- a new mode or tab. The source stays beside the explanation, as P-20261029-ui-workbench left it.

## Preconditions

- **Pull request 35 is merged.** This plan starts from `main` after it, on a new branch `feature/source-entry`.
- **One plan implementing.** On approval, P-20261024-disassembly moves to `blocked` ("waiting for the owner's witnessed checks (D8, D10); D11–D12 gated"). It returns to `implementing` when this plan completes or the owner resumes it.
- **Stored files stay valid.** `schemaVersion` stays 1: every new field is optional, and every disassembly stored today still validates.
- **No new dependency.**
- **Private material** stays in `.local/` and on the owner's device: no commit, no screenshot, no request to a hosted model without the owner's explicit permission for that request.
- **External actions** (push, pull request, merge, any generation that spends the owner's usage) only on the owner's confirmation when reached.

## Tasks

### Phase `contract`

**E1. The product definition says it.** `docs/product.md`: the identity, "Large sources: sub-assemblies and the bill of materials" (where the question decides what opens) and the loop's step 1 ("Choose what to take apart") state that the default is the whole source and the question an optional focus; the out-of-scope line no longer lists "analysis … without a question" for documents. `AGENTS.md` changes only if a sentence there contradicts the new text.
Acceptance: no sentence in `docs/product.md` or `AGENTS.md` says the question is required or decides what opens without saying "when the learner gives one".

**E2. The contract allows no question, and checks what that implies.** In `src/core/disassembly.ts`:
- `question` becomes optional.
- New optional `start: { part, why }`: a top-level part to begin with, and one sentence on why.
- `checkDisassembly`, when there is no question: an `outside-question` exclusion at any level (the bill of materials, a part's own lines, excluded files) is a finding; `relevant: false` on any part is a finding. `start.part` must be a top-level part. The language check on the question runs only when there is one.
Acceptance (tests): the four prepared disassemblies still validate unchanged; a disassembly with no question and an `outside-question` exclusion, or a closed sub-assembly, fails with a finding that names the path; `start` naming a sub-part or an unknown id fails.

**E3. How the source is organised, computed.** A pure function in `src/core` takes a disassembly, one source and that source's headings (level, text, first line), and returns for each section (from its heading to the next heading of the same or a higher level) the top-level parts whose citations, or whose sub-parts' citations, fall in it, and the lines excluded there with their reasons. Joint citations count for both ends' parts. Only the top two heading levels present in the source are sections. A source without headings returns nothing.
Acceptance (tests): on Atlas's runbook, every section maps to the parts that cite it, and a section that only an exclusion covers says so; a source with no headings returns an empty list.

### Phase `generation`

**E4. Requests without a question.**
- The goal accepts an empty question; a non-empty one keeps its 10–400 characters. Lesson generation (`src/core/generation.ts`), which still needs one, keeps requiring it.
- `STRUCTURE_INSTRUCTIONS` and the expansion instructions have two forms. With a question, they are unchanged. Without one, they ask for an exploded view of the whole source (what it is for and how it holds together), offer no `outside-question` reason, never set `relevant: false`, and ask for `start`. The request header says that the learner wants to understand the whole source instead of `QUESTION:`.
- The structure schema gains `start` (both forms: a question-led disassembly also benefits from a starting part).
- `acceptStructure` and `compose` apply E2's rules and carry `start`; with no question, `question` is left out.
- The content language: the learner's choice; else, with a question, the question's; else the sources' detected language; else the interface's.
- The generator skips the question-language check without a question; a resumed draft matches on an empty question as on any other.
Acceptance (tests): the structure request without a question contains neither `QUESTION:` nor `outside-question`; a structure answer without `start` or with `outside-question` is rejected with a finding; the question-led request is byte-identical to today's except for the `start` field in the schema and its instruction line.

**E5. Studio without a required question.** The second step becomes the optional focus. Its default says that, without a question, the app takes apart the whole source; "Continue" is enabled with the field empty. Suggested questions stay, as ways to focus. The generation summary shows "The whole source" when there is no question. The language clash appears only with a question. English and Italian.
Acceptance (tests): Studio reaches generation with sources and no question, and the request it shows has no `QUESTION:`; a 1–9 character question still blocks with today's message.

**E6. MCP without a required question.** `start_disassembly` no longer requires `question`; its description and the prompt in `src/mcp/prompts.json` say that without one the whole text is taken apart. The assistant builds the same requests as E4.
Acceptance (tests): `start_disassembly` with only `text` returns the structure instructions for the whole source; with a question, the reply is unchanged.

### Phase `player`

**E7. The overview orients, and leads into the drawing.** With nothing selected:
- The line under the title shows the question when there is one, and nothing otherwise (the whole's name and what it does are already in the overview). The library card shows the question, else what the whole does.
- If `start` is set: "Start here: N. name", its reason, and a button that selects that part (the same selection as a plate click).
- If E3 returns sections for a source: "How the source is organised", one row per section: its title, the plate numbers that take it apart (each selects its part), or "not taken apart: reason". Clicking a section's title shows its lines in the source pane.
- The source pane stays visible next to the overview, as today.
Acceptance (tests and an integration check at 1440×900): the third example's overview shows the start and every section; clicking a section number selects its plate and shows its lines; Atlas and Mill without `start` show no empty block; claim and source stay on screen together.

### Phase `example`

**E8. A third prepared example, whole-source.** An original Markdown document, written for this repository under its licence, about one mechanism that fails silently and the signals that tell its failures apart (a background worker: "it ran" ≠ "it finished" ≠ "what happened to each item"). General concepts only: no name, code, text or structure from the owner's private document. About 250–400 lines with headings. Its disassembly, in Italian and English (one family): no question, `start` set, 3–7 top-level parts, at least one sub-assembly, the bill of materials complete with no `outside-question`, at least one scenario and one case, and a reassembly.
Acceptance (tests): both versions validate; every section of the source has a part or a reasoned exclusion (E3); the library lists it with Atlas and Mill.

**E9. Evaluation cases without a question.** The case schema accepts an empty question. A public case on E8's source with no question. The private case for the owner's document is added by the owner, or by me on the owner's request, in `.local/eval/cases`, never in the repository.
Acceptance (tests): `loadCases` with public cases only accepts the no-question case and gives it no question; the existing cases load unchanged. `git status` shows nothing under `.local`.

### Phase `verify`

**E10. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows.
2. Integration check on the built app (both themes, both languages, 1440×900 and 1280×800): the third example's overview, start and sections; Studio reaching generation without a question; Atlas and Mill unchanged.
3. One generation without a question on a public source, through a route the owner chooses and confirms (local model, ChatGPT or the MCP assistant), accepted by the app's check.
4. The owner generates their private document without a question in their own library, on their device, and judges whether the overview and the drawing orient them. That judgement decides whether the plan completes or gets a version 2.

## Risks

- **Whole-source structures may be worse than question-led ones.** A question narrows the choice of parts; without one, the model may pick an outline instead of a mechanism. E4's instruction asks for what the whole is for and how it holds together, and E10.3–4 look at the result. If the parts read like a table of contents, a version 2 changes the instructions; the contract does not change.
- **The overview may grow into a summary.** E7 adds only a starting part with one sentence and a computed list of sections. No new generated prose about the whole.
- **Long sources.** 3–7 parts on several hundred lines rely on sub-assemblies and on expansion. E8 is long enough to show whether the overview stays readable; E3 limits sections to two heading levels.
- **Bigger content requests.** Fewer exclusions mean more lines for the content phase. Not measured; E10.3 records the token use the app reports.
- **The example's subject is close to the private document's.** E8 uses general concepts and original text only, written without copying its structure; the review before committing E8 checks it.

## Verification strategy

- Automated: `npm run check` (TypeScript and Vitest), with the tests named in each task.
- Integration: the built app driven over the DevTools protocol, with a scratch data folder; scripts stay in the scratchpad.
- Generation: one witnessed generation on a public source (E10.3), on a route and with a cost the owner confirms.
- Witnessed: the owner's own document on their device (E10.4).

## Approval

Approve with: `Approve P-20261029-source-entry v1`. Then implement with a separate command, for example `implement P-20261029-source-entry v1 --phase contract`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-source-entry v1`.
- Approved plan/version: `P-20261029-source-entry` / `1`.
- Recorded at: `2026-10-29T14:09:37+01:00` (Europe/Rome).
- Approved scope: phases `contract` (E1–E3), `generation` (E4–E6), `player` (E7), `example` (E8–E9) and `verify` (E10), on a new branch `feature/source-entry` from `main` after pull request 35 is merged.
- Approved-content SHA-256: `29751349bc50992b7e22d199890f2f9331e305b0e11d2d3d3628f4a571e491e4`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Understand a source without a question` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v1. Pushing, pull requests, merges and any generation that spends the owner's usage need the owner's confirmation when reached. The owner's private document stays in `.local/` and on the owner's device. No new dependency.

## Progress

- 2026-10-29: `approved` → `implementing` on `implement P-20261029-source-entry v1 --phase contract`. Pull request 35 was merged into `main` at `f0a0a1c`; branch `feature/source-entry` starts there.
- **E1 verified (2026-10-29).** `docs/product.md` now says, in the identity, that no question is needed (owner, 2026-10-29); "Large sources" says that without a question the whole source is taken apart and no sub-assembly is closed, and that a question, when given, decides what opens; the loop's step 1 makes the question an optional focus; the out-of-scope line keeps a whole *repository* without a question out, and says that a text or document is taken apart whole by default. `AGENTS.md` has no sentence about the question and is unchanged. The one remaining "question" in the sources table is the retrieval mode (the learner asks the AI to find material), a different use.
- **E2 verified (2026-10-29).** `question` is optional; `start: { part, why }` is new and optional. Without a question, `checkDisassembly` reports `outside-question` in the bill of materials, in excluded files and in a part's own exclusions, and `relevant: false` on any part; `start.part` must be a top-level part; the question's language is checked only when there is one.
  - Evidence (automated tests, `tests/disassembly.test.ts`): the five public fixtures and the four prepared disassemblies validate unchanged; six new located findings (`bom.excluded[3].reason`, `parts[2].excluded[0].reason`, `bom.excludedFiles[0].reason`, `parts[4].relevant`, `start.part` twice) and one valid question-less Mill with `start`.
  - Tests that built a goal from a fixture's question now read `d.question ?? ''`, the form E4 gives to "no question".
- **E3 verified (2026-10-29).** `sectionCoverage(d, source, headings)` in `src/core/disassembly.ts`. Two refinements, both within the task: a lone top heading is the document's title, so the two levels below it are the sections (otherwise every Markdown document with an `#` title would show one section holding everything); and each row says whether the whole cites lines in it, since the whole's own lines are neither a part nor an exclusion.
  - Evidence (automated tests, `tests/section-coverage.test.ts`): on Atlas's English runbook the title is dropped and 14 sections remain (11 at level 2, 3 at level 3); "3. Before you start" → `start`; "7." → `image`, `deploy`, `smoke` (a joint counts for both ends); "11. Production" has no part and 3 lines excluded as outside the question; every section of every public fixture has a part, the whole or an exclusion; no headings, or an unknown source, give an empty list.
- **Phase `contract` checks (2026-10-29).** `npx tsc --noEmit -p .local/tsconfig.check.json` passed; `npx vitest run` passed with 29 files and 423 tests (408 before, plus 15); `git diff --check` passed. CI waits for a push.
