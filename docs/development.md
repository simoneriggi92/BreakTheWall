# Local development

The app targets macOS and Windows x64; CI runs every check on both. Use Node 22.23.2 and npm 10.9.8 (the versions verified for this alpha). Dependencies are pinned in `package.json` and `package-lock.json`; use npm rather than mixing lockfiles.

```sh
npm ci
npm run dev
```

Electron may download its official platform binary on first launch. Network access is needed for installation, not for the prepared lessons. `npm run dev` starts Vite on `127.0.0.1:5173` and launches Electron. Renderer changes reload; restart the command after desktop/preload changes.

```sh
npm run check
npm run build
npm start
```

`check` runs strict TypeScript checks and the automated tests. `build` checks types, bundles the renderer into `dist/`, and bundles main/preload into `dist-electron/`. `start` launches that production build locally. `npm run package` turns it into the downloadable app; see [Packaging](#packaging).

`npm run dev:web` opens the same renderer for browser layout inspection. Browser preview and Electron are different runtime checks; browser persistence does not prove desktop persistence. Desktop test data can be isolated by setting `BTW_USER_DATA_DIR` to an absolute test directory before starting the app.

## Boundaries

The renderer has no Node integration, filesystem API, or credentials. Electron uses sandboxing, context isolation, permission denial, navigation restrictions, and an application-owned `btw://app/` protocol. The preload exposes named operations, never a generic IPC or shell API. The development server is loopback-only; production content policy allows no network connections.

Network access for AI belongs to the main process only: the system browser handles sign-in, a one-shot listener on `127.0.0.1` receives the callback, and `https://auth.openai.com` and `https://api.openai.com/v1` serve tokens and inference. Credentials are encrypted with Electron `safeStorage` under `<userData>/credentials/`; generated disassemblies live in `<userData>/disassemblies/` (one folder per disassembly, every revision kept), earlier generated lessons in `<userData>/lessons/`, progress in `<userData>/workspaces/`, and the draft of an interrupted generation in `<userData>/generation-draft.json`. Sign-in needs the macOS Keychain; without it the app disables sign-in rather than storing plaintext.

The local-model route talks only to loopback addresses, from the main process. To try it, start a model server before opening the generation step. For example, run `llama-server -m model.gguf -c 32768` (port 8080), or start LM Studio's server (port 1234) or Ollama (port 11434). The app then finds the server by itself. The format check tells you whether that server enforces the lesson schema; Ollama 0.30.8 did not for the models in the local inference trial.

The domain module must remain independent of React and Electron. Lesson content is data rendered with application-owned components; source text is never HTML or executable UI. A source read as a document is rendered by `markdown-it` with raw HTML off, so markup in it shows as text; links are not followed and images are not fetched. Mermaid diagrams load on first use and run in strict mode. The production policy allows styles only from the app's files, so a diagram's `<style>` and `style` attributes are applied through the CSS object model (`src/renderer/svg-mount.ts`) rather than by loosening the policy.

## Brand assets

The mark, the wordmarks and the app icon are hand-written SVG in `docs/images/brand/`. The header draws the same mark inline, with its colours from the theme's `--brand-*` tokens; terracotta is used only for the piece pulled out of the mark. `npm run brand` renders `assets/icon.png` (1024 × 1024) and `assets/icon.ico` (16–256 px, for Windows) from `app-icon.svg` with the installed Electron, and the desktop host sets it as the Dock icon for `npm start` and `npm run dev` on macOS and as the window icon elsewhere. The packaged app carries it as its bundle icon instead (see [Packaging](#packaging)).

## Packaging

`npm run package` builds the app and turns it into `release/Break-the-Wall-<version>-arm64.dmg` with a `.sha256` file, on an Apple Silicon Mac (`scripts/package-mac.mjs`):

1. `assets/icon.png` becomes the bundle's `.icns` (`sips`, `iconutil`).
2. `@electron/packager` makes `Break the Wall.app` for `darwin`/`arm64`. Only `dist/`, `dist-electron/`, `assets/` and `package.json` go into `app.asar`: every runtime dependency is already bundled, so there is no `node_modules`.
3. The bundle is signed ad-hoc and checked with `codesign --verify --deep --strict`. It is built in a temporary folder, because a synced folder such as iCloud Documents adds Finder attributes that break the signature.
4. The start check opens the packaged app with empty user data and `BTW_SMOKE_TEST=1`: the main process exits 0 once the library is drawn, or 1 on a load failure, a renderer crash or 30 s without the library. Then the server check runs the packaged MCP server with `ELECTRON_RUN_AS_NODE=1` and requires its tools and its prompt. The script stops if either fails.
5. `hdiutil` writes the LZMA-compressed DMG with the app and an `Applications` link.

The app uses the same data folder as `npm start` (`~/Library/Application Support/Break the Wall`), because the main process names the app before anything else. It needs macOS 13 or later (`LSMinimumSystemVersion`, from Electron).

On Windows, `npm run package:win` (`scripts/package-win.mjs`, on a Windows x64 machine) makes the same app folder for `win32`/`x64` with the executable `BreakTheWall.exe` (Squirrel needs a name without spaces) and `assets/icon.ico`, runs the same start check, and builds `release/Break-the-Wall-<version>-x64-setup.exe` with `electron-winstaller` (Squirrel), with its `.sha256`. Squirrel installs per user under `%LOCALAPPDATA%\BreakTheWall` and starts the app with `--squirrel-install`, `--squirrel-updated` or `--squirrel-uninstall`; `src/desktop/squirrel.ts` then creates or removes the Start menu and desktop shortcuts through `Update.exe` and quits. Data lives in `%APPDATA%\Break the Wall`. The setup is not code-signed, so SmartScreen asks the user to confirm; signing would be `electron-winstaller`'s `windowsSign` option. What both scripts share (the files that go in, the start check, the checksum) is in `scripts/package-common.mjs`.

### Making a release

1. Set `version` in `package.json` to the new version (for example `0.1.1-alpha`), add its CHANGELOG section, and merge the change into `main` through a pull request.
2. Tag that commit on `main` with the same version and a leading `v`, and push the tag: `git tag v0.1.1-alpha && git push origin v0.1.1-alpha`.
3. The [Release workflow](../.github/workflows/release.yml) checks that the tag matches `package.json`, runs `npm run check` with `npm run package` on an Apple Silicon runner and `npm run package:win` on a Windows runner, and attaches the DMG, the setup and their `.sha256` files to the tag's release. With no release yet, it creates a draft pre-release with generated notes.
4. Download the DMG and the setup from the draft with a browser, install them as the README says, and check them. Then edit the notes and publish the release.

A pull request that changes packaging, or a manual run of the workflow, builds the same DMG and setup as workflow artifacts and touches no release.

Ad-hoc signing lets the app run but not pass Gatekeeper: after a browser download, macOS blocks the first open until the user chooses Open Anyway. Signing with an Apple Developer ID and notarizing would replace the `codesign` step in `scripts/package-mac.mjs`; that needs an Apple Developer account and is not set up.

## The MCP server (Claude Desktop and Claude Code)

Plan [P-20261028-mcp-integration](workflow/plans/P-20261028-mcp-integration/plan.md); the README's [Use with Claude](../README.md#use-with-claude) is the user's side. The arrows below mean "sends to".

```
Claude Desktop (.mcpb, its own Node) / Claude Code (the app's Electron, ELECTRON_RUN_AS_NODE=1)
  │ stdio, MCP JSON-RPC: src/mcp/protocol.ts (by hand, no SDK)
  ▼
src/mcp/server.ts: open_in_break_the_wall · start_disassembly · submit_structure · submit_part · submit_runs · prompt break
  │ src/mcp/assistant.ts runs the app's own accept functions phase by phase (level B)
  │ one JSON line per request: src/desktop/incoming.ts (hello, open, save)
  ▼
the app's main process (only while "Connect AI assistants" is on) → Studio, or saveFromAssistant → the library
```

- **Build.** `npm run build` bundles `src/mcp/main.ts` to `dist-electron/mcp-server.cjs` (Node 20). It also writes `dist-electron/break-the-wall.mcpb`, a zip with the MCPB 0.3 manifest, the server and the icon, made by `scripts/zip.mjs` with no dependency. The prompt's text lives once, in `src/mcp/prompts.json`, and is read by both the server and the manifest. Packaging unpacks both files from `app.asar`, so that other programs can read them.
- **Run it from source.** After `npm run build`, start the app (`npm start`) and turn on **Use with Claude → Connect AI assistants**. Then copy the panel's Claude Code command: from source it names Electron in `node_modules` and `dist-electron/mcp-server.cjs`. Or drive the server by hand, one JSON-RPC message per line:

  ```bash
  printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"dev","version":"1"}}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node dist-electron/mcp-server.cjs
  ```

- **Address.** `incomingAddress` derives the socket or pipe from the data folder, so a copy started with `BTW_USER_DATA_DIR` has its own. The server finds it the same way: `defaultUserData`, with `BTW_USER_DATA_DIR` first.
- **Tests.**
  - `tests/incoming.test.ts`: the entry point on a real socket or pipe.
  - `tests/mcp-server.test.ts`: the protocol, the open tool, the prompt, and the bundle started with plain Node.
  - `tests/mcp-assistant.test.ts`: level B end to end with the prepared disassemblies' answers, and the saving rules.
  - `tests/assistants.test.ts`: the `.mcpb` read back, and the Claude Code command.
- **Claude Code and prompt arguments.** Claude Code splits a prompt's arguments on whitespace and passes only the first word (checked 2026-10-28). Prompts must not rely on a whole sentence arriving in one argument.

## Toolchain references

Versions were checked against npm metadata on 2026-10-21. The current [Vite guide](https://vite.dev/guide/) documents its Node requirements. The host follows the relevant boundaries in Electron's [security guide](https://www.electronjs.org/docs/latest/tutorial/security) and [sandbox model](https://www.electronjs.org/docs/latest/tutorial/sandbox). Runtime data validation follows [Zod's parsing model](https://zod.dev/basics). These references explain choices; they are not evidence of a successful app launch.

## Evaluating generation

`npm run eval` runs the app's own two-phase generator on fixed cases and writes a report under `.local/eval/runs/<time>-<route>/`. The `.local` folder is ignored by git. Use it to compare a change to prompts, schemas, the pipeline or the models against a baseline.

```sh
npm run eval                                   # public cases, 2 attempts, the local model chosen in the app
npm run eval -- --cases kessmouth,mill-harm --runs 1
npm run eval -- --runtime llamacpp --base http://127.0.0.1:8080 --model qwen3.6
npm run eval -- --list-models                  # the account's ChatGPT models; no generation
npm run eval -- --route chatgpt --allow-chatgpt --setups A,B,C --strong <slug> --cheap <slug>
npm run eval -- --route chatgpt --allow-chatgpt --structure-model <slug> --content-model <slug>
npm run eval -- --route chatgpt --allow-chatgpt --setups C --strong <slug> --cheap <slug> --expand
```

`--expand` then takes apart one part per case on the first valid attempt of the first setup named: the leaf with the most lines of its own, through that setup's structure model. Each expansion is one request, plus at most one repair. It writes `expansions.jsonl`, the expanded disassembly and its review sheet.

A generation is three phases: the structure with the bill of materials, one request per top-level part, and one for the runs. Each phase can be repaired once. A ChatGPT **setup** names the models:
- **A:** the strong model on every phase;
- **B:** the cheap model on every phase;
- **C:** the strong model for the structure, the cheap one for parts and runs.

**Cases**
- **Public:** `eval/cases/*.json`, each a question, a content language and snapshots of its sources. They are original, public-domain or repository text: the Atlas runbook (mechanism), Mill's harm principle (argument), the Kessmouth story (story) and this repository's earlier core pipeline (code).
- **Private:** your own documents go in `.local/eval/cases/` in the same format. A private case runs only when you name it in `--cases`, and nothing from it leaves `.local/`. On ChatGPT it also needs `--private-to-chatgpt`, which you pass only once you know that sending the document to OpenAI is allowed.

**ChatGPT runs** spend your plan, so:
- they need `--allow-chatgpt`;
- they are capped at 2 attempts per case and setup;
- the plan's budget of 30 generations (28 on public cases, 2 on private ones) and 4 parts taken apart is counted across runs in `.local/eval/chatgpt-budget.jsonl`, and a run that would exceed it does not start;
- they stop at the first usage-limit response.

The runner also stops when a local server is unreachable or the model is missing.

**Report contents**
- `attempts.jsonl`: one line per attempt, with validity, time, and per phase the requests, repairs and characters sent and received. A valid attempt also records parts per level, depth, joint families, forgotten lines, layout findings, the written language, runs, inferences and answer-length ratios. A correct option much longer than the wrong ones gives itself away.
- `summary.json`: totals per case and setup, by letter only.
- `setups.json`: the models behind each letter. Open it only after the review.
- The disassembly of every valid attempt.
- One `*.review.md` sheet per case and setup, read blind: every point, sub-part, joint and run explanation next to its cited lines, with an empty verdict (✅ correct, ⚠️ imprecise, ❌ wrong) and a 1–5 rating for the exploded view and for the runs. Claim errors are the one metric the runner cannot compute; fill in the sheet to record them.
