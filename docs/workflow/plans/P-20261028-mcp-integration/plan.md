---
id: P-20261028-mcp-integration
title: Break the Wall in Claude through MCP - open a text in Studio (level A), then let the assistant's model write a disassembly the app checks (level B)
version: 1
state: implementing
current_task: M3
last_evidence: Phase bridge (M1-M2) verified - 363 tests on macOS; the app from source answered hello and open on its socket and showed the text in Studio
next_action: Owner reviews phase bridge; then "implement P-20261028-mcp-integration v1 --phase server"
approval: approved
---

# Break the Wall in Claude through MCP

## Outcome

Someone who uses Claude Desktop or Claude Code connects Break the Wall once, from a panel in the app, without installing Node or anything else. From then on:

- **Level A.** In a conversation they say "open this in Break the Wall": the app comes to the front with Studio holding the text and the question, and they generate as usual.
- **Level B.** They say "take this apart with Break the Wall": Claude writes the disassembly itself, phase by phase, on their own Claude plan; every phase passes the app's own checks before the next one starts, and the finished disassembly appears in the library, marked as written by their assistant.

ChatGPT is not included (it cannot reach a server on the user's computer; see the research).

## Evidence

[Research R-20261027-mcp](../../research/R-20261027-mcp.md), from the local spike branch `spike/mcp` (commit `9a8914b`, not pushed):

- a hand-written stdio MCP server (`initialize`, `tools/list`, `tools/call`) was enough for Claude Code;
- level A: a local socket in the app imported the text like a paste and opened Studio (3 turns, $0.07);
- level B, phase 1 only: Claude wrote structures that `acceptStructure` accepted, Atlas at the first attempt and Mill at the second after the app's repair request (each under $0.25 and a minute);
- not tried: phases 2 and 3 through MCP, saving, Claude Desktop, a packaged app, Windows.

Repository facts the plan builds on:

- `src/core/disassembly-generation.ts` already exposes each phase as instructions, input builder, JSON schema and accept function (`STRUCTURE_`/`CONTENT_`/`RUNS_INSTRUCTIONS`, `build*Input`, `*JsonSchema`, `accept*`, `buildRepairRequest`), and `assembleDisassembly` is the only path from the three phases to a stored disassembly.
- `tests/disassembly-drafts.ts` (`draftsFrom`) turns a prepared disassembly into valid phase answers, so the whole level B flow can be tested without a model.
- `scripts/build-desktop.mjs` bundles the desktop code with esbuild, already a development dependency.
- The stored origin `generation.provider` (`src/core/disassembly.ts`) accepts only `chatgpt` and `local`.
- Claude Desktop is installed on the owner's Mac, as is Claude Code 2.1.303.

## Owner's decisions (2026-10-28)

- Scope: level A first; level B, for all three phases, in its own phase that may slip without holding back a release of level A.
- Distribution: inside the app. The server ships with the app; a panel in the app adds it to Claude Desktop (a `.mcpb` Desktop Extension) and gives the command for Claude Code, which runs the server with the app's own Electron in Node mode. The user installs nothing else.
- Protocol: written by hand, as in the spike; no `@modelcontextprotocol/sdk`.

## Scope

Included:
- A local entry point in the app (socket on macOS, named pipe on Windows), off until the learner connects an assistant.
- Studio receiving a text and a question from outside (level A).
- The MCP server: protocol, tools, bundled with the app; a `.mcpb` built with the app; the "Use with Claude" panel.
- Level B for structure, content and runs, saving the result as a generated disassembly whose origin names the assistant.
- README, privacy and security notes, development notes, CHANGELOG, the adapter.

Not included:
- ChatGPT, remote (HTTP) MCP servers, OpenAI's tunnel.
- Level B for taking a part further apart (expansion) and for suggestions; they stay in the app.
- MCP Apps (interfaces drawn inside the assistant), resources and prompts.
- Publishing the extension in Anthropic's directory, or on npm.
- Automatic updates of the extension: a new app version ships a new `.mcpb`, added again from the panel.

## Preconditions

- **One plan implementing.** On approval, P-20261024-disassembly moves to `blocked` again ("waiting for the owner's witnessed checks (D8, D10); D11–D12 gated"), and returns to `implementing` when this plan completes or the owner resumes it.
- **No new dependency.** The server, the `.mcpb` (a zip written by a small script, like the `.ico` writer) and the tests use what the project has. If implementation finds one is needed, it stops and asks.
- **The spike stays local.** Code is rewritten from the spike on a feature branch, not merged from it. `spike/mcp` is deleted once level A is merged, on the owner's confirmation.
- **External actions** (pushing, tags, releases, anything sent to Anthropic outside the owner's own witnessed checks) only on the owner's explicit confirmation when reached. The witnessed level B checks spend the owner's Claude usage.

## How the pieces connect

```
Claude Desktop / Claude Code
   │  stdio, MCP JSON-RPC (one process per assistant session)
   ▼
Break the Wall MCP server (dist-electron/mcp-server.cjs)
   │  holds the level B session in memory; runs the app's own checks (src/core)
   │  local socket / named pipe, one JSON object per line
   ▼
Break the Wall app (main process) ── open → Studio (renderer)
                                   └─ save → validate again → DisassemblyStore → library
```

Arrows are "sends to". The server never writes to the app's data folder; the app is the only writer, and it validates whatever arrives as if it were a file.

## Tasks

### Phase `bridge` (level A in the app)

**M1. The local entry point.**
- `src/desktop/incoming.ts`: the address (`<userData>/incoming.sock` on macOS and Linux, mode 0600; `\\.\pipe\break-the-wall-<user>` on Windows), computed by one pure function shared by the app and the server, with the user data folder resolved the same way the app resolves it (`app.setName('Break the Wall')`, `BTW_USER_DATA_DIR`).
- A line protocol with a version: `{ v: 1, type: 'hello' }` (the app answers with its version), `{ v: 1, type: 'open', title?, text, question? }` and, in M7, `{ v: 1, type: 'save', disassembly }`. Each answer is `{ ok: true, … }` or `{ ok: false, error }`. Lines over a fixed size (enough for the largest source the app accepts, or a saved disassembly) close the connection; malformed JSON gets an error, never a crash.
- `open` imports the text with `importSource({ kind: 'paste' })`, so it meets the same limits as a paste, sends it to the renderer and brings the window to the front (creating one if none is open).
- The server listens only while the setting "Connect AI assistants" is on (a new optional field in `settingsSchema`, off by default); turning it off closes the socket and removes the file.

Acceptance: unit tests on the address, the line framing (split and joined chunks, oversized line, bad JSON, unknown type, wrong version) and the import errors; a test that the listener starts and stops with the setting.

**M2. Studio receives a text.** The preload exposes `onIncomingSource` (same validation as other bridge payloads); the library adds the source to the Studio draft without dropping sources already there, sets the question when one is given and the draft has none, and opens Studio. If a generation is running, the text waits in the draft and Studio says so instead of interrupting it.

Acceptance: `tests/studio.test.tsx` (or a new test) covers an incoming text on the library page, with a draft already open, and during a generation.

### Phase `server` (level A in Claude)

**M3. The MCP server.** `src/mcp/server.ts`, bundled by `scripts/build-desktop.mjs` to `dist-electron/mcp-server.cjs` (Node only: no Electron imports):
- the protocol by hand: `initialize` (echoing a supported protocol version, falling back to the latest the server knows), `notifications/initialized`, `ping`, `tools/list`, `tools/call`, and JSON-RPC errors for unknown methods and malformed input; nothing but protocol on stdout, logs on stderr;
- the tool `open_in_break_the_wall(text, title?, question?)`. If the app does not answer, the server starts it (`open -a "Break the Wall"` on macOS; Squirrel's stable `BreakTheWall.exe` launcher on Windows) and retries for up to 15 seconds. When the app runs but the connection is off, the answer tells the assistant what the learner must do;
- tool descriptions written for the model, stating what the app does and that the learner generates in the app.

Acceptance: protocol tests drive the server through in-memory streams (handshake, list, call, errors, a fake app socket); a test that the bundle starts with plain Node and answers `initialize`.

**M4. Installing it in Claude.**
- `npm run build` also writes `dist-electron/break-the-wall.mcpb`: a zip, written by a small script without a dependency, holding `manifest.json` (MCPB format checked against Anthropic's current documentation at implementation time) and the server.
- The panel "Use with Claude", reachable from the library and from Studio:
  - the switch "Connect AI assistants" (M1);
  - "Add to Claude Desktop": opens the bundled `.mcpb`, which Claude Desktop installs;
  - "Claude Code": the command to copy, `claude mcp add break-the-wall -e ELECTRON_RUN_AS_NODE=1 -- "<app executable>" "<server path>"`, with this installation's paths filled in;
  - what changes for privacy (below, M8) and how to remove it.
- On Windows the command names the current version's folder; the panel says to copy it again after installing a new version.

Acceptance: a test that the `.mcpb` is a valid zip whose manifest names the server; tests of the panel's command for macOS and Windows paths in both languages; `npm run package` and the Windows release job pass with the server and the `.mcpb` inside the app, and the packaged app's server answers `initialize` when run with `ELECTRON_RUN_AS_NODE=1` (added to the existing start check).

### Phase `assistant` (level B)

**M5. The origin "written by your assistant".** `generation.provider` (and the expansion origin) also accepts `assistant`, with `model` holding the client's name and version as it reported them in `initialize` (for example "claude-code 2.1.303"; the model itself is not reliably known). Files written before stay valid. The library card, the player's tag and the origin line say "Written by your assistant (claude-code 2.1.303)" / "Scritto dal tuo assistente (…)". Reopening such a disassembly to take a part further apart uses the app's chosen route, as for any generated disassembly.

Acceptance: contract tests for the new value and for old files; wording tests in both languages.

**M6. The level B tools.** In the server, one session per assistant conversation (the server process), held in memory:
- `start_disassembly(text, title?, question, language?)`: imports the text like a paste and returns the structure instructions, the numbered source and the schema;
- `submit_structure(json)`, then `submit_part(index, json)` for each top-level part, then `submit_runs(json)`: each runs the app's accept function for that phase; on findings it returns `buildRepairRequest`; once accepted it returns the next step's instructions, input and schema, so the assistant always knows the next call;
- at most 3 attempts per step; after that the session stops with a message that suggests generating in the app (level A) instead;
- each step's answer says how many steps remain, so the assistant can tell the learner.

Acceptance: an end-to-end test drives Atlas and Mill through all the tools with `draftsFrom`'s answers and gets a disassembly equal to `assembleDisassembly`'s; tests for a refused step, the repair text, the attempt limit, a call out of order, and a new `start_disassembly` replacing an unfinished session.

**M7. Saving and opening it.** After `submit_runs` is accepted, the server composes the disassembly (origin `assistant`), sends `save` to the app (starting it as in M3), and the app validates it again with the same function as any stored file, saves it through `DisassemblyStore`, and opens it in the player. If the app is not reachable, the tool answer says so and keeps the session, so a later retry can save it.

Acceptance: the M6 end-to-end test ends with the disassembly in a temporary `DisassemblyStore` through a real socket; a `save` with an invalid disassembly is refused with the validation findings; the renderer test opens a saved disassembly sent from outside.

### Phase `release`

**M8. Instructions and records.** README: "Use with Claude" (what levels A and B do, connecting from the panel, example requests, removing it) and the privacy section: with level B the source goes to Anthropic through the learner's own Claude app, on their plan; with level A nothing leaves the computer until they generate, as before. SECURITY: the local socket (same-user only, off by default, everything validated as a file would be). `docs/development.md`: the server, the protocol, the `.mcpb`, running the server from source, the tests. CHANGELOG, and the adapter's technical-direction line.

Acceptance: the steps match what M9 observes.

**M9. Witnessed checks on the owner's Mac, with the packaged app.** After `npm run package` (or a release build the owner confirms), the owner, with the agent:
1. turns the connection on in the panel and adds the extension to Claude Desktop with one click;
2. level A in Claude Desktop: an answer opens in Studio, with the app closed beforehand and with it open;
3. level A in Claude Code with the command from the panel;
4. level B in Claude Desktop or Claude Code on Atlas (English) and Mill (Italian): all three phases, the disassembly in the library with the assistant's origin, a run and a reassembly work; attempts, turns and cost are recorded;
5. turning the connection off: the tool answer tells the assistant, and nothing reaches the app.

Acceptance: the owner reports each point; the README is corrected for anything that differs. Windows is covered by CI only, unless the owner also tries it in the virtual machine.

If the owner releases before the `assistant` phase is done, M8 and M9 cover level A only and the plan is revised (v2) to place `assistant` after them.

## Risks

- **Protocol versions.** A hand-written server may lag behind protocol changes; `initialize` negotiates the version, and the tests pin the handshake that Claude Desktop and Claude Code send today. Moving to the SDK stays open.
- **`ELECTRON_RUN_AS_NODE`.** It works because the packaged app keeps Electron's default fuses; if code signing later flips the `RunAsNode` fuse, the Claude Code route needs another launcher. Claude Desktop's `.mcpb` runs on Claude's own Node and is not affected.
- **The `.mcpb` format** is young; the manifest is checked against the documentation at implementation time and witnessed in M9.
- **Tool descriptions steer the model**: level B depends on the assistant following the steps in order; the server refuses out-of-order calls and says what comes next.
- **Two level B runs were a signal, not a measurement.** Phases 2 and 3 through MCP are untried; long sources mean many `submit_part` calls and a long conversation in the assistant. M9 records the cost.
- **The socket** accepts any process of the same user while the connection is on. Such a process could also write the data folder directly; the socket adds no new power, and everything it receives is validated.
- **Windows**: the named pipe and the launcher are tested in CI, not witnessed; the Claude Code command breaks after an update until copied again.
- **Scope for one week**: the `assistant` phase may slip, as decided.

## Verification strategy

| Check | Kind | Command or flow |
|---|---|---|
| Types and tests on macOS and Windows | Automated test | `npm run check` in both CI jobs |
| Socket framing, address, import | Automated test | M1 unit tests |
| Studio hand-off | Automated test | M2 renderer tests |
| MCP protocol and tools | Automated test | M3 and M6 tests through in-memory streams |
| Level B end to end without a model | Automated test, integration check | M6–M7 test with `draftsFrom`, a real socket and a temporary store |
| Bundle, `.mcpb`, packaged server | Targeted build, integration check | `npm run build`, `npm run package`, the Windows release job, the start check with `ELECTRON_RUN_AS_NODE=1` |
| Level A and B in Claude | Witnessed flow | M9 on the owner's Mac |

## Approval

Approve with:

```text
Approve P-20261028-mcp-integration v1
```

Approval records it only. Implementation starts with a separate `implement P-20261028-mcp-integration v1 [--phase bridge | --phase server | --phase assistant | --phase release]`.

## Approval record

Version 1, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261028-mcp-integration v1`.
- Approved plan/version: `P-20261028-mcp-integration` / `1`.
- Recorded at: `2026-10-28T15:56:14+01:00` (Europe/Rome).
- Approved scope: M1–M2 (phase `bridge`), M3–M4 (phase `server`), M5–M7 (phase `assistant`) and M8–M9 (phase `release`) as written.
- Approved-content SHA-256: `46653d3dcd66fad6aa8b923d18238cc2b8c9e2d60af1bd3697e9cf2367b0e251`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Break the Wall in Claude through MCP` up to, and not including, `## Approval`.
- Authority boundary: this records approval only. Implementation needs a separate implement command. Not authorized without the owner's confirmation right before each one:
  - any dependency change;
  - pushing, opening pull requests, tags or releases;
  - deleting the `spike/mcp` branch or the untracked `* 2` duplicates;
  - level B runs against Anthropic that spend the owner's Claude usage, outside the witnessed checks the owner runs in M9.

## Implementation record

### Phase `bridge` (M1–M2), 2026-10-28

Started by the owner's command `implement P-20261028-mcp-integration v1 --phase bridge`, on the branch `feature/mcp-integration` (from `origin/main` at `ba015ac`, with the research and this plan).

- **M1**, `src/desktop/incoming.ts`, shared with the MCP server in M3:
  - `defaultUserData` gives the data folder as Electron resolves it for "Break the Wall" on each system, with `BTW_USER_DATA_DIR` first.
  - `incomingAddress` gives `<userData>/incoming.sock`, or a pipe on Windows, `\\.\pipe\break-the-wall-<first 12 hex of SHA-256(userData)>`, so a development copy never answers for the installed app. A socket path over 100 bytes falls back to the user's private temporary folder.
  - `lineReader` frames lines on bytes, so multi-byte characters survive chunk boundaries, and stops at 4 MiB.
  - `answer` handles protocol 1: `hello` (app and version) and `open` (`title?`, `text`, `question?`). Bad JSON, another protocol version, an unknown type and a malformed request get an error answer. Import errors carry the paste's code and parameters; any other failure becomes "unavailable", without its message.
  - `IncomingServer.setEnabled` starts or stops the listener (socket mode 0600, a stale file replaced, the file removed when off) and answers each connection's lines in order. A line that is too long gets one error answer, then the connection closes.
- **M1**, settings and main process:
  - `settingsSchema` gains the optional `assistants` ("Connect AI assistants"; absent means off).
  - `main.ts` builds the listener in `registerStudio` and syncs it with the setting at start and after every `settings:save`.
  - `open` imports the text with `importSource({ kind: 'paste' })`, with a default title in the interface language and the question cut to the goal's 400 characters. It keeps the text, at most `SOURCE_LIMITS.maxSources` of them, until the renderer has called `incoming:ready`, then sends `studio:incoming`. It restores, shows and focuses the window, creating one if none is open.
- **M2**:
  - `IncomingSource` and `incomingSourceSchema` are in `src/core/provider.ts`. `onIncomingSource` in the bridge is checked by the preload, which also announces readiness.
  - `App` collects the texts and goes back to the library, which opens Studio.
  - Studio adds the texts to the sources already chosen through its own selection checks, skipping a text it already has. It sets the question only when the draft has none, goes back to the material step, and says "From your assistant: …". While a generation runs, it says the text will be added when the generation ends, and adds it then.

| Check | Kind | Result |
|---|---|---|
| `tests/incoming.test.ts` (12 tests) | Automated test | **passed**: address per system and fallback, framing (split, joined, multi-byte, oversized), answers (hello, open, errors, import limits, hidden failures), the listener on a real socket (off/on, 0600, order, removal, stale file, too-long line) |
| `tests/studio.test.tsx` (3 new) | Automated test | **passed**: from the library with text and question, the same text again ignored; added to an open draft without replacing its question; held during a generation with the notice, then added |
| Types | Static inspection | **passed** with `tsc --noEmit` over the tracked sources. `npm run typecheck` fails on this machine only because of untracked sync copies (`src/renderer/i18n/en 2.ts` and others), which lack the new keys and are not in the repository |
| `npx vitest run` | Automated test | **passed**: 24 files, 363 tests |
| `vite build` and `scripts/build-desktop.mjs` | Targeted build | **passed** |
| The app from source, with a temporary data folder and `assistants: true` | Integration check | **passed**: the data path is over 100 bytes, so the socket fell back to the temporary folder; `hello` answered `0.2.0-alpha`, protocol 1; `open` answered `{ ok, title, lines: 2 }`; through the DevTools protocol, Studio showed "From your assistant: Validazione HTTPS." and the source; an empty text got `empty`; saving the setting off removed the socket, and on recreated it with `srw-------` |
| Windows | Automated test | **not run** yet: the Windows CI job runs on the pull request |

| Task | Verdict |
|---|---|
| M1 | **verified** on macOS; the named pipe is verified when the Windows job passes |
| M2 | **verified** |
