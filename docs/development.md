# Local development

The player targets macOS. Use Node 22.23.2 and npm 10.9.8 (the versions verified for this alpha). Dependencies are pinned in `package.json` and `package-lock.json`; use npm rather than mixing lockfiles.

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

`check` runs strict TypeScript checks and the automated tests. `build` checks types, bundles the renderer into `dist/`, and bundles main/preload into `dist-electron/`. `start` launches that production build locally. This is not a signed installer or a distributable application package.

`npm run dev:web` opens the same renderer for browser layout inspection. Browser preview and Electron are different runtime checks; browser persistence does not prove desktop persistence. Desktop test data can be isolated by setting `BTW_USER_DATA_DIR` to an absolute test directory before starting the app.

## Boundaries

The renderer has no Node integration, filesystem API, or credentials. Electron uses sandboxing, context isolation, permission denial, navigation restrictions, and an application-owned `btw://app/` protocol. The preload exposes named operations, never a generic IPC or shell API. The development server is loopback-only; production content policy allows no network connections.

Network access for AI belongs to the main process only: the system browser handles sign-in, a one-shot listener on `127.0.0.1` receives the callback, and `https://auth.openai.com` and `https://api.openai.com/v1` serve tokens and inference. Credentials are encrypted with Electron `safeStorage` under `<userData>/credentials/`; generated lessons live in `<userData>/lessons/`, progress in `<userData>/workspaces/`. Sign-in needs the macOS Keychain; without it the app disables sign-in rather than storing plaintext.

The local-model route talks only to loopback addresses, from the main process. To try it, start a model server before opening the generation step. For example, run `llama-server -m model.gguf -c 32768` (port 8080), or start LM Studio's server (port 1234) or Ollama (port 11434). The app then finds the server by itself. The format check tells you whether that server enforces the lesson schema; Ollama 0.30.8 did not for the models in the local inference trial.

The domain module must remain independent of React and Electron. Lesson content is data rendered with application-owned components; source text is never HTML or executable UI.

## Toolchain references

Versions were checked against npm metadata on 2026-10-21. The current [Vite guide](https://vite.dev/guide/) documents its Node requirements. The host follows the relevant boundaries in Electron's [security guide](https://www.electronjs.org/docs/latest/tutorial/security) and [sandbox model](https://www.electronjs.org/docs/latest/tutorial/sandbox). Runtime data validation follows [Zod's parsing model](https://zod.dev/basics). These references explain choices; they are not evidence of a successful app launch.

## Evaluating generation

`npm run eval` runs the app's own generator on fixed cases and writes a report under `.local/eval/runs/<time>-<route>/`. The `.local` folder is ignored by git. Use it to compare a change to prompts, the draft schema, the pipeline or the model against a baseline.

```sh
npm run eval                                   # all cases, 3 attempts, the local model chosen in the app
npm run eval -- --cases glucose,release-runbook --runs 1
npm run eval -- --runtime llamacpp --base http://127.0.0.1:8080 --model qwen3.6
npm run eval -- --route chatgpt --model <slug> --allow-chatgpt --runs 2
```

**Cases**
- **Public:** `eval/cases/*.json`, each a goal plus snapshots of its sources. They are original text or files from this repository, so they never change as the code evolves.
- **Private:** your own documents go in `.local/eval/cases/` in the same format. They are included unless you pass `--public-only`, and nothing from them leaves `.local/`.

**ChatGPT runs** spend your plan, so:
- they need `--allow-chatgpt`;
- they are capped at 2 attempts per case;
- they stop at the first usage-limit response.

The runner also stops when a local server is unreachable or the model is missing.

**Report contents**
- `attempts.jsonl`: one line per attempt, with validity, repair, time, output size, page and representation mix, source coverage, and answer-length ratios. A correct answer much longer than the wrong ones gives itself away.
- `summary.json`: totals per case.
- The lesson of every valid attempt.
- One `*.review.md` sheet per case: every statement next to its cited lines, with an empty verdict (✅ correct, ⚠️ imprecise, ❌ wrong). Claim errors are the one metric the runner cannot compute; fill in the sheet to record them.
