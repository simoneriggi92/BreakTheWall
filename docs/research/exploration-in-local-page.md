# Research: running exploration in the plugin's local page

Date: 2026-11-22. Resolves the research ticket [What does it take to run Break the Wall's exploration in the plugin's local page?](https://github.com/simoneriggi92/BreakTheWall/issues/79), under the map [#70](https://github.com/simoneriggi92/BreakTheWall/issues/70). It feeds the decision of [#76](https://github.com/simoneriggi92/BreakTheWall/issues/76): one local page, no desktop app, Electron frozen.

Already settled, not re-researched here: a Claude Code plugin's mod spawns a loopback Node server that serves one browser page; the mod talks to it with `$.http.fetch` and returns answers with `$.prompt.submit` (witnessed in [#83](https://github.com/simoneriggi92/BreakTheWall/issues/83)); side chats are `claude -p --resume <session> --fork-session` processes the server starts ([#74](https://github.com/simoneriggi92/BreakTheWall/issues/74)).

Labels: **Fact** is backed by code in this repository (file:line at commit `42d54b7`) or a cited primary source; **Inference** is reasoned from facts; **Unverified** is neither, and needs a witness before the spec relies on it.

## Verdict

Exploration needs almost nothing from Electron itself. The exploration view and the reading report run in the page with no host call; the host code behind exploration (stores, generator, checks) is already plain Node. A local server has to provide about ten small HTTP endpoints and one model route. The hard parts are not the port: they are **who writes the exploration** (credentials and model route), **the content policy** (`connect-src 'none'` blocks any call to the server today) and **replacing the Electron sender check** with something that keeps other local pages and processes out.

```text
browser page (renderer bundle, unchanged views)
   │  fetch, same origin (needs connect-src 'self')
   ▼
loopback Node server  ── reuses src/core + src/desktop stores/generator
   │                        (no electron imports there)
   ├─► disk: explorations/, settings.json under a data folder
   └─► model route: main agent | claude -p | $.model via the mod | API key
```

Arrows mean "calls".

## 1. What exploration uses from the Electron host today

**Fact.** Only `src/desktop/main.ts` and `src/desktop/preload.ts` import `electron` (checked with `grep -rn "from 'electron'" src/`). The preload exposes one frozen object, `window.breakTheWall` (`preload.ts:75`), made of `DesktopBridge` (`src/core/bridge.ts:19-25`) and `StudioBridge` (`src/core/provider.ts:170-212`). Every handler in `main.ts` first calls `trustedSender` (`main.ts:45-48`), which refuses frames outside the app origin.

**Fact.** The exploration view itself takes no bridge: `App.tsx:108` renders `<ExplorationView x={exploration} goHome=…/>`, and `src/renderer/exploration/` imports only `src/core` and renderer modules. Its view state is an in-memory reducer (`exploration/state.ts`), and the reading report is computed in the page from `src/core/reading-report.ts` (`Report.tsx:4`). So "read the structure", "the views" and "the reading report" use **no IPC at all**.

What does use IPC is getting an exploration into the page: listing saved ones, receiving one an assistant wrote, and creating one from a source.

| Bridge call (`preload.ts`) | Channel | Used by exploration at | What the main process does |
|---|---|---|---|
| `getRuntime` (`:70`) | `runtime:get` | `App.tsx:93`, `preferences.tsx:52` | Returns platform, `mode: 'desktop'`, OS locale (`main.ts:276`). |
| `listExplorations` (`:59`) | `explorations:list` | `App.tsx:65` | `ExplorationStore.list()` reads `<userData>/explorations/<id>/<rev>.json`, validates each, skips bad files (`main.ts:160`, `exploration-store.ts:30-50`). |
| `findExploration` (`:60`) | `explorations:find` | not called by the renderer | Parses id and revision with `idSchema`, reads one file (`main.ts:161-165`). |
| `onAssistantExploration` (`:47-52`) + `incoming:ready` | `studio:exploration` push | `App.tsx:56` | An MCP client sends `explore` on the local socket; `exploreFromAssistant` imports the source, runs `acceptExploration`, saves, queues the result until the page is ready, raises the window (`main.ts:170-194`, `:213-218`, `assistants.ts:53-59`, `incoming.ts:75-79`, `:122-133`). |
| `onIncomingSource` (`:31-40`) | `studio:incoming` push | `App.tsx:46` | Same socket, `open`: imports a pasted text and hands it to Studio (`main.ts:197-204`). |
| `pickSources` (`:6`) | `sources:pick` | `Studio.tsx:79` | Native file dialog, size check, `importSource` of the chosen files only (`main.ts:71-92`). |
| `startExploration` (`:61`) | `exploration:start` | `Studio.tsx:257` | `Generator.explore`: Zod-parses the request (`generator.ts:30`, `:268`), refuses the local route (`:270`), re-verifies the source (`:272`), refuses sources over 52,000 chars (`:273-274`), one request plus at most one repair and one shorten on the ChatGPT route, `acceptExploration`, save (`:277-283`). |
| `onGenerationProgress` (`:17-30`) | `generation:progress` push | `Studio.tsx:228` | Throttled progress events sent to the sender (`main.ts:107-114`). |
| `cancelGeneration` (`:13`) | `generation:cancel` | `Studio.tsx:303` | Aborts the running request (`main.ts:145`, `generator.ts:290`). |
| `accountStatus`, `signIn`, `cancelSignIn`, `signOut`, `listModels` (`:7-11`) | `account:*` | `Studio.tsx:158`, `:162`, `:237`, `:286`, `:288` | Sign in with ChatGPT (OAuth on a one-shot `127.0.0.1` listener), tokens in an encrypted vault, model list (`main.ts:52-58`, `:93-105`). |
| `openUsageSettings` (`:62`) | `account:usage-settings` | `Studio.tsx:269` | `shell.openExternal('https://chatgpt.com/#settings')` (`main.ts:166`). |
| `getSettings`, `saveSettings` (`:63-64`) | `settings:*` | `preferences.tsx:51`, `:65` | `settings.json` validated by `settingsSchema`; saving also toggles the MCP socket (`main.ts:125-131`). |
| `discoverLocal`, `connectLocal`, `checkLocalFormat` (`:65-67`) | `local:*` | `Studio.tsx:337-349` | Probe loopback model servers. **Not usable for exploration**: the local route is refused (`generator.ts:270`). |

Not used by exploration: lessons, disassemblies, progress (`loadProgress`/`saveProgress` serve lessons and disassemblies only, `bridge.ts:8-11`), suggestions, generation drafts, and the "Use with Claude" panel (`assistants:*`).

## 2. What the local server would provide instead

**Fact.** The host code behind these calls is plain Node and already injectable: `ExplorationStore` (`node:fs`), `Generator` (takes a `Routes` of `Completer`s, `generator.ts:23`, `:113`), `SettingsStore`, `ChatGPTAccount` (takes `vault`, `fetch`, `openExternal`, `account.ts:14`), `local/runtimes.ts`, and `incoming.ts`, which the MCP server already imports from plain Node (`src/mcp/AGENTS.md`). `SafeStorageVault` takes a `Cipher` interface (`secure-files.ts:5`); only the Electron `safeStorage` passed in at `main.ts:53` is Electron.

**Fact.** The renderer already has the seam: `App` takes `bridge` as a prop and falls back to `window.breakTheWall ?? browserBridge` (`App.tsx:26`); `browserBridge` (`storage.ts:5-19`) is a bridge with no `studio`, used by `npm run dev:web`.

**Inference.** An `httpBridge` implementing `DesktopBridge` over `fetch` is enough on the page side; no view changes.

| Need | Server provides | Difficulty |
|---|---|---|
| Serve the page | Static files from `dist/`, with `appFilePath` (`app-files.ts:7-12`) as the path guard | Trivial |
| `getRuntime` | `GET /api/runtime` | Trivial |
| `listExplorations` | `GET /api/explorations` → `ExplorationStore.list()` | Trivial |
| Settings | `GET/PUT /api/settings` → `SettingsStore`, body parsed with `settingsSchema` | Trivial |
| Spec arrives as a source (replaces `onIncomingSource` / `onAssistantExploration`) | The mod or agent `POST`s the spec text to the server; the page receives it by long-poll or SSE, the same channel the round uses | Easy: the long-poll exists from #83 |
| Progress and cancel | SSE or long-poll for progress; `POST /api/exploration/cancel` | Easy |
| Pick a file | No native dialog in a plain server. Either a browser `<input type="file">` (the page reads the bytes and calls `importSource`, which is pure core) or the agent names the spec's path and the server reads it | Easy, but see breaking point 5 |
| `startExploration` | `POST /api/exploration` → `Generator.explore` with a new route | **Hard: the model route, section 3** |
| Sender check | A replacement for `trustedSender` | **Hard: breaking point 3** |
| Data folder | A folder for `explorations/` and `settings.json`, e.g. the plugin's data folder or `BTW_USER_DATA_DIR` | Easy; which folder is a decision |

## 3. Credentials and model calls

### Today

- **Fact.** Exploration runs only on the ChatGPT route (`generator.ts:270`, `:279`). The account is Sign in with ChatGPT; tokens are kept in `SafeStorageVault`, encrypted with Electron `safeStorage`, with no plaintext fallback (`secure-files.ts:14-33`, `main.ts:53`). Calls go from the main process to `https://api.openai.com/v1` Responses with a strict JSON schema (`chatgpt/responses.ts:4`, `:50`, `:74`).
- **Fact.** A second route already exists without credentials: the **assistant route**. Claude (Desktop or Code) receives the same instructions and schema through the MCP server (`src/mcp/exploration.ts:27-48`), writes the JSON, and the app checks it with the same `acceptExploration`, findings back for one repair (`assistants.ts:53-59`, `incoming.ts:122-133`). The contract already records `provider: 'assistant'` (`exploration.ts:54`).

### Where it could live in the plugin route

| Option | Credentials | Structured output | Evidence |
|---|---|---|---|
| **A. The main agent writes it** (assistant route, through the plugin instead of MCP) | The user's Claude Code session; the server holds none | None needed: `acceptExploration` plus one repair is the check, as today | **Fact**: the route and its checks exist (`src/mcp/exploration.ts`, `assistants.ts:53`). **Inference**: the spec is already in the main conversation, but the source (≤52,000 chars) and the answer add to the main context. |
| **B. The server runs `claude -p`** with `--json-schema`, no tools, `--no-session-persistence` | The user's Claude Code login, as for side chats (#74); not `--bare`, which reads only `ANTHROPIC_API_KEY` or `apiKeyHelper` | `--json-schema` exists "for structured output validation (only works with --print)" | **Fact**: `claude --help`, Claude Code 2.1.330. **Unverified**: that the exploration schema (`explorationJsonSchema()`) is accepted and enforced, time and cost per source, and whether a Team account allows it unattended. |
| **C. The mod calls `$.model.complete`** and passes the text to the server | "The session's own client and credentials"; counts toward the session's `/cost` | No schema field; text only. `maxTokens` default 1024, at most 64,000; reply not streamed (no progress); a provider ends it at ten minutes | **Fact**: mod API types `claude-code.d.ts` (`model.complete`, `ModelCompleteRequest`) bundled with Claude Code 2.1.329. **Unverified**: that 64,000 tokens and ten minutes suffice for a 52,000-char source; behaviour on 2.1.330. |
| **D. An API key the server holds** | `ANTHROPIC_API_KEY` or a key the user enters | Depends on a new `Completer` | **Inference**: needs a new completer and secure storage without `safeStorage` (Keychain through another route). AGENTS.md: "no credentials or AI services are configured by this foundation". |
| **E. Keep Sign in with ChatGPT** in the server | Same OAuth, plain Node (`oauth.ts` uses `node:http`, `node:crypto`) | Strict schema, as today | **Fact**: only the vault's cipher and `shell.openExternal` are Electron. **Unverified**: a non-Electron cipher (macOS Keychain) for the tokens; and whether a second vendor's sign-in belongs in a Claude Code plugin at all. |

**Inference.** A, B and C all reuse the user's Claude login and keep the server credential-free; the choice between them is about context cost (A), unattended runs and schema enforcement (B), and progress and output size (C). In every option the server keeps `acceptExploration` as the gate, so the model never decides what is valid.

**Fact.** `routeSchema` knows only `chatgpt` and `local` (`provider.ts:84-87`), and Studio's create flow assumes a ChatGPT account (`Studio.tsx:158-162`, `:232`). Any Claude route is a new route value and a new Studio state, in both catalogs.

## 4. What `src/core` gives, and serving the renderer as-is

**Fact.** `src/core` imports only `zod` and itself (`grep "^import" src/core/*.ts`). It uses `crypto.subtle` (`hashText`, `lesson.ts:64-66`) and `crypto.getRandomValues` (`exploration-generation.ts:204`), which Node 22 and browsers both provide; the MCP server already runs core in plain Node. Without Electron or React it gives: the exploration contract and its validation (`validateExploration`, `exploration.ts:160-168`), the request (`explorationRequest`, `exploration-generation.ts:136-143`), the gate (`acceptExploration`, `:187-202`), source import and limits (`source.ts:57`, `:94`), shape, levels, layout, source index and reading report.

**Fact.** The Vite build uses `base: './'` (`vite.config.ts:4`), so asset paths are relative and load from any origin. Mermaid is a lazy chunk from the same origin (`diagrams.ts:13`); diagram styles go through the CSS object model so `style-src 'self'` holds (`src/renderer/AGENTS.md`).

**Fact.** `http://127.0.0.1` is a potentially trustworthy origin, so the page is a secure context and `crypto.subtle` works there ([W3C Secure Contexts, "Is origin potentially trustworthy?"](https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy)).

**Fact.** The production policy is `connect-src 'none'` (`vite.config.ts:10`). The page cannot call its own server until that becomes `'self'`.

**Fact.** The only assumption of a preload bridge is `window.breakTheWall` (`bridge.ts:27-29`, `App.tsx:26`), with a fallback. Optional `studio` methods are guarded with `?.` throughout (`App.tsx:46-86`, `Studio.tsx:232`).

**Inference.** The bundle can be served as-is once (1) `main.tsx` picks the `httpBridge` and (2) the policy allows `connect-src 'self'`.

## 5. Breaking points

1. **Content policy.** `connect-src 'none'` → `'self'` loosens the production policy, which AGENTS.md says is "not loosened". Same origin only, but it is an owner decision, and it should be recorded. (**Fact** for the rule, **Inference** for the size of the change.)
2. **Push channels.** `ipcRenderer.on` pushes (`generation:progress`, `studio:exploration`, `studio:incoming`) and the `incoming:ready` handshake (`main.ts:170-187`) have no HTTP twin. Progress and hand-offs need SSE or long-poll, and the "keep until a listener is there" queue moves into the server. (**Fact** for today, **Inference** for the fix.)
3. **No sender check over HTTP.** `trustedSender` relies on Electron knowing the frame (`main.ts:45-48`). Any local process, and any web page open in the browser, can send requests to `127.0.0.1:<port>`. **Inference**: the server needs a per-launch secret (in the URL the mod opens, sent back as a header), a `Host` check against DNS rebinding, an `Origin` check, and no CORS. Without it, another page could start a paid model call or write explorations.
4. **Zod at every entry still applies.** Each endpoint parses its body with the existing schemas: `explorationSchema` in `generator.ts:30` already does for start; settings use `settingsSchema`; ids use `idSchema`; a hand-off from the mod uses an `exploreSchema`-like schema (`incoming.ts:75-78`). The page keeps re-validating what it receives (`App.tsx:57`, `:66`). (**Fact** for the existing schemas, **Inference** that they cover the new endpoints.)
5. **No filesystem from the page means no paths from the page.** The renderer must never send a file path for the server to read; that would turn the server into the generic filesystem call AGENTS.md forbids. A spec arrives by text from the mod or agent, or by the user's own file pick in the browser. (**Inference** from the renderer rule.)
6. **What is lost without Electron.** The native dialog (`main.ts:76`), window raise on hand-off (`main.ts:188-194`), the encrypted vault (`secure-files.ts:14`), and the OS locale from `app.getPreferredSystemLanguages` (`main.ts:262`). The browser's `navigator.language` can stand in for the locale. (**Fact** for the list.)
7. **Two entry points to the same data.** If the Electron app (frozen) and the plugin's server both write explorations, they must agree on the data folder or the library splits in two. (**Inference.**)

## Unverified, to witness before the spec relies on it

- `claude -p --json-schema` accepts and enforces `explorationJsonSchema()`, its time and cost for a source near 52,000 characters, and whether it runs unattended under the Team guard.
- `$.model.complete` returns a whole exploration within 64,000 output tokens and ten minutes, and behaves the same on 2.1.330 as the 2.1.329 types say.
- The answer quality of a Claude-written exploration against the ChatGPT one (the assistant route exists; no comparison is recorded here).
- A non-Electron cipher for any credential the server would hold (options D and E).
