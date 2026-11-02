---
id: P-20261029-source-limits
title: Larger sources - no per-source limit, a higher total, and an explicit check where a route cannot carry it
version: 4
state: completed
current_task: none
last_evidence: S1-S6 verified - S4.3 after S6 passed with every reply under 40,000 characters; the owner's document (956 lines) taken apart whole as one source in two pages through Claude Code 2.1.316, nothing written to a file, judged correct by the owner
next_action: None; P-20261029-source-entry resumes for E10.3 and E10.4, then #36 merges and #39 after it. Sub-assemblies in long sources and Claude Desktop's limit would be new plans
approval: approved
---

# Larger sources

## Outcome

A learner can take apart a long document as one source:
- **No per-source limit of its own.** One source may be as long as the whole selection allows.
- **A higher total: 120,000 characters** (today 60,000), with the line, file-size and stored-source limits raised to match.
- **Each route says when it cannot carry a request**, before sending it, instead of failing later: the local route checks the window it can give the model; the MCP assistant receives the source twice instead of three times, and a long source in pages, each within what an assistant app passes to its model.

The owner's document (49,357 characters) then imports whole, and so does a document about twice as long.

## Evidence

[Research R-20261029-source-limits](../../research/R-20261029-source-limits.md): every limit, where it acts, what each request carries, and what each route can take.

## Owner's decisions (2026-10-29)

- The per-source limit of 40,000 characters is too restrictive: "è troppo limitante".
- Limits must not be set by local models: most use is through the MCP assistant or a hosted model, and local models get their own handling when it is needed.
- 2026-10-30: raise the limits before P-20261029-source-entry finishes its last checks, building on that plan's branch ("v2 sopra source-entry"). Version 2 changes only where this plan starts and how its pull request merges.
- 2026-10-30, after S4.3: send a long source to the assistant in pages ("v3 con fonte a pagine") rather than lowering the limit for the MCP route, the route the owner uses most.
- 2026-11-02, after S4.3 was repeated: keep every reply within about 40,000 characters, with a smaller page 1 ("Sì, v4 a 40.000"), rather than accept a first reply that Claude Code writes to a file.

## Scope

Included: `SOURCE_LIMITS` and the stored source schema; the local route's request (Ollama); the MCP assistant's first step (the source in pages), its runs step and the tools' descriptions; Studio's wording where it repeats a limit; tests.

Not included:
- more than 4 sources, or longer lines (a citation must still point at a readable line);
- splitting a long source automatically, or chunked generation;
- repositories and PDF documents (P-20261024-disassembly, D11–D12);
- measuring memory and time on local models;
- a different number of parts per level.

## Preconditions

