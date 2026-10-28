---
id: P-20261028-mcp-integration
title: Break the Wall in Claude through MCP - open a text in Studio (level A), then let the assistant's model write a disassembly the app checks (level B)
version: 4
state: completed
current_task: none
last_evidence: M1-M9 verified - level B witnessed in Claude Desktop and Claude Code; M9 points 5-6 residual, covered by tests
next_action: None; ChatGPT, level B drafts and expansion through MCP would be a new plan
approval: approved
---

# Break the Wall in Claude through MCP

## Outcome

Someone who uses Claude Desktop or Claude Code connects Break the Wall once, from a panel in the app, without installing Node or anything else. From then on:

- **Level A.** In a conversation they say "open this in Break the Wall": the app comes to the front with Studio holding the text and the question, and they generate as usual.
- **Level B.** They say "take this apart with Break the Wall", or use the server's `break` prompt: Claude writes the disassembly itself, phase by phase, on their own Claude plan; every phase passes the app's own checks before the next one starts, and the finished disassembly appears in the library, marked as written by their assistant.

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
- Version 2 (2026-10-28), after trying phase `server`: the server also offers one MCP prompt, `break`, so a learner can type a command with a question instead of asking in words ("si aggiungi il prompt nel server. Voglio il comando"). The owner also has a personal Claude Code command `/break` in `~/.claude/commands/`, outside the repository; it is not part of the product.
- Version 4 (2026-10-28), after the owner's level B run in Claude Desktop stopped at the runs: the app's findings must say how to fix them in numbers, and a step that fails three times must not throw away what was already accepted ("Sì, correggi prima").
- Version 3 (2026-10-28), after the first M9 run: the `break` prompt takes the text apart with level B (`start_disassembly` and the submit tools) instead of opening it in Studio. The owner wants generation through Claude, not ChatGPT ("Sì, livello B"). The personal `/break` was switched the same way.

## Scope

Included:
- A local entry point in the app (socket on macOS, named pipe on Windows), off until the learner connects an assistant.
- Studio receiving a text and a question from outside (level A).
- The MCP server: protocol, tools, the `break` prompt, bundled with the app; a `.mcpb` built with the app; the "Use with Claude" panel.
- Level B for structure, content and runs, saving the result as a generated disassembly whose origin names the assistant.
- README, privacy and security notes, development notes, CHANGELOG, the adapter.

Not included:
- ChatGPT, remote (HTTP) MCP servers, OpenAI's tunnel.
- Level B for taking a part further apart (expansion) and for suggestions; they stay in the app.
- MCP Apps (interfaces drawn inside the assistant), resources, and prompts other than `break`.
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

**M4a. The `break` prompt (added in version 2).**
- The server declares the `prompts` capability and answers `prompts/list` with one prompt, `break` ("Explain a topic and take it apart with Break the Wall"), whose single argument `topic` is optional. It answers `prompts/get` with one user message:
  - write a complete, self-contained explanation of the topic in the user's language; with no topic, use the last long answer of the conversation unchanged;
  - then take it apart with level B (version 3): call `start_disassembly` with the text, a title, the question and the language, and follow the steps it returns through `submit_structure`, `submit_part` and `submit_runs`, fixing the app's findings;
  - an unknown prompt is a JSON-RPC invalid-params error.
- Claude Code lists MCP prompts as commands named after the server and the prompt (expected `/mcp__break-the-wall__break <topic>`); Claude Desktop lists them among the conversation's attachments. The exact names are checked at implementation and witnessed in M9; the short `/break` exists only as a personal command.
- The `.mcpb` manifest lists the prompt next to the tool; the panel names the command in both languages.

Acceptance: protocol tests for `initialize` (prompts capability), `prompts/list`, `prompts/get` with and without a topic (the message names `start_disassembly` and the submit tools, not the open tool), and an unknown prompt; the manifest test lists the prompt; the panel test and the README name the command and say it takes the text apart; the packaged server check also lists the prompt.

### Phase `assistant` (level B)

**M5. The origin "written by your assistant".** `generation.provider` (and the expansion origin) also accepts `assistant`, with `model` holding the client's name and version as it reported them in `initialize` (for example "claude-code 2.1.303"; the model itself is not reliably known). Files written before stay valid. The library card, the player's tag and the origin line say "Written by your assistant (claude-code 2.1.303)" / "Scritto dal tuo assistente (…)". Reopening such a disassembly to take a part further apart uses the app's chosen route, as for any generated disassembly.

Acceptance: contract tests for the new value and for old files; wording tests in both languages.

**M6. The level B tools.** In the server, one session per assistant conversation (the server process), held in memory:
- `start_disassembly(text, title?, question, language?)`: imports the text like a paste and returns the structure instructions, the numbered source and the schema;
- `submit_structure(json)`, then `submit_part(index, json)` for each top-level part, then `submit_runs(json)`: each runs the app's accept function for that phase; on findings it returns `buildRepairRequest`; once accepted it returns the next step's instructions, input and schema, so the assistant always knows the next call;
- at most 3 attempts per step in a row (version 4: see M6a for what happens then);
- each step's answer says how many steps remain, so the assistant can tell the learner.

Acceptance: an end-to-end test drives Atlas and Mill through all the tools with `draftsFrom`'s answers and gets a disassembly equal to `assembleDisassembly`'s; tests for a refused step, the repair text, the attempt limit, a call out of order, and a new `start_disassembly` replacing an unfinished session.

