# The Claude Code mods API: how stable it has been, and what survives without it

Date: 2026-11-27. Scope: research for issue #165 (map #160). No app source, configuration or dependency is changed. Claude Code 2.1.332 is installed on the owner's machine.

Sources (numbered at the end):

- Claude Code's `CHANGELOG.md` in `anthropics/claude-code`, at commit `eb8e6d2` (2026-11-25, last entry 2.1.332).
- The docs at code.claude.com, read on 2026-11-27.
- The mods typings: the copy Claude Code 2.1.332 laid in `plugin/.claude-plugin/types/claude-code/index.d.ts`, and the public copy `mods/types/claude-code.d.ts` in `anthropics/claude-code`, read at 6 of its 183 commits (2026-09-11 to 2026-11-27).
- The published `@anthropic-ai/claude-code-darwin-arm64` packages from npm, read for string literals and never run: 2.1.269, 286, 287, 288, 290, 295, 299, 304, 311, 318, 319, 321, 322, 323, 325, 326, 327 and 328, plus the local 2.1.329 to 2.1.332 binaries.

Labels: **Fact** is backed by the cited source. **Inference** is the author's reading of those facts. **Unverified** is a claim no source settles: it needs a witnessed check before a decision relies on it. "Present from X" means a string literal first appears in the binary of version X. That shows the name exists. It does not show the call works there.

## Short answer

- **The record so far: the API grew, and none of the mod's calls broke.** Every call and event the mod uses has the same signature in the earliest typings (2.1.269, the opt-in early-access period) and in 2.1.332. Every change was an addition: an optional field or argument, or a new method. In the 40 releases since mods turned on by default (2.1.287), the changelog changes or fixes these calls only through bug fixes.
- **What did break the mod came from around those calls:** a call newer than the person's build (`hookEnv`, #145), the built-in guard skipping some kinds of mod hook (#96), and checks tightened in the validator and the test kit.
- **No stability promise.** The typings still open with "EARLY ACCESS: this surface may change between releases without notice", at 2.1.269, at 2.1.332 and in the public copy of 2026-11-27. The docs use "early access" only in the past tense, for the opt-in flag before 2.1.287. No source gives a versioned API, a deprecation window or a date for a stable release. On top of that, Anthropic can switch installed mods off remotely.
- **What survives without the mod:** launching the server, registering the session, following `/clear` and `/resume`, and posting each turn's text all map onto classic command hooks (`SessionStart`, `SessionEnd`, `Stop`, `SubagentStop`). `/break-the-wall` without a model turn probably maps onto a `UserPromptExpansion` hook that blocks the command, but that is not witnessed.
- **What does not survive: delivering the answers as the person's own words.** Every route without the mod brings them in labelled as something else: a background hook's system reminder, a message "from another session, not from you", or a research-preview channel. The only exception is the person pasting the answers. An MCP server alone carries none of the plugin's functions without a skill calling its tools.

## The map

```
 plugin function               the mod today                         without the mod (classic hooks / MCP)
 ───────────────               ─────────────                         ─────────────────────────────────────
 check Node, launch server  ── session.start → $.process.run ──────▶ SessionStart command hook          ✔
 register the session       ── $.session.id/cwd/model/info ────────▶ SessionStart input fields          ✔
 keep it registered         ── $.clock.every 30 s renewal ─────────▶ no timer: liveness some other way  ~
 follow /clear, /resume     ── session.end → re-register ──────────▶ SessionEnd + SessionStart(clear|resume) ✔
 post each turn's text      ── turn.complete e.answer ─────────────▶ Stop / SubagentStop last_assistant_message ✔
 /break-the-wall, no turn   ── command.register + command.run ─────▶ UserPromptExpansion block + reason  ~ unwitnessed
 answers as the person      ── $.http.fetch poll → $.prompt.submit ▶ no equivalent: arrives as not-the-person ✘
   (asUser: true)

 ✔ carried   ~ carried with a change or a check   ✘ not carried      arrow: "is replaced by"
```

