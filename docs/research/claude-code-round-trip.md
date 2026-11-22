# A page launched from Claude Code: receiving a round, sending answers back

Date: 2026-11-20. Scope: research for issue #72 (map #70). No app source, configuration or dependency is changed. Sources are Claude Code's official documentation (code.claude.com, read on 2026-11-20 against Claude Code 2.1.329 installed on the owner's machine), the MCP specification 2025-11-25, and Plannotator's source at commit `f61d44d` (2026-11-20).

Labels: **Fact** is backed by the cited source; **Inference** is the author's reading of those facts; **Unverified** is a claim no source settles and that needs a witnessed check before the spec relies on it.

## Short answer

Build it as a **Claude Code plugin whose mod (hooks module) bridges the session and a local page**:

- **agent → page**: the mod's `turn.complete` hook receives Claude's final text (`e.answer`), recognises a grilling round by its format (`❓ **Q1** …`), and hands it to a small local server that serves the page.
- **page → agent**: the mod long-polls that server with `$.http.fetch`; when the owner sends the answers, it calls `$.prompt.submit({ text, asUser: true })`, which waits for the session to be idle and starts the next turn with the answers as the owner's own words.
- **side chat**: the local server runs a separate `claude -p --resume <session-id> --fork-session` with read-only tools. It sees the main conversation and reads the repository, and its exchange never enters the main transcript.

This is the pattern Plannotator ships today for Claude Code 2.1.287+ ("the Plannotator mod"): non-blocking review, decision delivered later as a submitted prompt, long-poll over loopback. The fallback for sessions without mods is a `Stop` settings hook run with `asyncRewake`. Every other route breaks at least one of the map's constraints (table below).

## The map of routes

```
                 agent → page                       page → agent
  ┌──────────── (how the round leaves) ───┐   ┌──── (how answers return) ────────────┐
  │ mod turn.complete (e.answer)      ✔   │   │ mod $.prompt.submit (asUser)     ✔   │
  │ Stop hook last_assistant_message  ✔   │   │ Stop hook asyncRewake exit 2     ~   │
  │ MCP tool call (agent must call it) ✘  │   │ Stop hook decision:block         ✘ cap│
  │ AskUserQuestion + PreToolUse      ✘   │   │ PreToolUse updatedInput.answers  ✘ 4q │
  │ Artifact publish                  ~   │   │ channel notifications/claude/... ~ flag│
  └───────────────────────────────────────┘   │ MCP tool result (blocking)       ✘ 2min│
                                              │ Artifact "Send to Claude" comment ~   │
  side chat (reads repo, stays out of main)   └──────────────────────────────────────┘
  │ claude -p --resume <id> --fork-session ✔ │ /btw ✘ no tools │ in-session fork/subagent ✘ result enters main │
```

✔ fits the map's experience; ~ works with a condition named below; ✘ breaks a constraint.

## Comparison

| Route | Direction | Latency | Limit that matters | What breaks it |
|---|---|---|---|---|
| **Mod** (`turn.complete` + `$.http.fetch` + `$.prompt.submit`) | both | round out: at turn end; answers in: next poll return (Plannotator polls with 15 s holds) + wait for idle | Claude Code ≥ 2.1.287, CLI / Desktop Code tab / VS Code; hook own CPU time 10 s; `$.http.fetch` 30 s per call ¹ | `--safe-mode`, `disableAllHooks`, an org's `allowManagedModsOnly`; `claude -p` and SDK runs (mods behave differently there) ¹ ² |
| **Stop hook, `asyncRewake`** | both | answers in: immediate wake on exit 2 | `timeout` is enforced on `asyncRewake` (default 600 s, settable) ³ | answers arrive as a system reminder framed as a background result, not as the owner's message (Inference) |
| **Stop hook, synchronous `decision: "block"`** | both | immediate | 8 consecutive continuations, reset only by a tool call ³ | a grilling session with more than 8 rounds and no tool calls in between; terminal is blocked while waiting |
| **MCP tool that blocks for the answer** | both | immediate when it returns | moved to a background task after 2 min; idle timeout 30 min (stdio) ⁴ | Claude keeps working without the answers once backgrounded; the skill must call the tool, so the skill changes |
| **MCP elicitation (form / URL)** | page → agent (via the server) | immediate | form: flat primitive fields only; URL: client sees only accept/decline ⁵ ⁴ | form is a terminal dialog, not the page; URL mode is accept-then-out-of-band, so the tool call is no longer held by the dialog |
| **`AskUserQuestion` + `PreToolUse` `updatedInput.answers`** | both | immediate | 1–4 questions per call ³ | grilling rounds are prose, not `AskUserQuestion` calls; a 7-question round does not fit |
| **Channels** (`notifications/claude/channel`) | both (reply tool) | push, immediate | research preview; custom channel needs `--dangerously-load-development-channels` at every start; claude.ai or Console auth ⁶ | starting Claude Code without the flag; Team/Enterprise org without `channelsEnabled` |
| **Artifacts** | agent → page; page → agent only by comment or paste | publish per update; comments reach the session at once | static page under strict CSP, no backend, fetch only to its own origin ⁷ | side chat cannot read the local repository; no local round trip |
| **`/btw`** | none (terminal overlay) | — | no tools, single response, kept in memory only ⁸ | cannot be driven by a page; not anchored to a block |
| **In-session fork / subagent** | — | — | a fork's or subagent's final result arrives in the main conversation ⁹ | violates "a side-chat exchange returns only if the owner attaches it" |
| **Agent SDK as host** | both | immediate (`canUseTool`) | third parties may not offer claude.ai login ¹⁰ | it is a new host, not the owner's running Claude Code session |