**M7. Saving and opening it.** After `submit_runs` is accepted, the server composes the disassembly (origin `assistant`), sends `save` to the app (starting it as in M3), and the app validates it again with the same function as any stored file, saves it through `DisassemblyStore`, and opens it in the player. If the app is not reachable, the tool answer says so and keeps the session, so a later retry can save it.

Acceptance: the M6 end-to-end test ends with the disassembly in a temporary `DisassemblyStore` through a real socket; a `save` with an invalid disassembly is refused with the validation findings; the renderer test opens a saved disassembly sent from outside.

**M6a. Repairs that can succeed, and work that is not lost (added in version 4).** In the owner's run in Claude Desktop, the correct option of a multiple-choice run stayed more than 1.6× as long as the wrong ones for three attempts. The session then stopped, and the accepted structure and parts were lost.
- **The answer-length finding gives numbers** (`src/core/disassembly-generation.ts`, so ChatGPT and local models get it too): the correct option's length, the wrong ones' mean, and the most the correct option may have (`floor(1.6 × mean)`). It suggests both ways out: shorten the correct option, or make the wrong ones as specific.
- **Three failed attempts at a step no longer end the session.** What was accepted stays, and the step stays current. The answer tells the assistant to report the findings to the user and ask whether to try the step again. The next submit for that step starts a new count of 3. `start_disassembly` still replaces the session, and `open_in_break_the_wall` remains the way to let the app generate instead.

Acceptance:
- a contract test checks the finding's numbers;
- MCP tests check that after three failures the session keeps the structure and parts, says to ask the user, and accepts a fourth submit, which can then finish and save;
- the earlier attempt-limit test is updated;
- `npm run check` passes on both systems.

### Phase `release`

**M8. Instructions and records.** README: "Use with Claude" (what levels A and B do, connecting from the panel, example requests, removing it) and the privacy section: with level B the source goes to Anthropic through the learner's own Claude app, on their plan; with level A nothing leaves the computer until they generate, as before. SECURITY: the local socket (same-user only, off by default, everything validated as a file would be). `docs/development.md`: the server, the protocol, the `.mcpb`, running the server from source, the tests. CHANGELOG, and the adapter's technical-direction line.

Acceptance: the steps match what M9 observes.

**M9. Witnessed checks on the owner's Mac, with the packaged app.** After `npm run package` (or a release build the owner confirms), the owner, with the agent:
1. turns the connection on in the panel and adds the extension to Claude Desktop with one click;
2. level A in Claude Desktop: an answer opens in Studio, with the app closed beforehand and with it open;
3. level A in Claude Code with the command from the panel;
4. level B in Claude Desktop or Claude Code on Atlas (English) and Mill (Italian): all three phases, the disassembly in the library with the assistant's origin, a run and a reassembly work; attempts, turns and cost are recorded;
5. turning the connection off: the tool answer tells the assistant, and nothing reaches the app;
6. the `break` prompt with a question, in Claude Code and in Claude Desktop: Claude explains, takes it apart with level B, and the disassembly opens in the library.

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
| MCP protocol, tools and the prompt | Automated test | M3, M4a and M6 tests through in-memory streams |
| Level B end to end without a model | Automated test, integration check | M6–M7 test with `draftsFrom`, a real socket and a temporary store |
| Bundle, `.mcpb`, packaged server | Targeted build, integration check | `npm run build`, `npm run package`, the Windows release job, the start check with `ELECTRON_RUN_AS_NODE=1` |
| Level A and B in Claude | Witnessed flow | M9 on the owner's Mac |

## Approval

Approve with:

```text
Approve P-20261028-mcp-integration v4
```

Approval records it only. Implementation continues with a separate `implement P-20261028-mcp-integration v4 --phase release`. M6a ships with phase `release`, because phase `assistant` is merged. The changed prompt text ships with the docs of phase `release`, because phases `server` and `assistant` are merged. Their other work, done under versions 1 and 2, is unchanged.

## Approval record

Version 4, approved:

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261028-mcp-integration v4`.
- Approved plan/version: `P-20261028-mcp-integration` / `4`.
- Recorded at: `2026-10-28T18:09:29+01:00` (Europe/Rome).
- Approved scope: as version 3, plus M6a (answer-length findings with numbers; three failed attempts keep the accepted work and ask the user), shipped with phase `release`.
- Approved-content SHA-256: `434cb67d152ad23ffea5aa52f10b0d9e68a0e887b49cd2fb3b302adf3ab5f58f`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Break the Wall in Claude through MCP` up to, and not including, `## Approval`.
- Authority boundary: as for version 1 below. Implementation needs a separate implement command naming v4.

Version 3, approved (superseded by version 4):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261028-mcp-integration v3`.
- Approved plan/version: `P-20261028-mcp-integration` / `3`.
- Recorded at: `2026-10-28T17:17:36+01:00` (Europe/Rome).
- Approved scope: as version 2, with M4a's `break` prompt taking the text apart with level B (shipped in phase `release`) and M9 point 6 to match.
- Approved-content SHA-256: `10d1fc4b80f7dbe242f51a1cd95df17f0bb100505e0780ee236a6b1ccf1a539f`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Break the Wall in Claude through MCP` up to, and not including, `## Approval`.
- Authority boundary: as for version 1 below. Implementation needs a separate implement command naming v3.

Version 2, approved (superseded by version 3):

