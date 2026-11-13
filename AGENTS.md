# BreakTheWall agent guide

## Stack

- **Language / Runtime**: TypeScript 7 (strict), Node 22.23.2
- **Framework**: React 19 renderer in an Electron 45 host; Vite 8 for the renderer, esbuild for main, preload and the MCP server
- **Key dependencies**: Zod 4 (runtime validation), markdown-it, Mermaid, lucide-react; Vitest 5 with jsdom and Testing Library
- **Package manager**: npm 10.9.8, exact versions (`save-exact`), `package-lock.json`

## Build approach

**Skateboard**, ship the smallest usable whole first, then grow it release by release, each release shippable.

## Rules

- A change in behavior comes with a test that fails without it. Tests live flat in `tests/` as `*.test.ts(x)` (Vitest, jsdom).
- Untrusted data (sources, saved files, model output, anything crossing IPC or the local socket) is parsed with Zod where it enters; TypeScript types alone are not a check.
- The renderer has no Node, filesystem or network access. New desktop operations go through a named, validated IPC call in `src/desktop/preload.ts`; the production content policy is not loosened.
- Every interface string exists in Italian and English; both catalogs change together.
- Dependencies are added only when needed, at an exact version, with the reason in the pull request.
- Code, comments and documentation are in English; comments explain why, not what.

## Git

- integration: off

## Workflow

Work in this repository follows the `jsmastery-pro/skills` set (owner, 2026-11-13), installed under `.agents/skills/` and pinned in `skills-lock.json`:

`/scope` → `/architect` → `/develop` → `/check verify` · `/test` → `/sync`, with `/debug` for a bug's root cause, `/document` for pull requests, changelogs and release notes, and `/audit` for these conventions.

- The scope lives in [docs/scope/scope.md](docs/scope/scope.md): features, releases, status and the next step of each feature. Specs live in `docs/specs/`, written by `/architect`.
- Rigor follows the scope header (Skateboard, workflow Alpha) unless a feature carries its own tier tag.
- project-workflow is retired here. Do not route work to `/project-workflow:*`. Its research and plans under [docs/workflow/](docs/workflow/README.md) and [STATUS.md](STATUS.md) are frozen history: read them for evidence, never extend them.

## Repository constraints

- Product identity (revised by the owner on 2026-11-05): BreakTheWall takes a source apart into source-linked parts and lets the learner explore how it holds together. **Exploration is the core**: the app reads the source's structure (parts, links with a declared or interpreted basis, the source's own questions), chooses the way in from that shape, and shows one view with three roles (guide, structure, source) on one shared state. Run (putting a link under load) and reassemble are later additions, not the current loop. It is not a course, chatbot, summarizer, memorization or gamified study app; review is opt-in. One loop for every subject: never choose the way in from a genre or a subject, and never add subject-specific modes. Never connect what the source does not connect. Judge new features against this. First readers (owner, 2026-11-10): developers who read technical text written or explained by AI; they choose which examples and demos come first, never a mode ([first readers](docs/product.md#identity)). Source: [product definition](docs/product.md#identity).
- Product boundary: BreakTheWall supports general subjects as well as code. Sources may be user supplied or retrieved with AI assistance. Preserve this distinction when designing contracts and UI. Source: [product definition](docs/product.md).
- Current owners: `src/core` owns shell-independent lesson validation/state (including, from plan P-20261105-exploration, the structure contract, the detector, the source index and the reading report), `src/fixtures` owns original prepared content, `src/renderer` owns React UI, `src/desktop` owns Electron access, and `src/mcp` owns the MCP server for AI assistants (Node only, no Electron or React). Documentation lives under `docs/`; the scope lives under `docs/scope/` and specs under `docs/specs/`; `docs/workflow/` holds the frozen evidence of the earlier workflow.
- Build and test runners: npm with `package-lock.json`. Use `npm run check` for TypeScript and Vitest, `npm run build` for production bundles, `npm start` for the local production desktop, and `npm run dev` for development. See [development](docs/development.md).
- Technical direction: TypeScript/React and Electron are established in T1. Exact versions are pinned in `package.json`; domain code must remain independent of React/Electron. `npm run package` builds an ad-hoc signed DMG for Apple Silicon (plan P-20261027-macos-dmg) and `npm run package:win` an unsigned Squirrel setup for Windows x64 (plan P-20261027-windows-alpha); CI checks both systems. `src/mcp` is a hand-written MCP server for Claude Desktop and Claude Code (plan P-20261028-mcp-integration). It reaches the app only through the local entry point in `src/desktop/incoming.ts`, which is off unless the learner turns it on. There is no Developer ID or Windows code signing, notarization or updater.
- External dependencies: no credentials or AI services are configured by this foundation. Provider documentation review is not proof of account access or a successful inference. Source: [foundation evidence](docs/workflow/research/R-20261021-foundation.md).
- Frozen file: `STATUS.md` was generated by project-workflow and is no longer regenerated (frozen on 2026-11-13). Current status lives in the scope.
- License: Apache-2.0, chosen by the owner on 2026-10-27 ([LICENSE](LICENSE), [NOTICE](NOTICE)). Contributions are accepted under its section 5; there is no separate CLA.
- Publication boundary: the remote repository is public. Use original or suitably licensed fixtures. Earlier private code excerpts and local source snapshots are outside this repository's content scope. Source: [README](README.md) and foundation evidence.

## Open questions

- Can the selected provider/account complete the required structured generation through the documented authentication route? This needs a witnessed integration check.
- Which retrieval route will support the later AI-assisted source-discovery mode? Do not show this mode as working before it is implemented and checked.

## Context files

- [src/desktop/AGENTS.md](src/desktop/AGENTS.md) (Electron host: named IPC with sender check, credentials, local entry point)
- [src/mcp/AGENTS.md](src/mcp/AGENTS.md) (hand written MCP server, Node only, prompt argument gotcha)
- [src/renderer/AGENTS.md](src/renderer/AGENTS.md) (React UI: paired Italian and English catalogs, no HTML from content)
