# Extracting declared links from code without a model

Research for [#60](https://github.com/simoneriggi92/BreakTheWall/issues/60), part of the map [#58](https://github.com/simoneriggi92/BreakTheWall/issues/58). Researched on 2026-11-17.

## Question

Which routes can compute, without a model, the links a repository declares in its own code (imports, project references, registrations), so they can become `declared` links in the exploration (`LINK_BASES` in `src/core/exploration.ts`)? For each route: languages covered, accuracy limits, bundle size and licence, and whether it runs in the Electron main process without native builds on macOS arm64 and Windows x64. Also: what GitDiagram and Gitingest actually do.

## Answer in short

- **Extraction and resolution are two different problems.** A parser gives the *string* a file names (`'@/types'`, `System.Text`, `"example.com/m/x"`); turning it into a *file* of the repository needs per-language resolution rules (tsconfig `paths`, `go.mod`, Python packages, class-per-file conventions). Every route below solves the first; only a compiler solves the second, and only for its own language.
- **tree-sitter through `web-tree-sitter` (WebAssembly) is the route that fits.** All seven grammars checked (TypeScript, TSX, JavaScript, Python, C#, Java, Go, Rust) load in Node 22 and in Electron 45's runtime on macOS arm64 with no native build, all under MIT. The import queries have to be written by us: the grammars' bundled `tags.scm` queries capture definitions and calls, not imports.
- **GitDiagram's diagram comes from an LLM**, fed the file tree, the README and sampled source. It now also computes a regex-based "SOURCE INDEX" of which files each file imports or names, used as evidence for the model's edges. Clicks are Mermaid `click` directives to the node's GitHub path, and paths the model invents are removed. **Gitingest uses neither parser nor model**: it walks the folder and concatenates a directory tree plus file contents into one text digest.
- **What no syntactic route can declare:** dynamic imports with computed specifiers, DI registrations hidden behind extension methods or assembly scanning, and anything resolved only at build time (MSBuild props, bundler aliases outside tsconfig).

## Method

Primary sources only: npm registry metadata and the published tarballs, the packages' READMEs and type definitions, the GitDiagram and Gitingest source at pinned commits, the MSBuild and LSP documentation. Three small throwaway scripts (kept out of the repository) checked the claims that mattered most:

1. `web-tree-sitter@0.27.2` loading each grammar's `.wasm` and running an import query, under Node 22.23.2 and under the Electron 45.0.0 binary in Node mode (`ELECTRON_RUN_AS_NODE=1`, Electron's own V8 and Node 24.22.0), on macOS arm64.
2. The native `tree-sitter@0.25.1` binding with its prebuilt binary under the same two runtimes.
3. `typescript@6.0.3`'s `preProcessFile` and `resolveModuleName` on a fixture with a tsconfig `paths` alias.

Nothing was tested on Windows x64; claims about Windows below are marked as inference.

## Findings

### 1. tree-sitter

**Facts**

- Two Node routes exist. `web-tree-sitter` is the WebAssembly build of the runtime; `tree-sitter` is the native Node binding (N-API, through `node-addon-api` and `node-gyp-build`). Both are MIT ([npm registry](https://www.npmjs.com/package/web-tree-sitter); [tree-sitter licence](https://github.com/tree-sitter/tree-sitter/blob/master/LICENSE)).
- The `web-tree-sitter` README states that "executing `.wasm` files in Node.js is considerably slower than running Node.js bindings", and recommends the `web-tree-sitter.cjs` file "for Electron" ([README, binding_web](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web)).
- `Language.load(input: string | URL | Uint8Array)` accepts bytes as well as a path (`web-tree-sitter.d.ts`, 0.27.2), so a grammar can be read from inside `app.asar` with `fs` and passed as a buffer.
- `web-tree-sitter >= 0.25` loads parser ABI 13 to 15; the README warns that "some prebuilt `.wasm` files use an older dynamic-linking format that newer versions of `web-tree-sitter` cannot load".
- Each official grammar package on npm now ships its own `.wasm` next to native prebuilds for `darwin-arm64`, `darwin-x64`, `linux-*`, `win32-arm64` and `win32-x64`. Measured from the published tarballs:

| Package (version) | Licence | `.wasm` size | ABI | `tags.scm` captures imports? |
|---|---|---|---|---|
| `web-tree-sitter` 0.27.2 (runtime) | MIT | 211 KB | n/a | n/a |
| `tree-sitter-typescript` 0.23.2 | MIT | 1.41 MB (+ TSX 1.45 MB) | 14 | no |
| `tree-sitter-javascript` 0.25.0 | MIT | 412 KB | 15 | no |
| `tree-sitter-python` 0.25.0 | MIT | 458 KB | 15 | no |
| `tree-sitter-c-sharp` 0.23.5 | MIT | 5.35 MB | 15 | no |
| `tree-sitter-java` 0.23.5 | MIT | 415 KB | 14 | no |
| `tree-sitter-go` 0.25.0 | MIT | 217 KB | 15 | partly (`import_spec` as a name) |
| `tree-sitter-rust` 0.24.0 | MIT | 1.10 MB | 14 | no |

  All seven together with the runtime come to about 11 MB of `.wasm`, of which C# alone is about half.

- **Measured, WebAssembly route.** Every grammar above loaded under `web-tree-sitter` 0.27.2, parsed without errors and answered a hand-written import query, both in Node 22.23.2 and in Electron 45.0.0's runtime (darwin arm64). Captures included the line of each import, for example TypeScript `src=@/types@L2`, Go `src="example.com/m/x"@L4`, C# `reg=AddScoped@L4 types=<IRepo, SqlRepo>@L4`.
- **Measured, throughput.** On this repository's own `src/` (81 `.ts`/`.tsx` files, 800 KB) the WebAssembly parser plus import query took 124 ms in total, found 408 import or re-export specifiers (311 relative) and hit no parse errors.
- **Measured, native route.** The native `tree-sitter` 0.25.1 prebuilt for darwin-arm64 also loaded and parsed in Electron 45's runtime with no rebuild. It is a 586 KB `.node` file per platform for the runtime, plus one per grammar (`tree-sitter-typescript.node` alone is 2.9 MB for darwin-arm64).
- **Packaging fact.** The app ships no `node_modules`: `scripts/package-common.mjs` keeps only `dist`, `dist-electron`, `assets` and `package.json`, because "every runtime dependency is already bundled by Vite and esbuild". `asar.unpack` currently lists only the MCP files.
- The renderer is sandboxed with no Node access (`src/desktop/AGENTS.md`); Electron's guidance is that "under no circumstances should you block this process and the UI thread with long-running operations" and to use worker threads for CPU-heavy work ([Electron performance](https://www.electronjs.org/docs/latest/tutorial/performance), section 3).

**Inference**

- The WebAssembly route needs no change of packaging model: `web-tree-sitter.cjs` bundles with esbuild like any other code, and the `.wasm` files are copied into `dist-electron` as data. The native route would need `.node` files kept outside esbuild (`external`), copied per platform, listed in `asar.unpack`, and ad-hoc signed in the macOS DMG; a step back from "no `node_modules`".
- WebAssembly is platform independent, so the Windows x64 result should match macOS arm64. This was **not tested**; the Windows CI smoke check would be the witness.
- At the measured rate (about 6 MB/s), a 50 MB source tree takes on the order of 8 s: enough to require a worker thread in the main process (or a utility process) rather than the main thread.

### 2. Per-language regular expressions

**Facts** (from GitDiagram's `source-references.ts`, the best real example found; see section 4)

- One regular expression per language family recognises import forms: JS/TS `from|import|require(` followed by a quoted string; Python `from … import …` and `import …`; Rust `crate|super|self::…` paths and `mod x;`; Go single and block `import`; JVM `import [static]`; C/C++ `#include "…"`; PHP `use` and `require`; Ruby `require_relative`.
- Resolution is heuristic. Aliases `~/`, `@/`, `#/` are guessed as `src/<rest>` then `<rest>`, without reading tsconfig. Scoped packages `@scope/name` are matched to a folder under `packages/`, `apps/` or `libs/`. Go imports are matched to any folder that ends the import path. C#, JVM, Swift and PHP files additionally get a link to any file whose name equals a capitalised word in the text ("languages that name a file after the type it declares"), with ambiguous names dropped.
- Comments are stripped only for the type-name heuristic (`/* */` and `//`); the import expressions run on raw text.

**Inference**

- Regex extraction gets most static imports right in conventional code and costs no dependency, but it cannot tell code from strings, comments or template literals, does not see multi-line forms it was not written for, and its resolution is a guess. GitDiagram uses it as *evidence offered to a model*, which can tolerate noise; a `declared` link shown to a learner as "the source states this" cannot.
- The type-name heuristic for C# is closer to `interpreted` than `declared`: a capitalised word matching a file name is a reconstruction, not a statement.

### 3. Language servers and compiler APIs

**Facts**

- **TypeScript 6 (JavaScript).** `typescript@6.0.3` is Apache-2.0, one 9.1 MB `lib/typescript.js`. On the fixture, `preProcessFile` plus `resolveModuleName` with the parsed tsconfig resolved `@/types` to `src/types/index.ts` through `paths`, resolved `export * from './lib/b'` and `import('./lib/b')`, left `react` unresolved (no `node_modules`), and **silently dropped** `` import(`./locale/${lang}`) ``. 9 ms for one file.
- **TypeScript 7 (the version this repo uses, 7.0.2)** is the native port: the `typescript` package depends on one `@typescript/typescript-<platform>` binary per platform (27.5 MB for darwin-arm64, 28.4 MB for win32-x64), and its programmatic API is exported only under `typescript/unstable/*`, talking to the binary over JSON-RPC (`vscode-jsonrpc` vendored). Its sync API exposes `parseConfigFile`, `getProjects`, symbols and types.
- **Roslyn / MSBuild.** Roslyn is MIT ([dotnet/roslyn](https://github.com/dotnet/roslyn)). Loading real projects goes through MSBuild, located at run time by `Microsoft.Build.Locator` "where Visual Studio is installed or … just the .NET SDK is installed"; MSBuild assemblies must not be redistributed with the app ([Find MSBuild and use its API](https://learn.microsoft.com/en-us/visualstudio/msbuild/find-and-use-msbuild-versions)).
- **LSP.** The 3.17 specification has `textDocument/documentLink` ("the location of links in a document") and call hierarchy requests, but no request defined to return a document's imports or module dependencies ([LSP 3.17](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)). Each language needs its own server process.

**Inference**

- A compiler is the only route that resolves correctly (tsconfig `paths`, `extends`, project references, package `exports`), but only for its own language and only with that language's toolchain. For TypeScript, `typescript@6.0.3` could be bundled (it is pure JavaScript; it would have to be aliased since the repo's dev dependency is `typescript@7.0.2`), at 9 MB for one language. For C#, Roslyn requires the learner to have the .NET SDK installed, and a .NET process beside Electron: out of proportion for a reading app.
- Language servers add process management, per-language installs and a protocol that does not ask the question we need. Not a fit.

### 4. GitDiagram and Gitingest

**GitDiagram** (MIT, read at commit [`c595d86`](https://github.com/ahmedkhaleel2004/gitdiagram/tree/c595d86f61b7c12491d7385c3b173def42b8e069))

- **The diagram comes from a model.** `docs/architecture.md`, "How generation works": the app fetches the default branch's recursive tree and README through the GitHub API, then "bounded, integrity-checked source excerpts"; one model request "streams a short architecture overview followed by a strict graph: groups, nodes, edges, shapes, labels, and repository paths"; the server validates the graph and "every linked path against the actual repository", and a "deterministic compiler converts the validated AST to Mermaid".
- **A deterministic index is fed to the model as evidence.** `src/server/generate/source-references.ts` computes "which repository files a source file imports or names, found by reading its whole text … This is the deterministic half of edge evidence", with the regular expressions described in section 2. The prompt (`prompts.ts`) tells the model that "<source_files> opens with a SOURCE INDEX computed by GitDiagram, not a model" and that "a relationship is supported only by an excerpted call, a SOURCE INDEX reference, or an explicit README statement". `edge-evidence.ts` drops citations of files the model was not shown and fills an uncited edge from the index when it supports it.
- **Clicks map to files through the model's paths.** Each node carries a repository `path` chosen by the model; `graph.ts` validates it against the tree (`missing_repository_path`), `stripUnknownGraphPaths` drops an unknown path instead of regenerating ("an unresolvable one is cosmetic"), and the compiler emits `click <node> "https://github.com/<user>/<repo>/<blob|tree>/<branch>/<path>"` for every node that kept a path. The link opens the file or folder on GitHub; there is no line locator.

**Gitingest** (MIT, read at commit [`4e259a0`](https://github.com/coderamp-labs/gitingest/tree/4e259a02fe72115bee538271622f1234a81c8e1a))

- **No parser and no model.** `ingestion.py` walks the cloned or local folder within limits (`config.py`: 10 MB per file, depth 20, 10,000 files, 500 MB total), applying include and exclude patterns. `output_formatter.py` returns a summary, a "Directory structure" tree and the concatenated file contents, plus a token estimate with `tiktoken` (`o200k_base`). Nothing in it reads imports.

### 5. Known limits by case

| Case | tree-sitter query | Regex | Compiler (TS 6) | Note |
|---|---|---|---|---|
| Static import / `using` / `use` | yes, with line | mostly | yes | |
| Re-export `export * from` | yes (measured) | yes (via `from`) | yes (measured) | the link points to a barrel, not the defining file, unless followed |
| Dynamic import, literal | yes (measured) | yes | yes (measured) | |
| Dynamic import, computed (`` `./x/${y}` ``, `importlib.import_module(name)`) | the call is seen, the target is not | no | dropped silently (measured) | not declared by the source; at most "a dynamic load happens here" |
| tsconfig `paths` alias | string only | guessed (`src/`) | resolved (measured) | needs tsconfig read (JSONC, `extends`) |
| .NET `services.AddScoped<IRepo, SqlRepo>()` | type names captured (measured) | no | n/a | name to file needs a definition index; ambiguous names must be dropped |
| .NET `AddSingleton(typeof(I), typeof(C))`, factory lambdas, `services.AddInfrastructure()`, assembly scanning | not captured by a generic query (measured for `typeof`) | no | n/a | registration lives in another method or is computed at run time |
| `.csproj` `<ProjectReference Include="…">` | no XML grammar among the seven | reliable on plain XML | n/a (MSBuild) | `Directory.Build.props`, conditions and imports can add or remove references |
| `package.json` `workspaces`, tsconfig `references` | n/a | n/a | n/a | JSON with globs: read and validate, no parser needed |
| Go import of the repository's own package | string only | folder-suffix guess | n/a | exact resolution needs `go.mod`'s `module` line |
| Python absolute import | dotted name only | path-suffix guess | n/a | depends on `sys.path`, `src/` layouts, namespace packages |

## Comparison

| Route | Languages | Accuracy of extraction | Resolution to a file | Size added | Licence | Electron main, macOS arm64 / Windows x64, no native build |
|---|---|---|---|---|---|---|
| `web-tree-sitter` + grammar `.wasm` | any with a grammar; 7 checked | syntactic, exact, with line | ours to write per language | 0.2 MB runtime + 0.2 to 5.4 MB per grammar (about 11 MB for the 7) | MIT | yes on macOS arm64 (measured); Windows by inference |
| Native `tree-sitter` | same | same, faster | ours to write | about 0.5 MB runtime + up to 2.9 MB per grammar, per platform | MIT | loads on macOS arm64 without rebuild (measured), but breaks the "no `node_modules`" packaging |
| Per-language regex | any, by hand | approximate; fooled by strings and comments | heuristic | none | ours | yes |
| TypeScript 6 compiler API | TS/JS only | exact | exact (tsconfig, `paths`) | 9.1 MB | Apache-2.0 | yes (pure JS); not measured in Electron |
| TypeScript 7 API | TS/JS only | exact | exact | 27 to 28 MB native binary per platform, API `unstable` | Apache-2.0 | native binary per platform |
| Roslyn / MSBuild | C# | exact, semantic | exact | needs the learner's .NET SDK | MIT | no: separate .NET process and installed SDK |
| Language servers | one per server | depends | depends | a server per language | varies | no: external processes, no "imports" request |
| GitDiagram | any | LLM graph, regex evidence | regex heuristics + model | n/a | MIT | n/a (web service) |
| Gitingest | any | none (concatenation) | none | n/a | MIT | n/a (Python) |

## Recommendation (inference)

1. **Extract with `web-tree-sitter`, in a worker thread of the main process.** One runtime, a `.wasm` per language as data, our own import query per language, every capture carrying `file:line`, which is exactly the locator #58 asks for. It keeps the packaging as it is and the renderer untouched.
2. **Resolve with small, explicit per-language rules, and declare only what resolves.** Relative paths, tsconfig `baseUrl`/`paths`/`extends`, `go.mod` `module`, Python package folders, Rust `mod`/`crate::`. A specifier that does not resolve to exactly one file of the repository stays unresolved (an external package or an unknown), never a guessed link: GitDiagram's suffix and type-name heuristics are acceptable as model evidence, not as `declared`.
3. **Read manifests as data, not code.** `package.json` `workspaces`, tsconfig `references`, `.csproj` `ProjectReference`, `go.mod`: parse and validate with Zod where they enter, like any untrusted input.
4. **Treat DI as a later, narrower step.** A literal generic registration (`AddScoped<IRepo, SqlRepo>()`) states a relation in its own line and can be `declared` once the type names resolve to one definition each; extension methods, `typeof`, factories and scanning stay out, or go to `interpreted`.
5. **First languages:** TypeScript/JavaScript (resolution rules known, measured here), then Python and Go (small grammars, simple rules), C# last (5.4 MB grammar, resolution by namespace and type, DI). This feeds the open map question "which languages get declared links first".
6. **Do not adopt TypeScript 7's API or Roslyn** for this; revisit `typescript@6.0.3` only if tsconfig resolution by hand proves wrong on real fixtures.

## Unverified and open

- Windows x64: neither route was run there. The packaged-app smoke check (`BTW_SMOKE_TEST=1`) on the Windows CI runner would be the witness.
- The Electron run used `ELECTRON_RUN_AS_NODE=1` (same V8 and Node as the main process) rather than the real main process inside a packaged `app.asar`; loading `.wasm` from inside the archive by bytes was not exercised.
- Throughput was measured on one 800 KB repository; large repositories and the C# grammar's speed were not measured.
- The `.wasm` files were taken from the npm packages as published; whether every future grammar release keeps a loadable `.wasm` (the README's dynamic-linking warning) needs a check per version bump.

## Sources

- `web-tree-sitter` 0.27.2 tarball: `README.md`, `web-tree-sitter.d.ts`, `package.json` ([npm](https://www.npmjs.com/package/web-tree-sitter), [source](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web)).
- `tree-sitter` 0.25.1 tarball: `binding.gyp`, `prebuilds/` ([npm](https://www.npmjs.com/package/tree-sitter), [source](https://github.com/tree-sitter/node-tree-sitter)).
- Grammar tarballs on npm: `tree-sitter-typescript` 0.23.2, `tree-sitter-javascript` 0.25.0, `tree-sitter-python` 0.25.0, `tree-sitter-c-sharp` 0.23.5, `tree-sitter-java` 0.23.5, `tree-sitter-go` 0.25.0, `tree-sitter-rust` 0.24.0 (`.wasm`, `queries/tags.scm`, `prebuilds/`, licence field).
- `typescript` 6.0.3 and 7.0.2 on npm: `package.json` exports, `dist/api/sync/api.d.ts`, platform package sizes.
- GitDiagram at [`c595d86`](https://github.com/ahmedkhaleel2004/gitdiagram/tree/c595d86f61b7c12491d7385c3b173def42b8e069): [`docs/architecture.md`](https://github.com/ahmedkhaleel2004/gitdiagram/blob/c595d86f61b7c12491d7385c3b173def42b8e069/docs/architecture.md), [`src/server/generate/source-references.ts`](https://github.com/ahmedkhaleel2004/gitdiagram/blob/c595d86f61b7c12491d7385c3b173def42b8e069/src/server/generate/source-references.ts), [`prompts.ts`](https://github.com/ahmedkhaleel2004/gitdiagram/blob/c595d86f61b7c12491d7385c3b173def42b8e069/src/server/generate/prompts.ts), [`graph.ts`](https://github.com/ahmedkhaleel2004/gitdiagram/blob/c595d86f61b7c12491d7385c3b173def42b8e069/src/server/generate/graph.ts), [`edge-evidence.ts`](https://github.com/ahmedkhaleel2004/gitdiagram/blob/c595d86f61b7c12491d7385c3b173def42b8e069/src/server/generate/edge-evidence.ts), [`source-excerpt.ts`](https://github.com/ahmedkhaleel2004/gitdiagram/blob/c595d86f61b7c12491d7385c3b173def42b8e069/src/server/generate/source-excerpt.ts).
- Gitingest at [`4e259a0`](https://github.com/coderamp-labs/gitingest/tree/4e259a02fe72115bee538271622f1234a81c8e1a): [`ingestion.py`](https://github.com/coderamp-labs/gitingest/blob/4e259a02fe72115bee538271622f1234a81c8e1a/src/gitingest/ingestion.py), [`output_formatter.py`](https://github.com/coderamp-labs/gitingest/blob/4e259a02fe72115bee538271622f1234a81c8e1a/src/gitingest/output_formatter.py), [`config.py`](https://github.com/coderamp-labs/gitingest/blob/4e259a02fe72115bee538271622f1234a81c8e1a/src/gitingest/config.py).
- [Find MSBuild and use its API](https://learn.microsoft.com/en-us/visualstudio/msbuild/find-and-use-msbuild-versions) (Microsoft Learn); [dotnet/roslyn](https://github.com/dotnet/roslyn) licence.
- [Language Server Protocol 3.17 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/).
- [Electron performance guide](https://www.electronjs.org/docs/latest/tutorial/performance).
- This repository: `src/core/exploration.ts` (`LINK_BASES`), `scripts/package-common.mjs`, `scripts/build-desktop.mjs`, `src/desktop/AGENTS.md`, `package.json`.
