---
id: P-20261029-source-limits
title: Larger sources - no per-source limit, a higher total, and an explicit check where a route cannot carry it
version: 1
state: blocked
current_task: S1
last_evidence: Not run
next_action: Blocked while P-20261029-source-entry implements; after it is completed, implement with a separate command, starting with "implement P-20261029-source-limits v1 --phase limits"
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

## Scope

Included: `SOURCE_LIMITS` and the stored source schema; the local route's request (Ollama); the MCP assistant's runs step and the tool's description; Studio's wording where it repeats a limit; tests.

Not included:
- more than 4 sources, or longer lines (a citation must still point at a readable line);
- splitting a long source automatically, or chunked generation;
- repositories and PDF documents (P-20261024-disassembly, D11–D12);
- measuring memory and time on local models;
- a different number of parts per level.

## Preconditions

- **P-20261029-source-entry is completed** first. Only one plan implements at a time; this one starts from `main` after that plan's pull request, on a new branch `feature/source-limits`.
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
4. The owner's own document as one source, on the owner's device.

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

Approve with: `Approve P-20261029-source-limits v1`. Then implement with a separate command after P-20261029-source-entry is completed, for example `implement P-20261029-source-limits v1 --phase limits`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261029-source-limits v1`.
- Approved plan/version: `P-20261029-source-limits` / `1`.
- Recorded at: `2026-10-29T16:52:17+01:00` (Europe/Rome).
- Approved scope: phases `limits` (S1–S2), `assistant` (S3) and `verify` (S4), on a new branch `feature/source-limits` from `main` after P-20261029-source-entry is completed and merged.
- Approved-content SHA-256: `61c2e0b9e0396c561f8eabaf4a19c4d0a11135aff98f9370369162d9ab7885e1`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Larger sources` up to, and not including, `## Approval`.
- Authority boundary: implementation needs a separate implement command naming v1, and waits for P-20261029-source-entry to complete. Pushing, pull requests, merges and any generation that spends the owner's usage need the owner's confirmation when reached. The owner's document stays on the owner's device. No new dependency.

## State changes

- 2026-10-29: `awaiting_approval` → `approved` → `blocked`. Approval is recorded above; the plan waits for P-20261029-source-entry, as its precondition requires (one plan active at a time). It returns to `approved` when that plan completes.