## Findings

### 1. Mods: the route that keeps both sides non-blocking

- **Fact.** A mod is a plugin with a JavaScript/TypeScript hooks module that runs inside Claude Code. It can draw panes and fields, hold or answer tool calls, follow turns, add commands and tools, call a model, and "submit a prompt as if you had typed it". Mods are on by default from Claude Code 2.1.287 in the terminal, and also run in the Desktop app's Code tab and the VS Code extension. ¹
- **Fact.** `turn.complete` fires when a turn ends; `e.answer` is Claude's final text and `e.agentId` is set for a subagent's turn. ²
- **Fact.** `$.prompt.submit({ text })` "waits until the session is idle and then starts a new turn"; with `asUser: true` the text is sent "as the user's own words", without the sentence naming the mod as sender. `$.prompt` also has `fill`, `suggest`, `read`, `compose`. ¹¹ ¹²
- **Fact.** The hooks module has no Node APIs and no network or file access of its own. It reaches the outside through `$.fs`, `$.process.run` / `$.process.spawn`, `$.http.fetch` (http/https client, 30 s per call, 4 MiB body), `$.store` (4 MiB JSON), and `$.session` (`messages()`, working directory, id). A hook's own execution time is capped at 10 s, but time awaiting a mods API call does not count. ¹¹ ¹²
- **Fact.** `$.model.fork({ prompt })` sends the current conversation plus a prompt, with Claude's tools listed but not callable; `$.model.complete` sends a lone prompt. Both bill to the session's credentials. ¹¹
- **Fact (Plannotator, `apps/hook/hooks/mod/register.ts`, `bridge.ts`).** Under the mod, `ExitPlanMode` is answered `deny` at once with "waiting for review" text, the `plannotator` CLI is started detached, and the decision "arrives later as a plugin turn (`$.prompt.submit`, origin `plannotator`)". Its "Ask this session" bridge long-polls `POST /api/ai/bridge/poll` on the loopback port with a per-launch bearer token, "15 s … below the server's 25 s cap and any fetch timeout", and pushes busy/ready from `turn.start` / `turn.complete`. ¹³
- **Inference.** The mod can only be an HTTP *client*. The page therefore needs a separate local server process, started by the mod with `$.process.spawn`. That process needs a runtime: `node` on `PATH` (true for the owner, Node 22) or a shipped binary. Plannotator ships a binary through `curl … | bash`, which is exactly what the map's "no installer to download" excludes. A plugin that bundles a Node script avoids the installer but depends on Node being present (**Unverified** for other machines: the native Claude Code install does not imply Node).
- **Inference.** The mod can also *be* the surface: panes beside the transcript with buttons and text fields ¹. That is the TUI option of the map's "browser, app or TUI" question, and it needs no local server at all. The integration (`turn.complete` in, `$.prompt.submit` out) is the same whichever surface wins the prototype.
- **Inference.** "The skills' questions stay as they are" holds, but the parser becomes a contract: the mod recognises a round by the grilling skill's own format (`❓ **Q<n>** - **<title>**: … ➡️ <recommendation>`, `.agents/skills/grilling/SKILL.md`). A skill that changes its format silently stops opening the page. This is the "what changes in the skills" question of the map, now concrete.

