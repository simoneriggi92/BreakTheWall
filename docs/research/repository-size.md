# How large are real repositories against one request?

Research for [#59](https://github.com/simoneriggi92/BreakTheWall/issues/59) (map [#58](https://github.com/simoneriggi92/BreakTheWall/issues/58)). Measured and read on 2026-11-17.

## Answer

- **Today's limit holds one module, not one repository.** `SOURCE_LIMITS` (120,000 characters, 5,000 lines) is about 30,000–35,000 tokens of raw text, or 40,000–50,000 once the app numbers the lines. That is one package of 5–15 files, or one or two large files. A small library (httpx, ~1.0 M characters) holds **9–11** such scopes. This repository (~3.3 M) holds **28–39**. FastAPI (~15 M) holds **126–166**.
- **The ChatGPT route's model window is about 20× larger.** The current OpenAI flagship models document a 922,000-token maximum input. httpx fits in one request whole. This repository fits only as raw text, and not once its lines are numbered. FastAPI does not fit. The Sign in with ChatGPT route documents no window of its own, so this is unwitnessed (see [Open](#open)).
- **The local route is the tight one.** The app caps Ollama at 65,536 tokens, which is about 160,000 characters of request, so roughly today's limit. LM Studio uses whatever context the learner loaded the model with, and it documents no default.
- **Inference:** a whole repository can be read deterministically, because file lists, sizes and declared links cost no model tokens. Reading in depth by a model works one scope at a time. Under today's limits, that scope is a directory subtree or a group of sibling files of about 120,000 characters.

## Method

Fixed commits: this repository `614148a` (origin/main, 2026-11-16), [encode/httpx](https://github.com/encode/httpx) `7cff5f7` (2026-11-16), and [fastapi/fastapi](https://github.com/fastapi/fastapi) `a1b3be0` (2026-11-16). Each external repository was shallow-cloned into its own empty scratch directory. Only counting scripts ran, kept outside the clones and run with `python -I`. No repository code or build tool was run.

**Exclusion rules**, applied in this order:

1. Only files listed by `git ls-files` are counted, so git-ignored files are out. Symlinks are skipped.
2. **Lock files** are removed by name: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `uv.lock`, `poetry.lock`, `Cargo.lock`, `go.sum`, `skills-lock.json` and any other `*.lock`.
3. **Vendored or generated files** are removed: any path under `node_modules/`, `vendor/`, `third_party/`, `dist/`, `build/`, `out/`, `site/` or `.venv/`, and any `*.min.js`, `*.min.css`, `*.map`, `*.snap` or `*.svg` file.
4. **Binary files** are removed: a file with a NUL byte in its first 8 KB, or one that is not valid UTF-8.
5. None of the three repositories has a root `.gitattributes` with `linguist-generated` marks.

The remaining files are **text files**. Characters are Unicode code points after CRLF→LF, as `importSource` counts them. Lines are `split('\n')`.

**Tokens** are given two ways:

- **chars/4**: the usual rule of thumb, and an approximation.
- **o200k**: counted with OpenAI's public `o200k_base` encoding ([tiktoken 0.14.0](https://github.com/openai/tiktoken)). OpenAI does not publish the tokenizer of its newest models. o200k is the most recent public one, so it is also an approximation, but a measured one. Local models (Llama, Qwen, Gemma) use their own tokenizers. The app itself budgets Ollama at 3 characters per token ([`src/desktop/local/runtimes.ts`](../../src/desktop/local/runtimes.ts)).

**Scopes** are counted two ways:

- **Lower bound**: total characters divided by the budget, rounded up.
- **Directory-respecting**: a scope is either one directory subtree or a group of sibling subtrees and files under one parent, packed first-fit. A subtree that is too large is split into its children. A single file that is too large is cut into line ranges.

## Facts: the three repositories

### Whole repository

| | This repository | httpx | FastAPI |
|---|---|---|---|
| Tracked files | 421 | 125 | 3,268 |
| Excluded | 38 symlinks, 6 binary, 6 generated/vendored, 2 lock | 10 binary | 191 binary, 56 SVG, 2 lock |
| **Text files** | **369** | **115** | **3,019** |
| **Characters** | **3,294,274** | **990,705** | **15,098,527** |
| Lines | 49,263 | 33,466 | 400,607 |
| Tokens, chars/4 | 823,568 | 247,676 | 3,774,631 |
| Tokens, o200k | 860,222 | 254,102 | 4,001,718 |
| Characters per o200k token | 3.83 | 3.90 | 3.77 |
| Files with a line > 4,000 chars | 13 (JSON fixtures in `src/fixtures/`) | 0 | 1 (`docs_src/stream_data/tutorial002.py`) |
| Files > 5,000 lines | 0 | 1 (`tests/models/whatwg.json`, 9,747) | 3 (`docs/en/docs/release-notes.md` 7,956, `tests/test_include_router_defaults_overrides.py` 7,305, `fastapi/routing.py` 6,553) |
| Files > 120,000 chars | 2 (frozen plans in `docs/workflow/plans/`, 156 k and 144 k) | 1 (`whatwg.json`, 209 k) | 4 (release notes 732 k, that test 395 k, `routing.py` 260 k, `applications.py` 185 k) |

### Largest top-level folders

Each cell gives characters, then o200k tokens, then files.

| Repository | Folders |
|---|---|
| This repository | `src` 1,286 k / 352 k tok / 102 files: `renderer` 489 k, `fixtures` 382 k, `core` 232 k, `desktop` 129 k, `mcp` 53 k. `docs` 924 k / 225 k / 54, of which `docs/workflow` (frozen) is 855 k. `tests` 483 k / 132 k / 49. `.agents` 266 k / 62 k / 103. |
| httpx | `tests` 494 k / 137 k / 40, of which `tests/models` is 289 k. `httpx` (the package) 284 k / 64 k / 24. `docs` 132 k / 32 k / 26. |
| FastAPI | `docs` 10,211 k / 3,064 k / 1,716: `docs/en` is 1,753 k, and each of 13 translations is 440–880 k. `tests` 3,509 k / 636 k / 652. `fastapi` (the package) 873 k / 176 k / 62. `docs_src` 225 k / 56 k / 489. `scripts` 184 k / 45 k / 67. |

Two observations come straight from the counts:

- **FastAPI's size is mostly translations.** Docs in languages other than English are about 8.5 M characters, 56 % of the repository. Code plus English docs is about 6.6 M.
- **chars/4 is within about 15 % for English and code. It is wrong for CJK text.** FastAPI's Japanese, Korean and Traditional Chinese docs run at 2.0–2.5 characters per token, so chars/4 undercounts them by up to 2×. Its tests, full of repeated identifiers, run at 5.5 characters per token, so chars/4 overcounts them.

### Line numbering costs tokens

The model sees each source with a line-number gutter: `formatSource` in [`src/core/generation.ts`](../../src/core/generation.ts) writes each line as `NNNN| text`. Measured on three files:

| File | Characters | o200k tokens |
|---|---|---|
| `httpx/_client.py` (short code lines) | +18 % | **+47 %** |
| `src/core/exploration-generation.ts` | +6 % | +13 % |
| `docs/product.md` | +5 % | +13 % |

`SOURCE_LIMITS` counts the raw text, so the tokens actually sent are 13–47 % higher than chars/4 suggests.

### Scopes per repository

Each cell gives the directory-respecting count, then the lower bound in parentheses. Files cut into line ranges are noted.

| Budget | This repository | httpx | FastAPI |
|---|---|---|---|
| **Today: 120 k chars and 5 k lines** | **39** (28), 2 files cut | **11** (9), 1 file cut | **166** (126), 4 files cut |
| Ollama cap in the app: ~160 k chars | 31 (21) | 9 (7) | 137 (95) |
| ~1 M chars (~272 k tokens) | 5 (4) | 1 | 20 (16) |
| ~3.5 M chars (~922 k tokens, raw) | 1 | 1 | 6 (5) |

The package folders alone at today's limits:

- httpx `httpx/`: 3 scopes.
- FastAPI `fastapi/`: 9 scopes, and `routing.py` and `applications.py` must each be cut.
- This repository's `src/`: 15 scopes. `src/core/` alone is 2.

The 5,000-line cap rarely binds before the character cap. Average line length is 67 characters here, 30 in httpx and 38 in FastAPI, so 5,000 lines is 150–335 k characters. The exception is dense test data such as httpx `tests/models`, at 23 characters per line.

## Facts: what the app's routes can carry

**ChatGPT account (Sign in with ChatGPT)**

- The route serves "a model available to the signed-in account", read from `GET /v1/models` with `visibility == "list"`. It names no fixed list and states **no context, input or output limit** ([Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)).
- Its preview limitations require `stream: true` and `store: false`. `max_output_tokens` and `truncation` are unsupported parameters. No size limit is listed ([Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)).
- The current flagship models are `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6.1-terra` and `gpt-6-luna`. Each is listed with a **1.05 M context window** ([Models](https://developers.openai.com/api/docs/models)).
- `gpt-6.1-sol` and `gpt-6-luna` each document **922,000 maximum input tokens** and 128,000 maximum output tokens ([GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)).
- The Sol page adds two notes:
  - API prompts above 272 K input tokens are billed at 2× input. Subscription usage has no long-context surcharge.
  - Codex and ChatGPT Work default to a **500 K** context window.
- In this app, exploration runs only on the ChatGPT route and the assistant (MCP) route. A local model is refused with `exploration-local` ([`src/desktop/generator.ts`](../../src/desktop/generator.ts)).

**Ollama**

- The server's default context depends on memory: **4 k below 24 GiB VRAM, 32 k at 24–48 GiB, 256 k at 48 GiB or more**. It can be changed with `OLLAMA_CONTEXT_LENGTH` ([Context length](https://docs.ollama.com/context-length)).
- The Modelfile reference still gives `num_ctx` as "Default: 2048" ([Modelfile](https://docs.ollama.com/modelfile)). The two pages disagree. The newer one describes the server.
- The app does not depend on the server's default. It sets `num_ctx` on every request to `max(16,384, ceil((chars/3 + 12,000) / 4,096) × 4,096)` and refuses anything above `OLLAMA_MAX_CONTEXT = 65,536`, because Ollama silently truncates past `num_ctx` ([`src/desktop/local/runtimes.ts`](../../src/desktop/local/runtimes.ts)).
- The ceiling therefore sits at about **160,600 characters of request**: instructions plus the numbered sources.

**LM Studio**

- Context length is a setting applied when the model is loaded: `--context-length` on `lms load`, `context_length` on the REST load call, or the per-model defaults ([lms load](https://lmstudio.ai/docs/cli/local-models/load), [REST load](https://lmstudio.ai/docs/developer/rest/load), [Per-model defaults](https://lmstudio.ai/docs/app/advanced/per-model)).
- None of these pages states the value used when nothing is set. A 4,096 default is reported only by users, for example an [LM Studio bug report](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1806) that gives it as "e.g.". **Unverified.**
- The app's OpenAI-compatible request sends no context size ([`src/desktop/local/runtimes.ts`](../../src/desktop/local/runtimes.ts)), so the window is whatever the learner loaded.

## Inferences

These are mine, not the sources'.

1. **One scope today is about 120 k characters, which is 35–50 k tokens as sent.** That matches one package or module with its nearby tests. It does not match a whole repository, even a small one: httpx is already 8× over.
2. **On the ChatGPT route, the binding limit is not the window.** At 922 k input tokens, httpx fits whole, this repository fits only without line numbers (860 k tokens raw, about 970 k–1.26 M numbered), and FastAPI needs about 6 scopes even at full size. What actually binds is answer quality across that much text, waiting time and plan usage. None of these was measured here, and the route's real ceiling is unwitnessed. Raising `SOURCE_LIMITS` toward the window is therefore a decision to test, not a fact.
3. **The local route can carry today's scope and no more.** 120 k raw characters numbered (+5–18 %) plus instructions comes close to the app's 65,536-token Ollama cap. LM Studio needs the learner to load the model with at least about 64 k context. Below 24 GiB of VRAM, Ollama's own 4 k default would be useless, but the app overrides it.
4. **The deterministic whole-repository level costs nothing against these budgets.** File list, sizes and declared links are computed by the app, not read by a model. A medium repository still produces about 10–40 in-depth scopes at today's limits, and a large one 100 or more. So the map needs a way to choose the scope (a question, a folder, a nucleus), not a way to read everything.
5. **Directories are a usable first cut but not a perfect one.** Packing sibling folders and files adds 20–40 % over the lower bound, and a few files per repository are larger than one scope on their own: release notes, a 260 k-character `routing.py`, test data. Cutting those into line ranges is unavoidable at any budget below about 1 M characters.
6. **Excluding by language or path pays off.** In FastAPI, translations are 56 % of the characters. Excluding them, as the map's file-level bill of materials suggests, removes about 70 of its 166 scopes at today's limits, roughly 40 %.

## Open

- What is the real input ceiling of the Sign in with ChatGPT route, and how long does a 300 k–900 k token request take there, and how much plan usage does it spend? This needs a witnessed request. The docs state no limit.
- What are the context maxima of the local models the learner will actually run (for example Qwen or Llama families in Ollama)? These were not surveyed.
- Does a single exploration stay faithful across a scope larger than 120 k? This is an eval question for the later ticket.

## Sources

- OpenAI, [Sign in with ChatGPT: models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) and [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).
- OpenAI, [Models](https://developers.openai.com/api/docs/models), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
- OpenAI, [tiktoken](https://github.com/openai/tiktoken) (`o200k_base`, version 0.14.0).
- Ollama, [Context length](https://docs.ollama.com/context-length), [Modelfile](https://docs.ollama.com/modelfile).
- LM Studio, [lms load](https://lmstudio.ai/docs/cli/local-models/load), [REST load](https://lmstudio.ai/docs/developer/rest/load), [Per-model defaults](https://lmstudio.ai/docs/app/advanced/per-model), [bug tracker #1806](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1806) (user report, not documentation).
- This repository: [`src/core/source.ts`](../../src/core/source.ts) (`SOURCE_LIMITS`), [`src/core/generation.ts`](../../src/core/generation.ts) (`formatSource`), [`src/desktop/local/runtimes.ts`](../../src/desktop/local/runtimes.ts), [`src/desktop/generator.ts`](../../src/desktop/generator.ts).