- Approver: project owner, through an explicit message in this conversation.
- Received command: `Approve P-20261028-mcp-integration v2`.
- Approved plan/version: `P-20261028-mcp-integration` / `2`.
- Recorded at: `2026-10-28T16:28:55+01:00` (Europe/Rome).
- Approved scope: M1–M2 (phase `bridge`, merged), M3, M4 and M4a (phase `server`), M5–M7 (phase `assistant`) and M8–M9 (phase `release`) as written. Version 2 adds M4a, M9 point 6 and the matching scope lines to version 1.
- Approved-content SHA-256: `d3905c4f0a7ba7e529f2d3ea79e2d29c1c691c3b2d5dd56f9c3e2335f641cec4`.
- Digest definition: SHA-256 of the UTF-8 plan body from `# Break the Wall in Claude through MCP` up to, and not including, `## Approval`.
- Authority boundary: as for version 1 below. Implementation needs a separate implement command naming v2.

Version 1, approved (superseded by version 2):

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

PR #29 merged into `main` at `40e192b`. On commit `5e4b9cc`, all of these passed: "Types, tests and build" (macOS), "Windows: types, tests and build", "Apple Silicon DMG" and "Windows x64 setup". The Windows job ran `tests/incoming.test.ts` on a named pipe, so **M1 is verified on Windows too**.

### Phase `server` (M3–M4), 2026-10-28

Started by the owner's command `implement P-20261028-mcp-integration v1 --phase server`, on the branch `feature/mcp-server` from `main` at `40e192b`. Before writing the manifest, the MCPB manifest format was checked against [the MCPB specification](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md): `manifest_version` 0.3, a `node` server with `mcp_config.args` using `${__dirname}`.

- **M3**:
  - `src/mcp/protocol.ts` implements MCP over stdio by hand:
    - `initialize` answers with the client's protocol version when it is one of 2025-11-25, 2025-06-18, 2025-03-26 or 2024-11-05, and with the latest otherwise; it keeps the client's name and version, for M5;
    - it also handles `ping`, `tools/list` and `tools/call`;
    - notifications get no answer;
    - JSON-RPC errors: parse error, invalid request, method not found, and an unknown tool as invalid params;
    - a tool that throws becomes a tool error the model can read;
    - stdout carries only protocol.
  - `src/mcp/server.ts` has the tool `open_in_break_the_wall(text, title?, question?)`:
    - it reaches the app through `incoming.ts`, one request and one answer per connection, with a 10-second limit;
    - when nothing listens, it starts the app and retries for 15 seconds: `open -a "Break the Wall"` on macOS; on Windows, Squirrel's `%LOCALAPPDATA%\BreakTheWall\BreakTheWall.exe`, started without `ELECTRON_RUN_AS_NODE`;
    - the app's refusals are worded for the model (sizes, lines, control characters, protocol), and so are the two dead ends (not installed; connection off, with the steps to turn it on).
  - `src/mcp/main.ts` is the entry point: it finds the address from `defaultUserData` and `incomingAddress`. `scripts/build-desktop.mjs` bundles it to `dist-electron/mcp-server.cjs`, targeting Node 18 with the version from `package.json`.
- **M4**:
  - **The extension.** `scripts/zip.mjs` (with `zip.d.mts`) writes the zip without a dependency: deflated entries, CRC-32, a fixed date, so the same input gives the same bytes. It also holds the MCPB manifest. `npm run build` writes `dist-electron/break-the-wall.mcpb` with `manifest.json`, `server/index.js` and `icon.png`.
  - **The Claude Code command.** `src/desktop/assistants.ts` builds `claude mcp add --scope user break-the-wall -e ELECTRON_RUN_AS_NODE=1 [-e BTW_USER_DATA_DIR=…] -- "<app executable>" "<server>"`. `-e` follows the name, because it takes several values (checked against `claude mcp add --help`). Arguments are quoted for POSIX shells or for Windows, and paths are moved into `app.asar.unpacked` when packaged.
  - **Main process.** `assistants:setup` returns the platform, the command and whether the extension exists. `assistants:add-desktop` opens the `.mcpb` with the system, so Claude Desktop offers to install it. `assistants:copy-command` writes only that command to the clipboard; the renderer cannot write anything else there.
  - **The panel.** `src/renderer/Assistants.tsx`, "Use with Claude" / "Usa con Claude", sits in the library's top bar, which Studio shares. It has the switch "Connect AI assistants", "Add to Claude Desktop", the command with "Copy command", the note to copy it again after an update on Windows, what crosses the connection (Claude can hand texts to the app; the app sends nothing to Claude), and how to disconnect or remove it. The privacy text for level B comes with M8.
  - **Packaging.** `scripts/package-common.mjs` unpacks the server and the extension from `app.asar` and adds `serverCheck`: right after the start check, the packaged executable runs its own server with `ELECTRON_RUN_AS_NODE=1` and must answer `initialize` and list the tool. The macOS and Windows package scripts both run it.