### 2. Settings hooks: a fallback without mods, with two traps

- **Fact.** Every hook gets `session_id`, `transcript_path` and `cwd`. `Stop` additionally gets `last_assistant_message`, the final text of the turn; the docs advise it over reading the transcript, which "may lag". ³
- **Fact.** Hook `timeout` defaults to 600 s for `command`, `http` and `mcp_tool` hooks (30 s on `UserPromptSubmit`). Plannotator's classic `PermissionRequest` hook on `ExitPlanMode` sets `"timeout": 345600` (4 days) and blocks until the browser decision (`apps/hook/hooks/hooks.json`). ³ ¹³
- **Fact.** `asyncRewake: true` runs the hook in the background and "wakes Claude on exit code 2"; stderr (or stdout) "is shown to Claude as a system reminder". It wakes Claude "immediately even when the session is idle". `timeout` is still enforced on `asyncRewake`, unlike plain `async`. ³
- **Fact.** A synchronous `Stop` hook can keep Claude going with `decision: "block"` and a `reason`, or with `additionalContext`. Both are subject to the 8-consecutive-continuation cap, which "resets each time Claude calls a tool" (raise with `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`). ³
- **Inference.** A synchronous Stop hook that waits for the page and returns the answers as `reason` hits the cap at the ninth round of a grilling session that reads no files between rounds, and freezes the terminal while it waits. `asyncRewake` avoids both, at the price of the answers arriving as a "system reminder" about a background hook rather than as the owner's message. **Unverified:** whether Claude treats such a reminder as the owner's answers to the round with the same weight as a typed reply.

### 3. `AskUserQuestion` can be answered from outside, but rounds are not `AskUserQuestion` calls

- **Fact.** `AskUserQuestion` asks "one to four multiple-choice questions"; its input has `questions` and an optional `answers` map (question text → chosen label; multi-select joined by commas). A `PreToolUse` hook can "collect the answer through your own UI" and return `permissionDecision: "allow"` with `updatedInput` echoing `questions` plus `answers`. `"allow"` alone is not enough for this tool. ³
- **Fact.** Questions stay open until answered unless `askUserQuestionTimeout` is set (60 s, 5 m or 10 m). ¹⁴
- **Inference.** This is a clean, documented, synchronous round trip, but only for rounds the agent chooses to put through `AskUserQuestion`. The grilling skill emits prose rounds of any size; using this route means changing the skill (out of scope) and splitting rounds above four questions.

### 4. MCP tools: a blocking tool call is not held for a human