## Findings

### 1. The calls the mod uses, release by release

All rows are **Fact** from the typings snapshots and the binaries (sources 3, 4), with changelog entries from source 1. Typings snapshots: T269 is the public copy at `6cdd796` ("Written by Claude Code 2.1.269", 2026-09-11). T277 is `cbab6f4` (2.1.277, 2026-09-24). T332 is the copy laid by the local 2.1.332.

| Call or event | Present from (binaries) | Signature T269 → T277 → T332 | Changelog entries on it since 2.1.287 |
|---|---|---|---|
| `$.prompt.submit({ text, asUser })` | `prompt.submit` in every build read (2.1.269 on). `asUser` as a whole word in 2.1.287, 299, 311, 318, 323 and 329 | `submit: (input: PromptSubmitArgs) => Promise<PromptSubmitResult>`, unchanged. `asUser?: true` is declared in T332, not in T269 or T277 | None on the call. The `prompt.submit` entries (2.1.295, 2.1.296, 2.1.299, 2.1.300, 2.1.318) are about the *hook event* of the same name |
| `$.process.run` | every build read | `(argv, init?) => Promise<ProcessRunResult>`, unchanged. The result gained `isStdoutTruncated` and `isStderrTruncated` | None. 2.1.290 changed `$.process.spawn`'s rejection after a deny, not `run` |
| `$.http.fetch` | every build read | `(url, init?) => Promise<HttpResponse>`, unchanged. `init.body` widened from `string` to `HttpBody = string \| {…}`. `socketPath` and `compress` were added, and the response gained `isStreaming` and `sendIndex` | Fixes only: `HEAD` with a large `Content-Length` (2.1.296), and `204`/`205`/`304` (2.1.299) |
| `$.clock.after`, `$.clock.every` | from 2.1.286 (no such literal in 2.1.269) | `TimerCall = (ms, fn) => Timer`, unchanged | None |
| `$.session.id`, `cwd`, `model` | every build read | `() => Promise<string>`, unchanged | None |
| `$.session.version` | from 2.1.286 (absent in 2.1.269) | absent in T269, `() => Promise<SessionVersion>` from T277 | None |
| `$.session.info` (`transcriptPath`) | from 2.1.326 (absent in 2.1.325) | absent in T269 and T277, present in T332 | None |
| `$.process.hookEnv` | from 2.1.326 (absent in 2.1.325), as #145 found | absent in T269 and T277, present in T332 | None (the changelog never names it) |
| `$.plugin.root`, `$.plugin.name` | the validator's rule on these spellings is present from 2.1.323 | declared as properties in T269 already | None |
| `$.command.register`, `command.run` | every build read. `isTextDisplayOnly` from 2.1.319 (absent in 2.1.318) | `register(CommandSpec)` unchanged. `CommandRunInput` gained `presentation` (T277). `CommandRunResult` gained `isTextDisplayOnly` and `exitCode` (T332) | None |
| `$.ui.log` | every build read | `(text) => void` → `(text, options?: UiLogOptions) => void` (T277) | None |
| `turn.complete` | every build read | `answer`, `durationMs`, `isAborted`, `turnId`, `agentId?`, `usage?` and `reason` are identical in T269, T277 and T332. The result gained `by?` | One fix (2.1.290): an empty `answer` for a subagent that reports back in auto mode |
| `session.start` | every build read | `{ cwd, surface, isInteractive }`, unchanged | None |
| `session.end` | from 2.1.286 (absent in 2.1.269) | absent in T269, `{ reason, sessionId, resume }` from T277 | None. The reference caps all `session.end` hooks together at the `SessionEnd` budget, 1.5 s by default (source 7) |