| Check | Kind | Result |
|---|---|---|
| `tests/mcp-server.test.ts` (10 tests) | Automated test | **passed**: protocol (negotiation, client name, ping, list, call, thrown error, JSON-RPC errors, notifications, stdio streams); the tool against a real socket (open, refusals worded, malformed call, app started late, not installed, connection off); the bundle built by esbuild and started with plain Node |
| `tests/assistants.test.ts` (5 tests) | Automated test | **passed**: the `.mcpb` read back entry by entry (sizes, CRC-32, manifest, entry point present), identical bytes for identical input; the command on macOS and Windows, with a custom data folder and an embedded quote |
| `tests/studio.test.tsx` (3 new) | Automated test | **passed**: the panel in Italian (switch saves `assistants`, extension opened, command shown and copied), in English on Windows (note to copy again, missing extension explained), and absent without the host methods |
| Types | Static inspection | **passed** with `tsc --noEmit` over the tracked sources (sync copies excluded, as in phase `bridge`) |
| `npx vitest run` | Automated test | **passed**: 26 files, 381 tests |
| `node scripts/build-desktop.mjs` | Targeted build | **passed**: `mcp-server.cjs` 774 kB, `break-the-wall.mcpb` 133 kB; `unzip -t` finds no errors |
| The app from source, with `assistants: true`, and its server run as the panel's command says | Integration check | **passed**: `assistantSetup` returned the command with Electron's path, `BTW_USER_DATA_DIR` and `dist-electron/mcp-server.cjs`; that executable in Node mode answered `initialize` (2025-11-25) and `tools/call open_in_break_the_wall` with "Opened … (3 lines)"; Studio showed "Dal tuo assistente: Validazione dei certificati." with the source |
| `vite build`, `build-desktop.mjs`, `scripts/package-mac.mjs` | Targeted build, integration check | **passed**: "signature: ad-hoc, verified" with the unpacked files inside the bundle; "start check: the library is drawn"; "server check: the MCP server 0.2.0-alpha answers with open_in_break_the_wall"; DMG 93.1 MB |
| The panel in the app from source | Witnessed (agent, DevTools screenshots of the test window) | **passed** after one fix: at 1280 px the panel opens under its button; at 420 px it first overflowed the left edge, because the narrow-window rule came before the base rule in `clarity.css`; moved after it, the panel spans the window with 16 px margins and the button shows only its icon |
| Windows packaging and the server check on Windows | Integration check | **not run** yet: the Windows release job runs on the pull request |

Not done here, and left to the owner's checks in M9: opening the `.mcpb` in Claude Desktop, which would ask to install it into the owner's Claude Desktop; running the Claude Code command, which writes to the owner's Claude Code settings; and the "app not running" path on this Mac, which would start the owner's installed copy.

| Task | Verdict |
|---|---|
| M3 | **verified** on macOS, from source and packaged; Windows when the pull request's jobs pass |
| M4 | **verified** for the build, the command, the panel and the packaged server on macOS; installing into Claude Desktop and Claude Code is witnessed in M9 |

### Phase `server`, M4a under version 2, 2026-10-28

The owner tried phase `server` with the packaged app and asked for a command ("si aggiungi il prompt nel server. Voglio il comando"). The plan became version 2 and was approved (`Approve P-20261028-mcp-integration v2`). Then came the command `implement P-20261028-mcp-integration v2 --phase server`, on the same branch with M3–M4 still uncommitted. On the owner's yes, the agent also wrote the owner's personal Claude Code command `~/.claude/commands/break.md`. It is outside the repository.

- **The prompt in one place.** `src/mcp/prompts.json` holds the prompt `break` once. It has one optional argument, `topic`, and its text uses `${arguments.topic}`, the placeholder form of the MCPB manifest (checked against [the specification](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md): `name` and `text` are required, `arguments` is a list of names).
  - The server reads the file. `src/mcp/protocol.ts` declares `prompts` in `initialize` and answers `prompts/list` (without the text) and `prompts/get` (one user message, with the placeholders filled in). An unknown prompt is a JSON-RPC invalid-params error.
  - `scripts/build-desktop.mjs` reads the same file into the `.mcpb` manifest.
- **What Claude Code does with prompts.** Its documentation says it lists them as `/break-the-wall:break (MCP)`, also runs `/mcp__break-the-wall__break`, and splits arguments on whitespace. A probe confirmed what that means here. The probe was a throwaway server and `claude -p --model haiku`, two runs, under one cent:
  - `/mcp__probe__one Spiegami come il browser verifica un certificato` reached the server as `{"topic":"Spiegami"}`;
  - a prompt without arguments received `{}`;
  - quotes did not help: the server got `"Spiegami`.
- **How the prompt copes.** Its text therefore:
  - explains when the topic says what to explain;
  - sends the last long answer unchanged when the topic is empty or only a word, such as a lone "Explain", and the conversation has one;
  - otherwise asks the user in one line what to explain.
  Claude Desktop shows the argument as a field, so a whole question fits there. The panel explains both clients in both languages. The short `/break` with a whole question exists only as the owner's personal command.
- **The packaged check.** `serverCheck` now also requires `prompts/list` to name `break`.

| Check | Kind | Result |
|---|---|---|
| `tests/mcp-server.test.ts` (3 new, bundle test extended) | Automated test | **passed**: prompts capability, `prompts/list` without the text, `prompts/get` with the topic trimmed into one user message ending in the tool call, an empty or one-word topic, a non-string topic, an unknown prompt; the bundle started with plain Node lists `break` |
| `tests/assistants.test.ts` (manifest test extended) | Automated test | **passed**: the manifest's `prompts` is `[{ name: 'break', description, arguments: ['topic'], text }]` with `${arguments.topic}` |
| `tests/studio.test.tsx` (panel tests extended) | Automated test | **passed**: the prompt hint in Italian and English |
| Types; `npx vitest run` | Static inspection, automated test | **passed**: 26 files, 384 tests |
| `scripts/package-mac.mjs` | Targeted build, integration check | **passed**: "server check: the MCP server 0.2.0-alpha answers with the tool open_in_break_the_wall and the prompt break"; DMG 93.2 MB |
| Claude Code's handling of prompt arguments | Integration check (agent, `claude -p` with Haiku) | **observed**: only the first word reaches the server; recorded above |