- **Built on P-20261029-source-entry.** This plan starts from `feature/source-entry` (pull request #36), whose code it changes (`server.ts`, `assistant.ts`) and where this plan is recorded, on a new branch `feature/source-limits`. Its pull request targets `feature/source-entry` and merges after #36; if #36 merges first, it is retargeted to `main`.
- **One plan active at a time.** P-20261029-source-entry is `blocked` while this plan implements: its E10.3 and E10.4 wait, and it returns to `implementing` for them after this plan is completed.
- **No new dependency.**
- **Stored files stay valid**: limits only rise, so every stored lesson and disassembly still validates.
- **External actions** (push, pull request, merge, any generation that spends the owner's usage) only on the owner's confirmation when reached. The owner's document stays on the owner's device.

## Tasks

### Phase `limits`

**S1. The limits.** In `src/core/source.ts`: `maxTotalChars` 120,000; `maxCharsPerSource` equal to it (one source may fill the selection); `maxLines` 5,000; `maxFileBytes` 480,000 (120,000 characters at up to 4 bytes each, checked before reading). In `src/core/lesson.ts`, the stored source text accepts 120,000 characters. `maxLineChars` and `maxSources` are unchanged.
Acceptance (tests): a pasted text of 120,000 characters imports and one of 120,001 does not; two sources of 60,000 pass together and a third character over the total does not; a file of 480,001 bytes is refused before it is read; a disassembly whose source has 120,000 characters validates; every stored fixture still validates.

**S2. The local route checks its window.** For Ollama, the app computes the window it needs as today; when the need is above the 65,536 tokens it can ask for, it stops before sending, with the existing `local-context` failure and a message that suggests a hosted route or the assistant, instead of letting Ollama truncate the prompt. LM Studio, llama.cpp and other servers keep reporting their own window, as today.
Acceptance (tests): a request estimated above the window fails with `local-context` and sends nothing; a request at the largest selection (120,000 characters, numbered) fits and is sent with a window of at most 65,536.

### Phase `assistant`

**S3. The assistant gets the source twice, not three times.** The MCP runs step asks the assistant to cite the numbered sources it received in step 1 instead of repeating them; it still carries the structure and the written parts. The app's own generator, whose requests are independent, keeps sending them. The description of `start_disassembly` states the limits from `SOURCE_LIMITS` instead of fixed numbers (today "at most 40,000 characters and 1,500 lines").
Acceptance (tests): the runs reply of `start_disassembly`'s session contains no numbered source line and names step 1; a full session on Atlas and Mill still ends in a saved disassembly; the tool's description contains "120,000" and "5,000", taken from the constants.

### Phase `paging`

**S5. A long source reaches the assistant in pages.** Claude Code passes a tool result to the model only up to its limit and writes a longer one to a file, so the model saw the instructions, the schema and 37 numbered lines of a 915-line source (S4.3). The MCP assistant keeps every reply within 60,000 characters, about 20,000 tokens:
- The numbered source (`formatSourceBlock`) is split on line boundaries into pages of at most 45,000 characters; each page says which source and lines it holds, and that it is page *k* of *n*.
- `start_disassembly` returns the header, the instructions, the schema, the request's focus and language, and page 1. With more than one page, it says how many and asks the assistant to call `read_source` for each before `submit_structure`.
- A new tool, `read_source` with `page`, returns that page of the current session's source. It works in every phase, so the assistant can read a page again.
- `submit_structure` before every page was read is refused without counting an attempt, naming the pages still to read.
- A part request whose cited lines do not fit in one page names the pages that hold them instead of sending the lines; the runs step (S3) names the pages of step 1.
- A source that fits in one page (Atlas, Mill, the importer) gives the same replies as today, apart from the line saying it is page 1 of 1.

Acceptance (tests):
- a source of 120,000 characters in 5,000 lines gives a first reply under 60,000 characters and four pages, each under 45,000 characters; the pages put together are exactly the numbered source;
- `read_source` before a session, or with a page outside 1–*n*, is refused with the valid range;
- `submit_structure` before the last page is refused, names the missing pages and does not count as an attempt; after reading them, the same answer is accepted;
- a part whose lines do not fit in one page gets the pages named, and its reply stays under 60,000 characters;
- full sessions on Atlas and Mill still end in a saved disassembly;
- the tool list (and the bundled server's `tools/list`) includes `read_source` with its description.

**S6. Every reply within 40,000 characters (version 4).** S4.3, repeated after S5, measured Claude Code's limit: a 44,921-character page reached the model, and the 56,040-character first reply was written to a file. The 60,000 of S5 sits above that limit. The MCP assistant keeps every reply within 40,000 characters, about 13,000 tokens:
- Page 1 gets what the first reply leaves after the header, the instructions, the schema, the focus and the line announcing the pages. For the S4.3 text, those take about 11,200 characters, which leaves about 28,000 for page 1.
- Pages 2 to *n* hold at most 38,000 characters each. A `read_source` reply, with its page line and the pages still to read, then stays within 40,000.
- A part request above 40,000 characters names its lines and their pages, as in S5. The runs reply carries no source (S3), and in S4.3 it was 12,421 characters.
- What S5 introduced stays as it is: the pages split on line boundaries, `read_source`, and the refusal before every page is read.

Acceptance (tests):
- The 120,000-character source in 5,000 lines gives a first reply under 40,000 characters, page 1 included.
- Every later page is under 38,000 characters, and every `read_source` reply is under 40,000.
- The pages put together are exactly the numbered source.
- Every reply of the full session is under 40,000 characters.
- With a 400-character question and a 120-character title, the first reply stays under 40,000, because page 1 shrinks.
- A source that fits in one page (Atlas, Mill, the importer) gives the same replies as under S5.

### Phase `verify`

**S4. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows.
2. Integration check on the built app, with a scratch data folder: a 120,000-character pasted source imports, its preview and the source pane stay usable at 5,000 lines (scrolling and selecting a citation), and Studio shows the new limits in both languages.
3. One generation on a long public source, between 80,000 and 120,000 characters taken from this repository's documents (up to 4 sources), through a route and at a cost the owner confirms; the app's checks accept it, and the parts are judged as parts of the mechanism rather than a table of contents. Done once on version 2 and repeated after S5 on version 3 (see Progress). Repeated again after S6, on the same text through the same route, at a cost the owner confirms: every page is read, and no tool result is written to a file.
4. The owner's own document as one source, on the owner's device. With an empty question, the same trial also serves P-20261029-source-entry E10.4, recorded there when that plan resumes.

## Risks

- **The assistant app's limit is measured once, in one app.** In Claude Code 2.1.303, 44,921 characters passed and 56,040 were written to a file. 40,000 leaves about 5,000 characters of margin under the largest reply that passed. If the limit counts tokens, a denser text (code, numbers) holds more tokens per character; S4.3's text already mixed prose, tables and code. Claude Desktop's limit is not known, and S4.3 checks Claude Code only.
- **More pages for the longest sources.** At 120,000 characters in 5,000 lines the source makes five pages instead of four, which is one more `read_source` call. The S4.3 text stays at three pages.
- **An assistant may skip pages.** `submit_structure` refuses until every page was read, but a model could read a page without using it. The app's checks on citations and on the bill of materials still apply.

- **The parts may become an outline.** 3–7 parts on 120,000 characters rely on sub-assemblies and on taking parts apart later. S4.3 shows it; if it happens, a version 2 changes the instructions or adds a level, not the limits.
- **ChatGPT's window is assumed, not checked.** About 45,000 tokens per full request. S4.3 is the check when that route is chosen; a refusal from the provider stays a recoverable failure.
- **Cost and time grow with the source.** A full request at 120,000 characters is about twice today's largest. The owner confirms the route and the cost before S4.3.
- **The assistant's runs step loses its copy of the sources.** A model that has dropped the start of its context could cite wrong lines; the app's checks still reject citations outside a source's lines, and the repair loop names them.
- **Local models** may run out of memory before the window is reached. Not measured; the owner decided local models get their own handling later.

## Verification strategy

- Automated: `npm run check` (TypeScript and Vitest), with the tests named in each task.
- Integration: the built app driven over the DevTools protocol, with a scratch data folder; scripts stay in the scratchpad.
- Generation: S4.3 on a route and at a cost the owner confirms.
- Witnessed: S4.4 on the owner's device.

## Approval

Approve with: `Approve P-20261029-source-limits v4`. Then implement with a separate command: `implement P-20261029-source-limits v4 --phase paging` for S6, then `--phase verify` for the rest of S4. S1–S3 (version 2) and S5 (version 3) are implemented and stay as they are.

## Approval record

Version 1, approved (superseded by version 2, which changes the preconditions and needs its own approval):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-source-limits v1`.
- Approved plan/version: `P-20261029-source-limits` / `1`.
- Recorded at: `2026-10-29T16:52:17+01:00` (Europe/Rome).
- Approved scope: phases `limits` (S1–S2), `assistant` (S3) and `verify` (S4), on a new branch `feature/source-limits` from `main` after P-20261029-source-entry is completed and merged.
- Approved-content SHA-256: `61c2e0b9e0396c561f8eabaf4a19c4d0a11135aff98f9370369162d9ab7885e1`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Larger sources` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v1, and waits for P-20261029-source-entry to complete. Pushing, pull requests, merges and any generation that spends the owner's usage need the owner's confirmation when reached. The owner's document stays on the owner's device. No new dependency.

Version 2, approved (superseded by version 3, which adds S5 and repeats S4.3 after it; it needs its own approval):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-source-limits v2`.
- Approved plan/version: `P-20261029-source-limits` / `2`.
- Recorded at: `2026-10-30T10:46:49+01:00` (Europe/Rome).
- Approved scope: phases `limits` (S1–S2), `assistant` (S3) and `verify` (S4), on a new branch `feature/source-limits` from `feature/source-entry`, with a pull request based on `feature/source-entry` that merges after #36.
- Approved-content SHA-256: `bc901a712082a900cadf237ea13022d024ed2ea13fcf51674eec2826f33f0ecc`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Larger sources` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v2. Pushing, pull requests, merges and any generation that spends the owner's usage need the owner's confirmation when reached. The owner's document stays on the owner's device. No new dependency.

Version 3, approved (superseded by version 4, which adds S6 and repeats S4.3 after it; it needs its own approval):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-source-limits v3`.
- Approved plan/version: `P-20261029-source-limits` / `3`.
- Recorded at: `2026-10-30T13:59:42+01:00` (Europe/Rome).
- Approved scope: phase `paging` (S5) and the rest of phase `verify` (S4.3 repeated after S5, S4.4), on `feature/source-limits` (pull request #39, based on `feature/source-entry`). S1–S3 stay as implemented under version 2.
- Approved-content SHA-256: `1d74ebdbdb9abbb238b2760a25e237289e5fdc3d92012d8bd186ca13937322ec`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Larger sources` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v3. Pushing, pull requests, merges and any generation that spends the owner's usage, including the repeat of S4.3, need the owner's confirmation when reached. The owner's document stays on the owner's device. No new dependency.

Version 4, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-source-limits v4`.
- Approved plan/version: `P-20261029-source-limits` / `4`.
- Recorded at: `2026-11-02T14:01:51+01:00` (Europe/Rome).
- Approved scope: S6 in phase `paging`, and the rest of phase `verify` (S4.3 repeated after S6, S4.4), on `feature/source-limits` (pull request #39, based on `feature/source-entry`). S1–S3 (version 2) and S5 (version 3) stay as implemented.
- Approved-content SHA-256: `1c60452b1ae4bf7f509b2116a42abcec779f615d4e0b1bca7e44a5ef2441237d`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Larger sources` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v4. Pushing, pull requests, merges and any generation that spends the owner's usage, including the repeat of S4.3, need the owner's confirmation when reached. The owner's document stays on the owner's device. No new dependency.

## State changes

- 2026-10-29: `awaiting_approval` → `approved` → `blocked`. Approval is recorded above; the plan waits for P-20261029-source-entry, as its precondition requires (one plan active at a time). It returns to `approved` when that plan completes.
- 2026-10-30: version 2 → `awaiting_approval`. The owner asked to raise the limits now, on top of P-20261029-source-entry's branch, instead of after it is merged. Only the preconditions, S4.4's note and the approval commands change; the tasks and their acceptance are as in version 1, whose approval no longer applies.
- 2026-10-30: version 2 `awaiting_approval` → `approved`. Approval is recorded above; P-20261029-source-entry is `blocked`, so this is the only active plan.
- 2026-10-30: `approved` → `implementing`, on `implement P-20261029-source-limits v2 --phase limits`. Branch `feature/source-limits` from `feature/source-entry` at `7f05151`.

## Progress

- 2026-10-30: `implement P-20261029-source-limits v2 --phase limits`.
- **S1, the limits (automated tests).** `SOURCE_LIMITS` in `src/core/source.ts`: total 120,000 characters, one source up to the total, 5,000 lines, 480,000 bytes for a file (4 bytes per character, checked before reading); 4,000 characters per line and 4 sources unchanged. The stored source text accepts 120,000 characters (`src/core/lesson.ts`).
  - `tests/source.test.ts`: a paste of 120,000 characters imports and one of 120,001 is `too-large`; two sources of 60,000 pass together and 60,000 + 60,001 are over the total; a file of 480,001 bytes is refused before it is read; the constants hold the planned values.
  - `tests/disassembly.test.ts`: a disassembly whose source has 120,000 characters validates, and one of 120,001 is refused at `sources[0].text`. Every stored fixture still validates (the existing fixture tests).
  - Tests that pinned the old values now use the new ones: Studio's capacity line (`0 / 120.000 caratteri`), the local entry point and both MCP refusals (120,001 characters).
- **S2, the local route checks its window (automated tests).** For Ollama, the window needed is computed as before; above `OLLAMA_MAX_CONTEXT` (65,536) the request is refused before anything is sent, as `local-context` with the new reason `local-window`, worded in both languages ("too long for a local model … use ChatGPT or your Claude assistant, or use fewer sources"). LM Studio, llama.cpp and other servers are unchanged.
  - `tests/local.test.ts`: a 200,000-character request fails with `local-context` / `local-window` and makes no call; the largest selection, as a real structure request without a question, is sent with `num_ctx` at most 65,536.
  - Measured with the same builder: 120,000 characters in 1,200 lines need a window of 57,344 tokens; in 5,000 lines (the most a selection can number) exactly 65,536. A request beyond that, for example with a long question, is refused rather than truncated.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run` passes with 29 files and 459 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass. CI on macOS and Windows runs with the pull request.
- 2026-10-30: `implement P-20261029-source-limits v2 --phase assistant`.
- **S3, the assistant gets the source twice, not three times (automated tests).** `buildRunsInput` takes `fromStepOne`: the MCP assistant's runs step names each source (id, title, line count) and asks for the line numbers of the numbered sources from step 1, instead of numbering them again; the structure and the written parts are still sent. The app's own generator, whose requests are independent, keeps sending the numbered sources. The descriptions of `open_in_break_the_wall` and of `start_disassembly`'s text read the limits from `SOURCE_LIMITS`.
  - `tests/mcp-assistant.test.ts`: on Atlas (English) and Mill (Italian), step 1 numbers the source, the runs request has no numbered line and names the source from step 1, and both sessions still end in a saved disassembly equal to what the app's own phases assemble.
  - `tests/disassembly-generation.test.ts`: the app's runs request contains the numbered source; the assistant's has none, names it, and is otherwise the same request.
  - `tests/mcp-server.test.ts`: both descriptions contain "at most 120,000 characters and 5,000 lines", built from the constants.
  - Bundled server: `dist-electron/mcp-server.cjs`, asked for `tools/list` over stdio, returns the same limits in both tools.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run` passes with 29 files and 460 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass.
- 2026-10-30: `implement P-20261029-source-limits v2 --phase verify`.
- **S4.1, CI (automated).** On pull request #39 (head `a26d76f`): "Types, tests and build" on macOS and "Windows: types, tests and build" passed.
- **S4.2, integration on the built app** (DevTools protocol, empty scratch data folder; scripts in `.local/checks/s4`).
  - Studio, English: "Up to 4 sources and 120,000 characters"; a pasted text of 120,000 characters is added ("1,200 lines · 120,000 characters"; capacity 120,000 / 120,000); one of 120,001 is refused with "The source has 120,001 characters; the limit is 120,000. Select the part you want to study."
  - Studio, Italian: "Fino a 4 fonti e 120.000 caratteri", "0/4 fonti · 0 / 120.000 caratteri", and the refusal "La fonte ha 120.001 caratteri; il limite è 120.000. Seleziona la parte che vuoi studiare."
  - A disassembly whose source has 5,000 lines and 120,000 characters (Atlas, lengthened with lines excluded as detail) opens in about 0.1 s and draws all 5,000 lines; a scroll step lays out in about 0.1 ms; the last line can be reached; selecting parts 4, 6 and 2 from the bottom of the source brings their first cited lines (30, 130, 28) into view, highlighted.
  - Testing note: while the app window is hidden behind others, Chromium does not run animation frames and the source pane did not move; with the window brought to the front, every check above passed. This is the test setup, not the app.
- **S4.3, one generation on a long public source** (route and cost confirmed by the owner: Claude via MCP). Claude Code 2.1.303, `claude -p --model sonnet`, with only the bundled MCP server of this branch, on one text of 90,096 characters and 915 lines: `README.md`, `docs/product.md`, `docs/architecture.md`, `docs/development.md` and `R-20261029-run-variety.md`, with no question.
  - Result: accepted and saved, "Written by your assistant", 6 parts, 7 joints, 3 runs (scenario, load test, case), `start` on the product part. 16 turns, 267 s, $1.35 reported by Claude Code (45,669 output tokens). Two parts needed one repair each (points over 130 characters); the structure and the runs passed first time.
  - **Finding: the first reply is too large for Claude Code.** `start_disassembly` returned 103,993 characters (instructions, schema and the numbered source). Claude Code did not pass it to the model: it saved it to a file and told the model to read it in pieces. The model read the instructions, the schema and the first 37 lines, then listed the source's headings with their line numbers, and wrote the structure from those and from the unnumbered text it had sent itself. The app's checks still held (every line cited or excluded), but the route did not carry the request as the plan intends. S3 removed the third copy; the first copy alone is above the limit at this size.
  - **Judgement of the parts.** Three of six parts gather sections from four to six places across the documents (generation; architecture, contracts and privacy; install, package and release): parts of the mechanism, not of the outline. Two follow one section or one document each (the player is the README's Features; the run research is its own document), and no part opens into sub-assemblies, so 915 lines rest on six closed parts and joints are general ("causes · defines the loop"). The outline risk is partly realised; the missing numbered source in step 1 likely contributed.
- **S4.4, the owner's document as one source:** pending, on the owner's device.
- 2026-10-30: version 3 → `awaiting_approval`. S4.3 showed that Claude Code does not pass the first reply of a 90,000-character source to the model. Version 3 adds S5 (the source in pages) and repeats S4.3 after it; S1–S3, their acceptance and the evidence above are unchanged.
- 2026-10-30: version 3 `awaiting_approval` → `approved`. Approval is recorded above; P-20261029-source-entry is still `blocked`, so this is the only active plan.
- 2026-11-02: `approved` → `implementing`, on `implement P-20261029-source-limits v3 --phase paging`.
- **S5, the source in pages (automated tests).** `sourcePages` in `src/core/disassembly-generation.ts` splits the numbered sources on line boundaries into pages of at most `PAGE_CHARS` (45,000) characters, each block under its source's header. The MCP assistant (`src/mcp/assistant.ts`) keeps every reply within `REPLY_CHARS` (60,000): `start_disassembly` sends the header, instructions, schema and page 1, and says how many pages to read; the new tool `read_source` returns any page in any phase; `submit_structure` is refused, without counting an attempt, until every page was read; a part whose lines do not fit in one reply names its line ranges and their pages; the runs step says the source was in pages.
  - `tests/mcp-assistant.test.ts`: Atlas lengthened to 5,000 lines and 120,000 characters, the added lines cited by "start": the first reply is under 60,000 characters and announces 4 pages; `read_source` before a session, and with pages 0, 5 and 1.5, is refused with the valid range; `submit_structure` before pages 2–4 is refused and not counted (a wrong structure afterwards is attempt 1); each page is within its size, and the pages' numbered lines are exactly the source's; the request for "start" names its lines in pages 1–4; every reply is under 60,000 characters; the session ends complete. Atlas and Mill at their own size still end in saved disassemblies.
  - `tests/disassembly-generation.test.ts`: two sources split at 4,000 characters keep every line once, in order, under their own headers, with contiguous ranges; a source that fits gives one page equal to its numbered block.
  - `tests/mcp-server.test.ts`: the tool list is `open_in_break_the_wall`, `start_disassembly`, `read_source`, `submit_structure`, `submit_part`, `submit_runs`, and `read_source` needs `page`. The bundled `dist-electron/mcp-server.cjs` lists the same six tools over stdio.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 29 files and 462 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass. A plain `npx vitest run` in this checkout also collects the tests of a Codex worktree under `.local/worktrees/` (created on 2026-11-01, another branch), which fail there; they are not part of this repository's suite, and CI does not have `.local`.
- **S4.3 repeated after S5 (2026-11-02, Claude via MCP, cost confirmed by the owner).** Same text and setup as the first run (Claude Code 2.1.303, `claude -p --model sonnet`, only this branch's bundled MCP server, an empty scratch data folder): 90,096 characters in 915 lines, no question.
  - Result: accepted and saved, 7 parts, 8 joints, 3 runs (scenario, load test, case), `start` on the idea part. 19 turns, 368 s, $1.69 reported by Claude Code (54,152 output tokens). The structure passed on its second attempt (the first lacked `joints` and `excluded` in the parts); three parts needed one repair each (points over 130 characters).
  - **Pages.** The source made 3 pages. `read_source` returned page 2 (44,921 characters) and page 3 (5,479) directly to the model. The first reply (header, instructions, schema and page 1: 56,040 characters) was again written to a file by Claude Code ("Output too large (54.7KB)"), with a 2 KB preview; the model read the file back with Read, available in this mode, and so had every page before the structure. The criterion of S4.3 ("no tool result is written to a file") is not met: Claude Code's limit lies between 45,000 and 56,000 characters, below the 60,000 assumed in S5. Claude Desktop, which has no such file, is not tested.
  - **Judgement of the parts.** Six of seven parts gather two to five sections across the documents (for example "Run and its variety" joins the README's Run section and the research; "Generation" joins five sections of README, architecture and development), against three of six in the first run; the outline risk is smaller. No part opens into sub-assemblies, so 915 lines still rest on seven closed parts. Joints name what passes ("accepted disassembly", "local socket", "main-process calls").
- 2026-11-02: version 4 → `awaiting_approval`. The owner chose replies of about 40,000 characters with a smaller page 1. Version 4 adds S6 and repeats S4.3 after it. S1–S3, S5, their acceptance and the evidence above are unchanged.
- 2026-11-02: version 4 `awaiting_approval` → `approved`. Approval is recorded above; P-20261029-source-entry is still `blocked`, so this is the only active plan.
- 2026-11-02: `approved` → `implementing`, on `implement P-20261029-source-limits v4 --phase paging`.
- **S6, every reply within 40,000 characters (automated tests).** `REPLY_CHARS` is 40,000 and `PAGE_CHARS` 38,000 in `src/mcp/assistant.ts`. `sourcePages` takes a size for the first page; `start_disassembly` measures its reply with an empty page 1, and page 1 gets what is left, less a margin of 400 characters for its own line and a page count that may differ.
  - `tests/mcp-assistant.test.ts`: on Atlas lengthened to 5,000 lines and 120,000 characters, the first reply is within 40,000 characters and announces 5 pages; each `read_source` reply is within 40,000 and each later page within 38,000; the pages together are exactly the numbered source; the structure, every part and the runs replies are within 40,000, and the session ends complete. With a 400-character question and a 120-character title, the first reply stays within 40,000 and page 1 ends at an earlier line than with a short question and title. Atlas and Mill at their own size still end in saved disassemblies, in one page.
  - `tests/disassembly-generation.test.ts`: with a smaller first page, page 1 is within its size, the others within the page size, and the numbered lines are the same and in the same order.
  - The S4.3 text (90,096 characters, 915 lines; measured locally, no model call): the first reply is 39,573 characters with lines 1–331; page 2 is 37,729 characters (lines 332–701) and page 3 27,212 (lines 702–915). Still three pages.
  - Bundled server: `dist-electron/mcp-server.cjs` lists the same six tools over stdio and carries the new sizes.
- **Checks (automated, macOS).** `npx tsc --noEmit -p .local/tsconfig.check.json` passes; `npx vitest run --dir tests` passes with 29 files and 463 tests; `npx vite build` and `node scripts/build-desktop.mjs` pass.
- **S4.1, CI after S5 and S6 (automated).** On pull request #39 (head `2af1e84`): "Types, tests and build" on macOS, "Windows: types, tests and build" and GitGuardian passed.
- **S4.3 repeated after S6 (2026-11-02, Claude via MCP, cost confirmed by the owner): passed.** Same text and setup as the two earlier runs (Claude Code 2.1.303, `claude -p --model sonnet`, only this branch's bundled MCP server, an empty scratch data folder; scripts and transcript in `.local/checks/s4c`): 90,096 characters in 915 lines, no question.
  - Result: accepted and saved, 7 parts, 7 joints, 2 runs (scenario, case), `start` on the identity part. 18 turns, 312 s, $1.66 reported by Claude Code (53,044 output tokens). The structure passed on its second attempt (one finding on a part); three parts needed one repair each (points over 130 characters).
  - **Pages.** The source made 3 pages: the first reply (header, instructions, schema and page 1, lines 1–330) was 39,365 characters; `read_source` returned page 2 (lines 331–701) in 38,023 and page 3 (lines 702–915) in 27,241. Every tool result reached the model directly: no reply was written to a file, and the model made no Read call. The largest part reply was 25,417 characters. Both criteria of S4.3 are met.
  - **Judgement of the parts.** All seven parts gather three to seven sections from two to four documents (for example "Joints and Run" joins the README, the product definition and the run research; "Generation and validation" joins seven sections of README, product, architecture and development), against six of seven in the second run and three of six in the first. No part opens into sub-assemblies, so 915 lines still rest on seven closed parts; this is the residual outline risk, for a later plan rather than for the limits. Joints name what passes ("typed joints drawn", "supplies the model", "packages the host").
- **S4.4, the owner's document as one source (2026-11-02, on the owner's device): passed.** The app was started from this branch (`npm start`, the owner's own library); Claude Code 2.1.316 with Sonnet 5.5 used only this branch's bundled MCP server (`--strict-mcp-config`), with no question. The document (956 lines; 49,357 characters, refused before S1) imported as one source and made 2 pages: the first reply was 39,552 characters and `read_source` returned page 2 (lines 544–956) in 24,250. No tool result was written to a file; the two Read calls were the assistant reading the document itself. The structure passed on its second attempt and two parts needed one repair each. The disassembly was saved and opened in the owner's library: 7 parts, 3 runs, in about 4.5 minutes. The owner's judgement: "mi sembra corretto". Its content stays on the owner's device; this record names no part of it.
- 2026-11-02: `implementing` → `completed`. S1–S6 are verified, with the evidence above. P-20261029-source-entry can return to `implementing` for E10.3 and E10.4.