- **Inference.** From 2.1.287 to 2.1.332, no call or event the mod uses was renamed, removed or narrowed. The mod's exposure is to calls *arriving*: a build that lacks a call throws a `TypeError` where it is called (plugin/AGENTS.md, #145). The oldest build that has every call the mod makes is 2.1.326, because of `hookEnv` and `session.info`. The mod already tolerates a missing `session.info`, and it reads `$.plugin.root` before `hookEnv`. `MIN_CLAUDE_CODE` stays at 2.1.330, the oldest build the mod was witnessed on.
- **Unverified.** Whether `$.plugin.root` *works* on builds before 2.1.323. It is declared from T269, but no build that old was run.

### 2. How much the surface moves, and what broke this mod

- **Fact (source 1).** From 2.1.287 to 2.1.332 the changelog has 40 release headings, and about 178 entries name a mod, a hooks module, a `$` call or the plugin validator or test kit, in 28 of those releases. Among them are 35 "Added", 26 "Changed", 98 "Fixed", 13 "Improved", 1 "Removed" and 1 "Deprecated". The counts come from a keyword grep and are approximate.
- **Fact (source 1).** The 26 "Changed" entries change existing behaviour in place, with no version switch. Examples:
  - `turn.start` now also hears subagents' turns (2.1.299).
  - A hook's `.catch` runs only when the hook itself throws (2.1.301).
  - What a `prompt.submit` hook attaches now stays in the user's turn (2.1.318).
  - `engine.create` hooks written as `*` or by namespace now only observe, and the validator fails the other forms (2.1.323).
  - `claude plugin test` fails a served `$` method that takes over 10 s, and `ui.render` trees carry `part` (2.1.299). A failed `expect` inside a hook now fails the test (2.1.292).

  None of them touches a call in section 1.