| Task | Verdict |
|---|---|
| M4a | **verified** for the server, the manifest and the panel; the prompt in Claude Desktop and Claude Code with a real conversation is witnessed in M9 point 6 |

PR #30 (phase `server`) was merged into `main` at `1ec41e3`. On `e654956`:
- "Windows x64 setup" passed, with 372 tests, "start check: the library is drawn" and "server check: the MCP server 0.2.0-alpha answers with the tool open_in_break_the_wall and the prompt break" (setup 157.2 MB). **M3, M4 and M4a are verified on Windows too.**
- "Apple Silicon DMG" was still queued on GitHub's macOS runners when the pull request was merged; the same script passed locally.
- "Windows: types, tests and build" failed once. An older Studio test clicked "Continue to the question" while the added source was still being hashed. On the owner's yes, commit `98eccf7` makes the test helper wait for the enabled button, and both CI jobs passed on it.

### Phase `assistant` (M5–M7), 2026-10-28

Phase `server` was committed as `e654956` on `feature/mcp-server` and opened as PR #30, on the owner's request ("fai commit e PR"). Then came the command `implement P-20261028-mcp-integration v2 --phase assistant`. The work was done on top of `feature/mcp-server`; after PR #30 merged, it was moved onto `main` at `1ec41e3` as `feature/mcp-assistant`.

- **M5**:
  - `generation.provider`, and the provider of an expansion, also accept `assistant`, in `src/core/disassembly.ts`. `GenerationMeta` follows. Files written before stay valid.
  - `originText` in `preferences.tsx` words the origin in one place. The library card and the player's tag say "Written by your assistant" / "Scritto dal tuo assistente", with "Your assistant · <client name and version>" as the title. ChatGPT and local origins read as before.
- **M6**, `src/mcp/assistant.ts`: one `AssistantWriter` per server process.
  - `start` imports the text like a paste, checks the question (10–400 characters) and picks the language: the one given, else the question's, else English. It records the origin as `assistant`, with the client's name and version from `initialize`.
  - Each `submit_*` runs the app's accept function for that phase: `acceptStructure`, `acceptContent`, `acceptRuns`. On findings it returns `buildRepairRequest`; on success, the next step's instructions, schema and input, with "STEP n of N".
  - The JSON may arrive as a string or as an object.
  - At most 3 attempts per step; a success resets the count. After the third failure the session stops and suggests `open_in_break_the_wall`.
  - Out-of-order calls say what comes next. A new `start_disassembly` replaces an unfinished session.
  - `src/mcp/server.ts` exposes the four tools, and the server's instructions say when to use which.
  - The server now targets Node 20 (bundle and manifest `>=20.0.0`), because importing a source uses the global Web Crypto, which Node 18 lacks.
- **M7**:
  - **Protocol**: `incoming.ts` gains `{ v: 1, type: 'save', disassembly }`. Validation findings come back as `invalid` with the first ten paths.
  - **The rule**: `saveFromAssistant` in `src/desktop/assistants.ts` validates the disassembly like any stored file and accepts only a new generated disassembly with the `assistant` origin and no expansions. The same one sent again is returned; a different one under a stored id is refused.
  - **Main process**: `main.ts` uses it, then queues `studio:disassembly` for the renderer (the queue is the one texts use) and brings the window forward. `App` validates it again, adds it to the library and opens it in the player.
  - **If the app is unreachable**, `submit_runs` keeps the finished disassembly and says to call again; the next call saves it.
  - **The extension's manifest** lists the five tools.

| Check | Kind | Result |
|---|---|---|
| `tests/mcp-assistant.test.ts` (8 tests) | Automated test, integration check | **passed**: Atlas and Mill taken through every tool against a real socket and a temporary `DisassemblyStore`, and the stored disassembly equals `assembleDisassembly` over the same answers, with the origin `assistant` / `claude-code 2.1.303`; findings and the attempt limit; out-of-order calls, a short question, an oversized text, a replaced session, a malformed start; the save kept when the app is down and done on the next call, then repeated harmlessly; an invalid or malformed save, and an app without save support; `saveFromAssistant` refusing a prepared disassembly, another origin, expansions and a different disassembly under a stored id; the origin values in the contract |
| `tests/studio.test.tsx` (2 new) | Automated test | **passed**: a saved disassembly sent by the host opens in the player tagged "Scritto dal tuo assistente" with its title, ignores a payload that is not a disassembly, and stays in the library; the card in English |
| `tests/mcp-server.test.ts`, `tests/assistants.test.ts` | Automated test | **passed** with the five tools |
| Types; `npx vitest run` | Static inspection, automated test | **passed**: 27 files, 394 tests |
| `scripts/package-mac.mjs` | Targeted build, integration check | **passed**: "server check: the MCP server 0.2.0-alpha answers with the tools open_in_break_the_wall, start_disassembly, submit_structure, submit_part, submit_runs and the prompt break" (before the wording fix to "tools"); DMG 93.1 MB; server bundle 862 kB |
| Level B in the app from source, without a model | Integration check | **passed**: Atlas's answers through the bundled server, run as Claude Code runs it (the app's Electron in Node mode), were accepted at every step (start, structure, 6 parts, runs); `main.ts` saved `g-…` in the data folder; the player opened with "Scritto dal tuo assistente", titled "Il tuo assistente · claude-code live-check" |
| Level B with Claude itself | Witnessed flow | **not run**: it spends the owner's Claude usage and is M9 point 4 |