- **Fact.** Tool calls have a wall-clock limit (`MCP_TOOL_TIMEOUT`, about 28 hours when unset, or a per-server `timeout`) and an idle timeout that aborts a call with no response or progress for 30 minutes on stdio (5 minutes on HTTP), set by `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`. ⁴
- **Fact.** "An MCP tool call in the main conversation that is still running after two minutes moves to a background task instead of blocking the session. Claude receives the task ID immediately and keeps working, and the result arrives as a task notification." It is turned off with `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS=0`. A call waiting on an open elicitation dialog is not backgrounded while the dialog is open. ⁴
- **Fact.** Claude Code supports elicitation in form mode (a terminal dialog with fields) and URL mode (asks whether to open a link) and declares `elicitation: {form: {}, url: {}}` on user-configured stdio/http servers from 2.1.287. ⁴ In URL mode the client's `accept` "does not mean that the interaction is complete"; data other than the URL is not exposed to the client, and the server may send `notifications/elicitation/complete`. Form schemas are "flat objects with primitive properties only". ⁵
- **Fact.** The MCP spec lets implementations reset a request timeout on progress notifications but says they "SHOULD always enforce a maximum timeout". ¹⁵
- **Inference.** A `present_round` tool that blocks until the owner answers works only with a settings change (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS=0`) and progress pings every < 30 min; otherwise Claude goes on without the answers after two minutes. It also requires the skill to call the tool. URL-mode elicitation does not fix this: after the owner accepts opening the link, the dialog is closed and the call is a plain long call again (**Unverified**: the docs say the move is deferred "until the dialog closes", not whether a URL-mode dialog stays open during the browser interaction).

### 5. Channels: a real push into the session, behind a startup flag

- **Fact.** A channel is an MCP server declaring `capabilities.experimental['claude/channel']`; it pushes `notifications/claude/channel` with `content` and `meta`, which reach Claude as `<channel source="…">` events in the running session; a reply tool makes it two-way. The fakechat demo is exactly a localhost chat page. ⁶
- **Fact.** Research preview. `--channels` accepts only allowlisted plugins; a custom channel needs `--dangerously-load-development-channels plugin:<name>@<marketplace>` at startup. Needs claude.ai or Console auth; Team/Enterprise need `channelsEnabled`. Being in `.mcp.json` is not enough to push. ⁶
- **Inference.** Technically the cleanest page → agent push, but it fails "starts from Claude Code with a command or plugin": the owner would have to restart every session with a dangerous-sounding flag, and the contract "may change". Worth revisiting if custom channels leave preview.

### 6. Artifacts: good for showing, not for this round trip

- **Fact.** An artifact is a static page on claude.ai under a strict CSP: no backend, `fetch` only to its own origin. A comment sent with **Send to Claude** "reaches your session right away" (v2.1.228+). The documented way to bring a decision back is a "Copy as prompt" button to paste into the terminal. Requires a claude.ai login on a paid plan; off in `-p` and SDK runs. ⁷
- **Inference.** Agent → page works (Claude republishes the round), page → agent works only through comments or paste, and a side chat inside the page cannot read the local repository. Not an end-to-end route; a possible later share/export surface.

### 7. `/btw`, forks and subagents: why the side chat must live outside the session

- **Fact.** `/btw` "sees your full conversation" but has no tools, gives a single response, and keeps the thread in memory until Claude Code exits (the VS Code panel's thread survives reloads). Pressing `f` forks it into a background subagent. ⁸
- **Fact.** A fork "inherits the entire conversation"; its tool calls stay out of the parent, but "only its final result comes back" and "arrives as a message in your main conversation". A non-fork subagent starts fresh and also returns its result to the parent. ⁹
- **Fact.** `--resume <id>` continues a session by id from any directory; `--fork-session` "create[s] a new session ID instead of reusing the original"; `--no-session-persistence` keeps a `-p` session off disk. ¹⁶ ¹⁷
- **Inference.** The side chat that reads the repository without filling the main conversation is a separate CLI process: `claude -p "<block + question>" --resume <main-session-id> --fork-session --allowedTools "Read,Grep,Glob" --output-format stream-json`, then `--resume <fork-id>` for follow-ups. It inherits the conversation (so it knows why the question was asked), reads files, and writes only to its own session. The owner's own CLI login is used, so no API key is needed for personal use. **Unverified:** that `--resume <id> --fork-session` reads a session that is still open in another terminal without disturbing it, and the first-token latency of such a fork.
- **Inference.** `$.model.fork` from the mod is the cheap variant for questions answerable from the conversation alone (the `/btw` case, but anchored to a block); it cannot read files.

### 8. Agent SDK

- **Fact.** The Agent SDK gives `canUseTool` and `onElicitation` callbacks and can answer `AskUserQuestion` in-process ³ ⁴. "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK." ¹⁰
- **Inference.** The SDK makes the page the host of a new agent session. The map starts from the owner's running Claude Code session, so the SDK is the wrong layer for v1; `claude -p` covers the side chat with the owner's own login.

## How the recommended route covers the five states

```
 Claude Code session (owner's terminal)          local server (spawned by mod)         browser page
 ───────────────────────────────────────         ─────────────────────────────         ────────────
 1 turn ends with a grilling round
   mod turn.complete: e.answer ─── POST round ──▶ store round, open page ─────────────▶ round shown
 2                                                                                     blocks: context ·
                                                                                       options · rec · diagram
 3                                                ◀── side-chat question (block id) ── side chat beside block
                                                  claude -p --resume <sid> --fork-session
                                                  (Read/Grep/Glob) ── stream ─────────▶ answer streams in
 4                                                ◀── answer per block (saved at once)  yes / pick b / note
   mod long-poll ($.http.fetch) ◀── "round sent" ──
   $.prompt.submit({ text: answers, asUser: true })   (waits for idle)
 5 next turn → next round → step 1 again ───────▶ append round ──────────────────────▶ page updates,
                                                                                       past rounds kept
 arrows: data flow in the direction shown
```

Breaking points to design for:

- **Round detection** depends on the skill's text format (finding 1).
- **Owner types in the terminal meanwhile**: `$.prompt.submit` waits for idle, so answers queue behind whatever the owner started. The page should show "waiting for the session" (Plannotator reports busy/ready from `turn.start` / `turn.complete`).
- **Session ends**: the mod and its polls end with the session; the server and stored answers can outlive it. Whether rounds survive across sessions is the map's open "history" question.
- **Loopback security**: Plannotator uses a per-launch bearer token and no Origin header on its polls (`bridge.ts`). A local server that accepts prompts for a session is a prompt-injection door for any local web page unless it checks a token.

## What in `src/mcp` is reusable

- **`src/mcp/protocol.ts`** is a request/response-only MCP server: `handle` returns one response per request and ignores responses "to requests this server never sends". It cannot send `elicitation/create`, progress or channel notifications without a server-to-client writer. Reusable only if an MCP route is chosen; the recommended route does not need MCP.
- **`src/desktop/incoming.ts`** (one JSON object per line over a 0600 socket or named pipe, Zod-checked, address derived from the data folder) is a sound pattern for the mod ↔ local server link if the surface becomes the Electron app. A mod cannot open a socket itself, though: it would reach the app through `$.process.run` of a small client or through HTTP.
- **Runtime trick** (`docs/development.md`): Claude Code already runs this repo's MCP server under the app's own Electron with `ELECTRON_RUN_AS_NODE=1`. If the surface is part of Break the Wall, the local server can run the same way, so no separate Node is needed. The repository ships no Claude Code plugin yet (`claude mcp add` command only); the mod would be its first.

## Open checks before the spec relies on this

1. Witness a mod on 2.1.329: `turn.complete` → POST to a local server → `$.prompt.submit({ asUser: true })` → next turn, with the owner typing in between.
2. Witness `claude -p --resume <open-session-id> --fork-session` from a second process while the main session is live; measure first-token latency.
3. If the fallback matters: witness a `Stop` hook with `asyncRewake` waking Claude with answers, and how Claude treats them.
4. Decide the runtime for the local server (Node script in the plugin vs. a TUI pane with no server).

## Sources

1. Mods overview, https://code.claude.com/docs/en/plugins/mods/overview
2. React to events with a mod (`turn.complete`, holding a tool call), https://code.claude.com/docs/en/plugins/mods/events
3. Hooks reference (common input, timeouts, `asyncRewake`, Stop decision control and cap, `AskUserQuestion` / `ExitPlanMode` input, PreToolUse `updatedInput`), https://code.claude.com/docs/en/hooks
4. Connect Claude Code to tools via MCP (time limits, automatic backgrounding, elicitation modes), https://code.claude.com/docs/en/mcp
5. MCP specification 2025-11-25, Elicitation, https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation
6. Channels and Channels reference, https://code.claude.com/docs/en/channels, https://code.claude.com/docs/en/channels-reference
7. Share session output as artifacts, https://code.claude.com/docs/en/artifacts
8. Interactive mode, "Side questions with /btw", https://code.claude.com/docs/en/interactive-mode
9. Subagents, "Fork the current conversation", https://code.claude.com/docs/en/sub-agents
10. Agent SDK overview, https://code.claude.com/docs/en/agent-sdk/overview
11. Use the mods API, https://code.claude.com/docs/en/plugins/mods/api
12. Mods reference (`$.prompt`, limits), https://code.claude.com/docs/en/plugins/mods/reference
13. Plannotator at `f61d44d`: `apps/hook/hooks/hooks.json`, `apps/hook/hooks/mod/register.ts`, `apps/hook/hooks/mod/bridge.ts`, `apps/hook/README.md`, `apps/hook/server/index.ts`, https://github.com/backnotprop/plannotator
14. Tools reference, "AskUserQuestion tool behavior", https://code.claude.com/docs/en/tools-reference
15. MCP specification 2025-11-25, Lifecycle, "Timeouts", https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
16. Run Claude Code programmatically (headless), "Continue conversations", https://code.claude.com/docs/en/headless
17. CLI reference (`--fork-session`, `--no-session-persistence`, `--session-id`), https://code.claude.com/docs/en/cli-reference