- **Fact (this repository).** What has actually broken or bent the mod:
  1. `$.process.hookEnv` is missing before 2.1.326, so `/break-the-wall` failed on 2.1.318 (#145). The fix was `$.plugin.root` first, an `engines` range, and an "update Claude Code" message.
  2. On 2.1.330 the built-in `cc-plugin-sec-default` skips a mod's `classic.*` and `skill.prompt` hooks. The injection therefore moved to classic command hooks (#96, plugin/AGENTS.md). Claude Code says so in the transcript from 2.1.304 (source 1).
  3. The validator's rules: `$` passed only to top-level functions, and `$.plugin` spelled only `.name` or `.root`. The rule naming `$.plugin.root and $.plugin.name` is present in the binary from 2.1.323 (source 4).
  4. The engine lays the types only when an interactive session loads the plugin, so CI never type-checks the mod (plugin/AGENTS.md).
- **Inference.** The risk is not the signatures moving. It is the behaviour around them changing in place: who runs first, what is skipped, what the validator accepts. Each such change lands in an ordinary release, and nothing tells the mod which behaviour it gets other than the version.

### 3. Early access: what is said, and what is not

- **Fact (sources 3, 2).** Every typings snapshot read opens with "EARLY ACCESS: this surface may change between releases without notice.": T269, T277, the snapshots of 2026-10-11, 2026-11-06 and 2026-11-11, T332, and the public copy at `d167a94` (2026-11-27).
- **Fact (sources 2, 8).** The docs use early access in the past tense: "If you set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` during early access, remove it. Claude Code v2.1.287 and later ignores it". "Mods are on by default. In the terminal, use Claude Code v2.1.287 or later." The changelog's 2.1.287 entry is "Added Claude Mods: plugins may now modify deeper behavior". The word "early access" appears nowhere in the changelog.
- **Fact (sources 2, 6, 7, 8, 9).** No mods page read (overview, create, events, api, interface, test, troubleshoot, admin, reference) states a stability promise, a versioning or deprecation policy, or a date to leave early access. The one deprecation found is `bold` on a `Text`, which "still works" (source 7).
- **Fact (source 7).** "The copy on GitHub can be older than the Claude Code version you have installed. When the two disagree, trust the copy Claude Code writes for your version." The public copy said "Written by Claude Code 2.1.277" from 2026-09-24 to at least 2026-11-11, while releases reached 2.1.323 (source 3).
- **Fact (source 9).** Claude Code has a remote rollout switch for installed mods: "`hooks modules are turned off for installed plugins in this process: the rollout switch served off`: Anthropic has turned installed mods off remotely." The 2.1.299 changelog fixes installed mods that "kept running in an open session after being turned off remotely; they now unload between turns".
- **Fact (source 10).** The only compatibility tool a plugin has is `engines["claude-code"]` in `plugin.json`, honoured from 2.1.323.
- **Inference.** The two sources disagree. The docs treat mods as shipped and on by default. The typings, which the reference names as the complete contract, still disclaim compatibility. Plan as if the API is unversioned: compatibility holds per build, kept by `engines` and by the mod's own checks. No signal was found that this will change on a known date.

### 4. Who can turn what off

| Switch | Stops the mod | Stops the plugin's `hooks.json` command hooks |
|---|---|---|
| Anthropic's remote rollout switch | yes (source 9) | **Inference:** no. It is described for "hooks modules" only |
| `allowManagedModsOnly` (organization) | yes | no: "their hooks in settings files and in plugins' `hooks/hooks.json` … aren't affected" (source 11) |
| The built-in guard's skipping | the mod's `classic.*` and `skill.prompt` hooks (#96) | no, witnessed in #96 |
| `disableAllHooks`, `allowManagedHooksOnly` | yes | yes (sources 2, 12) |
| `--safe-mode` | yes | yes: "plugins, hooks, MCP servers … do not load" (source 16) |

- **Inference.** A route built on classic command hooks survives the three mod-only switches. Those are the switches most likely to change without notice, since they are remote or set by an organization's policy. Under the other switches it fares the same as every hook.

### 5. What classic command hooks and an MCP server can carry

| Function | The mod's mechanism | Classic replacement | Basis | Gap |
|---|---|---|---|---|
| Check Node, find or start the server | `session.start` → `$.process.run(['node', …/launcher.cjs, 'start'])` | `SessionStart` command hook running the same launcher. `hooks.json` already runs `node` hooks | **Fact:** `SessionStart` runs on startup, resume, clear, compact and fork, and an interactive launch runs it in the background (source 5) | Without Node the hook fails as a "non-blocking error" with the shell's message (source 5), not the mod's bilingual "needs Node". A small `sh` wrapper could print it (**Inference**) |
| Register the session (id, cwd, model, transcript) | `$.session.*` posted to `/api/sessions` | the hook's stdin: `session_id`, `cwd`, `transcript_path`, and `model` (optional, "can be omitted … after `/clear`") | **Fact** (source 5) | `model` may be missing after `/clear`. The side-chat model setting arrives as `CLAUDE_PLUGIN_OPTION_<KEY>` (**Fact**, source 5) |
| Keep the registration alive (renewed every 30 s, two-minute lease) | `$.clock.every` | none: command hooks run on events, not on a timer | **Fact:** no timer event exists in the hooks reference (source 5) | The server would judge liveness another way, for example from the Claude Code process id the hook passes in, or from the transcript file. That needs a server change (**Inference**) |
| Follow `/clear`, `/resume` (#102) | `session.end` + re-register after 1 s | `SessionEnd` (reason `clear`, `resume`, …), then `SessionStart` with source `clear` or `resume` under the new id | **Fact** (source 5). `SessionEnd` has the same 1.5 s budget as the mod's `session.end` | none found |
| Post each turn's final text | `turn.complete`: `e.answer`, `e.reason`, `e.agentId` | `Stop`: `last_assistant_message`. `SubagentStop`: `last_assistant_message`, `agent_id`. Run with `async: true` so the turn does not wait | **Fact** (source 5) | `Stop` "does not run if the stoppage occurred due to a user interrupt", so interrupted turns never arrive. The server ignores them today anyway (**Inference**) |
| The round phase marker, the injection (#96, #99) | already classic: `UserPromptExpansion`, `PreToolUse` on `Skill`, `SessionStart` on `compact` | unchanged | **Fact** (plugin/AGENTS.md) | none |
| `/break-the-wall` with no model turn, printing the secret URL only to the person (#147) | `command.register` + `command.run` → `{ text, isTextDisplayOnly: true }` | a plugin command `commands/break-the-wall.md`, plus a `UserPromptExpansion` hook matching it that runs `launcher.cjs open` and returns `decision: "block"` with the URL as `reason` | **Fact:** `UserPromptExpansion` "can block the expansion", and `reason` is "Shown to the user" (source 5). For `UserPromptSubmit`, `reason` is "Not added to context" | **Unverified:** how the block message looks (styled as a refusal?), and whether the `UserPromptExpansion` reason stays out of context and transcript the way the `UserPromptSubmit` one does. A `` !`command` `` prompt command instead would start a model turn and put the secret in context, which #147 forbids |
| The outdated-build message (#145) | `$.session.version()` | not needed: the classic route uses no API that grows by release. `engines` still guards (source 10) | **Inference** | none |
| Deliver the answers as the person's own words | `$.http.fetch` long-poll → `$.prompt.submit({ text, asUser: true })`, which waits for idle and starts the next turn as typed by the person, witnessed on 2.1.330 (#83) | **none equivalent**: see section 6 | | the decide core's return path |

- **Fact (sources 2, 13).** An MCP server only gives Claude tools (and prompts, resources and, from 2.1.332, skills). It sees no turn and no session event. A tool runs only when Claude calls it, and a long call moves to a background task after two minutes (claude-code-round-trip.md, finding 4).
- **Inference.** On its own, an MCP server carries none of the functions above, unless the round skills are changed to call its tools, and the map keeps them as they are. Its only reach into the session without a tool call is a channel (section 6).

### 6. The one function that does not carry: answers as the person's words

| Route without the mod | How the answers arrive | Wakes an idle session | Limits | Basis |
|---|---|---|---|---|
| `Stop` hook with `asyncRewake`, long-polling the server, exit 2 with the answers | "shown to Claude as a system reminder so it can react to a long-running background failure" | yes: "wakes Claude immediately even when the session is idle" | `timeout` is enforced (600 s by default, can be set higher). One poller per `Stop` event | **Fact** (source 5) |
| The session's inbox socket (`CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN`, exported to hooks) | a message "from another session, not from you". It "never counts as your consent", and commands in it do not run | yes: "When the receiving session is idle, Claude Code starts a new turn with the message" | Held for approval in a session that bypasses permissions, unless verified as the session's own child (on macOS, by process evidence while the poster runs, or by the token). The line must be complete within 30 s. 2.1.224+ | **Fact** (source 14) |
| `UserPromptSubmit` `additionalContext` | a system reminder beside a prompt the person types | no: the person must send something | 30 s default timeout | **Fact** (source 5) |
| Channel (`notifications/claude/channel`) from the plugin's MCP server | a `<channel source="…">` event | yes (push) | Research preview: "the `--channels` flag syntax and protocol contract may change". A custom channel needs `--dangerously-load-development-channels` at every start | **Fact** (source 15) |
| The page copies the message, and the person pastes it | the person's own message | — | one manual step per round | **Inference** |

- **Inference.** Every automatic route labels the answers as coming from something other than the person. The inbox socket labels them explicitly "not from you". The grilling loop's point is that the answers *are* the person's decisions. A route that tells Claude otherwise may make Claude weigh them differently, or ask for confirmation. **Unverified:** how Claude actually treats a round's answers that arrive by `asyncRewake` or by the inbox socket. claude-code-round-trip.md left the same question open for `asyncRewake` (open check 3).
- **Inference.** Of the routes, the inbox socket comes closest: it is documented, wakes an idle session, starts a real turn, needs no flag, and Claude Code itself ships it. Its contract is described for messages between Claude sessions. A local server posting the person's answers is a use the docs allow ("when you want a script or hook to post into a session") but do not design for. **Unverified:** the wire format of a message line, which the page does not give beyond the auth line. Also whether a server detached from the hook's process tree is verified as an "own child".

## Open checks before #169 relies on this

1. Witness `/break-the-wall` as a `UserPromptExpansion` hook that blocks with the URL as `reason`: what the person sees, and whether the URL reaches the model's context or the transcript.
2. Witness the inbox socket: the local server posts a round's answers to an idle session with the token. Does a turn start, how does Claude treat answers labelled "from another session", and what happens under `bypassPermissions`?
3. Witness a `Stop` `asyncRewake` delivery of a round's answers (claude-code-round-trip.md, open check 3).
4. Decide how the server tells a live session from a dead one without the 30 s renewal.
5. To watch the risk itself, look at each Claude Code release's "Changed" mod entries, and the first line of the typings it lays (whether "EARLY ACCESS" is still there). `npm run check:plugin` against the new build is the cheap tripwire.

## Method

- Changelog: each line tagged with its `## <version>` heading. Entries kept when they name a mod, a hooks module, a `$` call, or the plugin validator or test kit.
- Binaries: each package was downloaded from the npm registry and unpacked in its own folder. A Python script read it with `mmap` for quoted literals (`"process.hookEnv"`), bare words (`isTextDisplayOnly`) or a whole-word regex (`asUser`, since the bare word matched `hasUsername`). The package was then deleted. Nothing was executed.
- Typings: declarations extracted with comments stripped and diffed between snapshots.

## Sources

1. Claude Code changelog, `CHANGELOG.md` at `eb8e6d2` (2026-11-25), https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
2. Mods overview ("Turn mods on or off", "Where mods run", "Compare mods, settings hooks, skills, and MCP servers"), https://code.claude.com/docs/en/plugins/mods/overview
3. Public mods typings, `mods/types/claude-code.d.ts`, commit history from 2026-09-11, snapshots `6cdd796`, `cbab6f4`, `3deb873`, `90380ef`, `0956c00`, `d167a94`, https://github.com/anthropics/claude-code/commits/main/mods/types/claude-code.d.ts. The local copy laid by 2.1.332 is `plugin/.claude-plugin/types/claude-code/index.d.ts`, not committed.
4. `@anthropic-ai/claude-code-darwin-arm64` on npm, versions listed above, https://www.npmjs.com/package/@anthropic-ai/claude-code-darwin-arm64. Release dates come from `npm view @anthropic-ai/claude-code time`.
5. Hooks reference: common input, `SessionStart`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `SubagentStop`, `SessionEnd`, other exit codes, "Run hooks in the background", plugin environment variables. https://code.claude.com/docs/en/hooks
6. Use the mods API, https://code.claude.com/docs/en/plugins/mods/api
7. Mods reference (Files, `$.prompt`, limits, `session.start` and `session.end`, the note on the GitHub typings), https://code.claude.com/docs/en/plugins/mods/reference
8. Manage mods for your organization (`allowManagedModsOnly`, the early-access flag), https://code.claude.com/docs/en/plugins/mods/admin
9. Troubleshoot a mod ("Check whether mods can load", refusal messages), https://code.claude.com/docs/en/plugins/mods/troubleshoot
10. Plugin manifest reference (`engines`), https://code.claude.com/docs/en/plugins/manifest-reference
11. Manage mods for your organization, "Stop user-installed mods from loading", https://code.claude.com/docs/en/plugins/mods/admin#stop-user-installed-mods-from-loading
12. Settings reference (`disableAllHooks`, "What runs under `allowManagedHooksOnly`"), https://code.claude.com/docs/en/settings-reference
13. Connect Claude Code to tools via MCP, https://code.claude.com/docs/en/mcp. Also [claude-code-round-trip.md](claude-code-round-trip.md), finding 4.
14. Message your other Claude Code sessions ("Message delivery", "How a session treats an incoming message", "The session's inbox socket"), https://code.claude.com/docs/en/cross-session-messaging
15. Channels ("Research preview"), https://code.claude.com/docs/en/channels
16. CLI reference (`--safe-mode`), https://code.claude.com/docs/en/cli-reference