| Task | Verdict |
|---|---|
| M5 | **verified** |
| M6 | **verified** without a model; a real model's run is witnessed in M9 |
| M7 | **verified** in the app from source; Windows when the pull request's jobs pass |

PR #31 (phase `assistant`) was merged into `main` at `e604d30`. On `89c5ffe`, these passed: "Types, tests and build", "Windows: types, tests and build", and "Windows x64 setup" (with the server check). The DMG job was still waiting for a GitHub macOS runner. **M7 is verified on Windows too, for the automated tests and the packaged server.**

### Phase `release`, 2026-10-28

Started by the owner's command `implement P-20261028-mcp-integration v2 --phase release`, on `feature/mcp-release` from `main` at `e604d30`.

- **M8, written**:
  - README:
    - the header line and the alpha note name Claude;
    - a new section, "Use with Claude", covers the two ways (open in Studio; Claude writes it), connecting once from the panel, the `break` prompt in each client with Claude Code's first-word limit, what leaves the computer in each way, the limits (no ChatGPT; add again after an update; an interrupted session is lost) and disconnecting or removing it;
    - a "Your Claude assistant" row in the generation routes;
    - the local entry point under privacy;
    - an "Assistants" row in the tech stack;
    - the plan and a "Claude integration" row in the project status;
    - the roadmap: Claude ticked, ChatGPT open.
  - SECURITY: the entry point and the MCP server in scope.
  - `docs/development.md`:
    - the server check in packaging;
    - a section "The MCP server": the diagram, the build, running it from source, the address, the tests and the prompt-argument limit.
  - CHANGELOG (Unreleased) and the adapter: `src/mcp` named as an owner, and in the technical direction.
- **M8, still open**: during this phase the owner asked for a GIF of a real case with Claude in the README ("questa feature è davvero una killer feature"). It is to be made from the owner's own screen recording of an M9 run, and its frames reviewed for private content before anything is committed.

#### M9, first run by the owner in Claude Desktop: the wrong tool

The owner asked Claude Desktop to take a text apart with Break the Wall. Claude called `open_in_break_the_wall` (level A): it opened the text in Studio and told the owner to press Generate, which asks for ChatGPT or a local model. It should have called `start_disassembly` (level B). There were two causes:

- **The descriptions overlapped.** The open tool's description included "take apart". The fix: the open tool now says it opens the text "WITHOUT taking it apart", should be used only to open or send a text for the app to generate, and should give way to `start_disassembly` for "take apart / break down / disassemble (smonta, scomponi)". `start_disassembly` now begins with "Take a text apart with Break the Wall", and the server's instructions say the same. A test in `tests/mcp-server.test.ts` guards the wording.
- **The installed extension was out of date.** Its manifest, from a DMG built before the manifest listed the level B tools, named only the open tool. The server inside it already had all five. The rebuilt `.mcpb` lists all five.

| Check | Kind | Result |
|---|---|---|
| `tests/mcp-server.test.ts`, `tests/mcp-assistant.test.ts`, `tests/assistants.test.ts` | Automated test | **passed**: 26 tests, then 13 with the new guard |
| `scripts/package-mac.mjs` | Targeted build, integration check | **passed**: server check with the five tools and the prompt; DMG 93.2 MB; the manifest lists the five tools |
| Level B in Claude Desktop with the new descriptions | Witnessed flow | **pending**: the owner reinstalls the app and the extension and tries again |

#### M4a under version 3: the `break` prompt takes the text apart

Started by the owner's command `implement P-20261028-mcp-integration v3 --phase release`.

- **The prompt.** `src/mcp/prompts.json` now titles it "Take it apart with Break the Wall". Its text decides the text to take apart, as before (explain the topic, use the last long answer, or ask), then calls `start_disassembly` with the text, title, question and language. Claude then follows `submit_structure`, `submit_part` and `submit_runs`, fixing the app's findings. It never names the open tool.
- **The panel.** Its introduction and the prompt hint describe both ways, in both languages: Claude takes a text apart, or Claude opens it in Studio.
- **README and CHANGELOG** describe the prompt as "Claude writes it" in one step.

| Check | Kind | Result |
|---|---|---|
| Types; `npx vitest run` | Static inspection, automated test | **passed**: 27 files, 394 tests. The prompt test requires the four level B tools and the absence of the open tool; the panel tests check the new hint in both languages |
| `build-desktop.mjs`, `scripts/package-mac.mjs` | Targeted build, integration check | **passed**: the manifest's prompt text starts "The user wants to take something apart with Break the Wall"; server check with the five tools and the prompt; DMG 93.2 MB |

#### M9 runs by the agent, on the owner's request ("prova tu")

The owner could not record yet and asked the agent to try. The agent ran the packaged app from the new DMG, mounted read-only, with a temporary data folder and `assistants: true`, so the owner's installed app and data were untouched. It connected Claude Code (`claude -p`, model `sonnet`) through a temporary MCP config that runs the app's own server as the panel's command does (`ELECTRON_RUN_AS_NODE=1`), without changing the owner's Claude Code settings. The runs spent the owner's Claude usage, which the request authorized.

