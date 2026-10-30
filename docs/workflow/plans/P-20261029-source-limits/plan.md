---
id: P-20261029-source-limits
title: Larger sources - no per-source limit, a higher total, and an explicit check where a route cannot carry it
version: 2
state: implementing
current_task: S4
last_evidence: Phases limits (S1-S2) and assistant (S3) implemented; TypeScript check, 29 test files with 460 tests and both builds pass on macOS; the bundled MCP server lists the new limits
next_action: Implement phase verify with a separate command, "implement P-20261029-source-limits v2 --phase verify"; it needs push and a pull request for CI, a route and cost for S4.3, and the owner's document for S4.4
approval: approved
---

# Larger sources

## Outcome

A learner can take apart a long document as one source:
- **No per-source limit of its own.** One source may be as long as the whole selection allows.
- **A higher total: 120,000 characters** (today 60,000), with the line, file-size and stored-source limits raised to match.
- **Each route says when it cannot carry a request**, before sending it, instead of failing later: the local route checks the window it can give the model; the MCP assistant receives the source twice instead of three times.

The owner's document (49,357 characters) then imports whole, and so does a document about twice as long.

## Evidence

[Research R-20261029-source-limits](../../research/R-20261029-source-limits.md): every limit, where it acts, what each request carries, and what each route can take.

## Owner's decisions (2026-10-29)

- The per-source limit of 40,000 characters is too restrictive: "è troppo limitante".
- Limits must not be set by local models: most use is through the MCP assistant or a hosted model, and local models get their own handling when it is needed.
- 2026-10-30: raise the limits before P-20261029-source-entry finishes its last checks, building on that plan's branch ("v2 sopra source-entry"). Version 2 changes only where this plan starts and how its pull request merges.

## Scope

Included: `SOURCE_LIMITS` and the stored source schema; the local route's request (Ollama); the MCP assistant's runs step and the tool's description; Studio's wording where it repeats a limit; tests.

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

### Phase `verify`

**S4. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows.
2. Integration check on the built app, with a scratch data folder: a 120,000-character pasted source imports, its preview and the source pane stay usable at 5,000 lines (scrolling and selecting a citation), and Studio shows the new limits in both languages.
3. One generation on a long public source, between 80,000 and 120,000 characters taken from this repository's documents (up to 4 sources), through a route and at a cost the owner confirms; the app's checks accept it, and the parts are judged as parts of the mechanism rather than a table of contents.
4. The owner's own document as one source, on the owner's device. With an empty question, the same trial also serves P-20261029-source-entry E10.4, recorded there when that plan resumes.

## Risks

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

Approve with: `Approve P-20261029-source-limits v2`. Then implement with a separate command, for example `implement P-20261029-source-limits v2 --phase limits`.

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

Version 2, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-source-limits v2`.
- Approved plan/version: `P-20261029-source-limits` / `2`.
- Recorded at: `2026-10-30T10:46:49+01:00` (Europe/Rome).
- Approved scope: phases `limits` (S1–S2), `assistant` (S3) and `verify` (S4), on a new branch `feature/source-limits` from `feature/source-entry`, with a pull request based on `feature/source-entry` that merges after #36.
- Approved-content SHA-256: `bc901a712082a900cadf237ea13022d024ed2ea13fcf51674eec2826f33f0ecc`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Larger sources` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v2. Pushing, pull requests, merges and any generation that spends the owner's usage need the owner's confirmation when reached. The owner's document stays on the owner's device. No new dependency.

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