| # | Run | Tools, in order | Result |
|---|---|---|---|
| A | "Spiegami come il browser verifica un certificato HTTPS, poi smonta la spiegazione con Break the Wall." Claude Code picked the owner's personal `/break` skill, which then called the server | `start_disassembly` (47 lines, Italian) → `submit_structure` ✓ (7 parts) → `submit_part` 0 ✗ then ✓ → parts 1–6 ✓ → `submit_runs` ✓ | **passed**: 7 parts, 3 runs; 15 turns, $0.42, 107 s. The app saved `g-…`, and the player opened tagged "Scritto dal tuo assistente", titled "Il tuo assistente · claude-code 2.1.303", with the drawing and the cited source |
| B | "Smonta questo testo con Break the Wall:" plus a paragraph on a water mill, with `--disable-slash-commands`, so only the tool descriptions steer | `start_disassembly` → `submit_structure` ✓ (6 parts) → parts 0–5 ✓ → `submit_runs` ✓ | **passed**: every step accepted at the first attempt; 6 parts, 2 runs; 11 turns, $0.40, 55 s. The routing fix works: "smonta" now leads to level B |

Observed in run B: the paragraph arrived as one line, so every citation points at line 1. The import keeps the user's text as it is, by design. A follow-up could ask, in `start_disassembly`'s description, for one sentence or step per line when the text is one paragraph, so that parts can cite lines.

Earlier, the owner had seen level A in Claude Desktop (the text opened in Studio, Claude's answer quoted above) and the personal `/break` in Claude Code at level A (the text opened in Studio with the question filled in).

| M9 point | Status |
|---|---|
| 1. Connection on; extension added to Claude Desktop with one click | **witnessed by the owner** (the extension was installed and used) |
| 2. Level A in Claude Desktop | **witnessed by the owner**, with the app already open |
| 3. Level A in Claude Code | **witnessed by the owner** through the personal `/break` (version 2 wording) |
| 4. Level B | **passed in Claude Code** (runs A and B); Claude Desktop not yet |
| 5. Connection off | covered by automated tests; not witnessed |
| 6. The `break` prompt in both clients | not yet run |

#### M8: the README GIF of a real Claude run

The owner asked for the GIF to be made by the agent ("crea tu la GIF … rispetta lo stile della GIF già sul README"). `docs/images/claude.gif` is 960×540 at 10 fps, 36 s, 3.2 MB. It was made with the same pipeline as `docs/images/demo.gif`, rebuilt from this session's history: the composer that draws the wallpaper, the window, the cursor, the click rings, the pill captions and the end card. The composer gained a still event, a title per window and hard cuts.

- **The run.** A real level B run: the app from source in English and blueprint, with a temporary data folder and `assistants: true`, and Claude Code (`claude -p`, Sonnet, `--disable-slash-commands`) through the bundled server. The prompt was "Explain how a browser checks an HTTPS certificate, then take your explanation apart with Break the Wall."
  - `start_disassembly` (27 lines).
  - `submit_structure` ✗: joint labels 30 and 31 characters long, for 24. Then ✓, 6 parts.
  - Parts 0–5 ✓.
  - `submit_runs` ✗: a slot label repeated a part's name, and a correct option was 1.85× as long as the wrong ones. Then ✓, saved.
  - 13 turns, $0.38, 97 s.
- **The app frames** are the app itself, captured over the DevTools protocol at 1440×860 @2x:
  - the library;
  - the "Use with Claude" panel with the switch on. Its command was replaced, in the page only, with the installed app's `/Applications/…` form, so that no local path or user name appears;
  - the disassembly arriving, tagged "Written by your assistant";
  - a part with its source lines;
  - the scenario run for two steps.
- **The terminal frames** are the run's tool calls and results, redrawn from its `stream-json` transcript in a terminal page, with long arguments shortened. They are not a screen capture of Claude Code, and the README says so.
- **The end card**: "Claude writes it → the app checks it → you run it", with "Works with Claude Desktop and Claude Code · Open source · Alpha for macOS and Windows".
- **Review.** Every 2–3 seconds of the GIF was checked on contact sheets. Two fixes followed: hard cuts between terminal states, because crossfades ghosted the scrolled text, and no cursor over the terminal. No private content appears: only the temporary data folder's app, the public examples and the run's own text. The temporary data folder and run directory were deleted.
- **README.** A line and the GIF under the existing demo ("New: take a text apart from Claude"), and a paragraph in "Use with Claude" stating that the run is real, its cost, and that the terminal is redrawn from the transcript.

#### M6a under version 4, 2026-10-28

The owner's level B run in Claude Desktop ("Explain how a browser checks an HTTPS certificate, then take your explanation apart with Break the Wall") stopped at the runs. In a multiple-choice run the correct option stayed more than 1.6× as long as the wrong ones for three attempts, and the session ended with the structure and parts lost. Plan version 4 was approved, and the owner's command `implement P-20261028-mcp-integration v4 --phase release` started this work.

- `src/core/disassembly-generation.ts`: the answer-length finding gives the correct option's length, the wrong ones' mean, and the most the correct option may have (`floor(1.6 × mean)`). It names both ways out: shorten it, or make the wrong ones as specific and as long. The app's own routes get the same message.
- `src/mcp/assistant.ts`: after 3 failed attempts in a row, the session keeps what was accepted and the step stays current. The count restarts, and the answer, which carries the findings, tells the assistant to stop, report to the user, and submit again only if they agree, or to offer `open_in_break_the_wall`.
- README ("Use with Claude") and CHANGELOG describe both changes.

| Check | Kind | Result |
|---|---|---|
| `tests/disassembly-generation.test.ts` (giveaway test extended) | Automated test | **passed**: the finding reads "it has N characters and the wrong ones 10 on average, so it may have at most 16" |
| `tests/mcp-assistant.test.ts` (attempt-limit test rewritten) | Automated test | **passed**: after three failures the answer keeps the work, says to ask the user and carries the findings; a fourth submit starts a new count; the remaining parts and the runs complete the disassembly |
| Types; `npx vitest run` | Static inspection, automated test | **passed**: 27 files, 394 tests |
| `scripts/package-mac.mjs` | Targeted build, integration check | **passed**: start check, server check with the five tools and the prompt; DMG 93.2 MB |
| Level B in Claude Desktop again | Witnessed flow | **pending**: the owner's next run |

| Task | Verdict |
|---|---|
| M6a | **verified** by automated tests; the owner's Claude Desktop run is the witnessed check |

#### M8: the README GIF, second version

The owner asked for a clearer GIF ("focus sul prompt dell'utente, dove vedo la scrittura del prompt … tema carta … dividi in due gif … occhio a non perdere la parte di esecuzione"), keeping the terminal ("tieni terminale, però rendilo più chiaro"). `docs/images/claude.gif` was remade: 960×540 at 10 fps, 43 s, 3.5 MB.

- **The terminal:**
  - text twice the size;
  - the request typed in the input box, three characters a frame, with the box highlighted;
  - each call as the tool's name and one line, ✓ or ✗ with a short, faithful summary of that call's result in the real run (for example "Not accepted: two joint labels and one lead are over their length limits").
  The request is typed in words, not as `/break`. `/break` is the owner's personal command, and the server's prompt in Claude Code receives only the first word.
- **The app, in paper:**
  - the library, and the panel with its switch on (the command shown in the installed app's form);
  - the disassembly arriving, tagged "Written by your assistant";
  - a part with its source lines;
  - the scenario run for four steps, ending on "Right prediction".
  The disassembly is the one Claude wrote in the real run: the calls the app accepted in that run were sent again, from its transcript, to the bundled server of a fresh app with a temporary data folder. Every call was accepted again.
- **The README** shows two GIFs in order under the links: "1 · Claude writes it, Break the Wall checks it", the new one; then "2 · Explore it, run it, put it back together", the existing demo with the full run, theme switch, argument, reassembly and bill of materials. The paragraph in "Use with Claude" says the run is real, that the terminal is redrawn and summarized from its transcript, and that the app shows the disassembly from that run.
- **Review:** contact sheets every 2–3 seconds; no private content. The temporary data folder was deleted.

#### M9: level B in Claude Desktop, witnessed by the owner

The owner installed the DMG with M6a, added the extension to Claude Desktop again, and asked in Italian: "Spiegami come funziona un MCP server su Claude su Break The Wall". The request does not use the word "smonta". The owner's screenshot shows:

- **Tool choice.** Claude searched the tools, weighed opening against taking apart ("Valutando se smontare o aprire Break The Wall"), and called `start_disassembly` ("Write a Break the Wall disassembly"). The tool-description fix holds in Claude Desktop.
- **Repairs.** `submit_structure` failed once, then was accepted. Of the six `submit_part` calls, three failed once each and were accepted on the next submit. `submit_runs` was accepted at the first attempt.
- **Result.** Claude's reply: "Ho smontato la spiegazione in Break the Wall: è salvata nella tua libreria e già aperta, con 6 parti, 3 esercizi e la ricostruzione finale." The owner confirmed: "alcuni rifiuti ma alla fine ha funzionato".

| M9 point | Status |
|---|---|
| 1. Connection on; extension added to Claude Desktop with one click | **witnessed by the owner** |
| 2. Level A in Claude Desktop | **witnessed by the owner** |
| 3. Level A in Claude Code | **witnessed by the owner**, through the personal `/break` |
| 4. Level B | **passed**: in Claude Code (agent's runs A, B and the GIF run) and in Claude Desktop (owner's run above) |
| 5. Connection off | covered by automated tests (`tests/incoming.test.ts`, `tests/mcp-server.test.ts`); not witnessed |
| 6. The `break` prompt in both clients | not witnessed; its text and its level B steps are covered by `tests/mcp-server.test.ts` |

### Completion, 2026-10-28

The owner decided to close the plan with points 5 and 6 of M9 left as residual risks, covered by tests ("Sì, chiudi e push").

| Task | Verdict |
|---|---|
| M1–M2 (bridge) | **verified**: macOS and Windows CI; app from source |
| M3, M4, M4a (server) | **verified**: macOS and Windows CI; packaged server check on both systems; extension installed in Claude Desktop by the owner |
| M5–M7 (assistant) | **verified**: end-to-end tests; level B saved and opened in the app from Claude Code and from Claude Desktop |
| M6a (repairs) | **verified** by automated tests; the owner's Claude Desktop run recovered every rejection before the limit |
| M8 (docs and GIF) | **verified**: README, SECURITY, development notes, CHANGELOG, adapter, and the README GIF of a real run |
| M9 (witnessed checks) | **verified** for points 1–4; points 5–6 accepted as residual, covered by tests |

Residual risks:
- the `break` prompt was not witnessed in a client;
- turning the connection off was not witnessed by hand;
- level B on Windows is covered by CI only;
- no level B session survives the end of its conversation;
- the Claude Code command on Windows must be copied again after each update;
- ChatGPT is not supported.

The plan is completed. As its preconditions say, P-20261024-disassembly returns to `implementing`. The local spike branch `spike/mcp` can be deleted on the owner's confirmation.
