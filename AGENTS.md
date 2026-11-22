# BreakTheWall agent guide

## Stack

- **Language / Runtime**: TypeScript 7 (strict), Node 22.23.2
- **Framework**: React 19 renderer in an Electron 45 host; Vite 8 for the renderer, esbuild for main, preload and the MCP server
- **Key dependencies**: Zod 4 (runtime validation), markdown-it, Mermaid, lucide-react; Vitest 5 with jsdom and Testing Library
- **Package manager**: npm 10.9.8, exact versions (`save-exact`), `package-lock.json`

## Rules

- A change in behavior comes with a test that fails without it. Tests live flat in `tests/` as `*.test.ts(x)` (Vitest, jsdom).
- Untrusted data (sources, saved files, model output, anything crossing IPC or the local socket) is parsed with Zod where it enters; TypeScript types alone are not a check.
- The renderer has no Node, filesystem or network access. New desktop operations go through a named, validated IPC call in `src/desktop/preload.ts`; the production content policy is not loosened. The one explicit exception: the local page built with `vite build --mode page` has `connect-src 'self'`, to reach its own local server (`src/server`) through the HTTP bridge with the per-launch secret; the Electron build keeps `connect-src 'none'`.
- Every interface string exists in Italian and English; both catalogs change together.
- Dependencies are added only when needed, at an exact version, with the reason in the pull request.
- Code, comments and documentation are in English; comments explain why, not what.

## Workflow

Work in this repository follows the `mattpocock/skills` set (owner, 2026-11-16), installed under `.agents/skills/` (linked from `.claude/skills/`) and pinned in `skills-lock.json`. `/ask-matt` routes to the right skill when unsure.

- **Main flow**: `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` per ticket (or `/implement-spec` for the whole spec) → `/code-review` → `/retro`. Code is built test-first through `/tdd`; a single-session change skips straight to `/implement`.
- **On-ramp**: bugs and outside requests arrive as GitHub issues and go through `/triage`; `/diagnosing-bugs` finds a bug's root cause.
- Specs and tickets live in GitHub Issues, not in repository files; see the Agent skills section below.
- Commit on a working branch: the current one when it is open for this ticket, otherwise a new one from `origin/main`.
- Retired workflows: project-workflow (`/project-workflow:*`) and the `jsmastery-pro/skills` scope pipeline. Do not route work to either. Their research, plans, scope and specs under [docs/workflow/](docs/workflow/README.md), and [STATUS.md](STATUS.md), are frozen history: read them for evidence, never extend them.

## Repository constraints

- Product identity (owner, 2026-11-20): two cores in one loop, in one local page launched from Claude Code. **Decide** is the way in (an agent's rounds answered one question at a time, a side chat anchored to one question, only the answers return); **understand** sets the product apart (the spec opens as a source and is explored; what the person notices opens the next round). The Electron app is frozen; chat is never the main surface. One loop for every subject: never a mode chosen from a genre or subject, never a link the source does not make. Judge new features against [the product definition](docs/product.md#identity), which holds the full identity and the first readers.
- Product boundary: BreakTheWall supports general subjects as well as code. Sources may be user supplied or retrieved with AI assistance. Preserve this distinction when designing contracts and UI. Source: [product definition](docs/product.md).
- Current owners: `src/core` owns shell-independent lesson validation/state (including, from plan P-20261105-exploration, the structure contract, the detector, the source index and the reading report), `src/fixtures` owns original prepared content, `src/renderer` owns React UI, `src/desktop` owns Electron access, `src/mcp` owns the MCP server for AI assistants (Node only, no Electron or React), `src/server` owns the local server and its launcher (Node only, no Electron or React), and `plugin/` holds the Claude Code plugin and its mod. Documentation lives under `docs/`; `docs/workflow/` holds the frozen evidence of the earlier workflows.
- Build and test runners: npm with `package-lock.json`. Use `npm run check` for TypeScript and Vitest, `npm run build` for production bundles, `npm run build:plugin` for the Claude Code plugin (then `claude --plugin-dir plugin`), `npm start` for the local production desktop, and `npm run dev` for development. See [development](docs/development.md).
- Technical direction: exact versions are pinned in `package.json`; domain code stays independent of React and Electron. The macOS DMG is ad-hoc signed and the Windows setup unsigned: there is no Developer ID, Windows code signing, notarization or updater.
- External dependencies: no credentials or AI services are configured by this foundation. Provider documentation review is not proof of account access or a successful inference. Source: [foundation evidence](docs/workflow/research/R-20261021-foundation.md).
- Frozen file: `STATUS.md` was generated by project-workflow and is no longer regenerated (frozen on 2026-11-13). Current work lives in [GitHub Issues](https://github.com/simoneriggi92/BreakTheWall/issues).
- License: Apache-2.0, chosen by the owner on 2026-10-27 ([LICENSE](LICENSE), [NOTICE](NOTICE)). Contributions are accepted under its section 5; there is no separate CLA.
- Publication boundary: the remote repository is public. Use original or suitably licensed fixtures. Earlier private code excerpts and local source snapshots are outside this repository's content scope. Source: [README](README.md) and foundation evidence.

## Open questions

- Can the selected provider/account complete the required structured generation through the documented authentication route? This needs a witnessed integration check.
- Which retrieval route will support the later AI-assisted source-discovery mode? Do not show this mode as working before it is implemented and checked.

## Context files

- [src/desktop/AGENTS.md](src/desktop/AGENTS.md) (Electron host: named IPC with sender check, credentials, local entry point)
- [src/server/AGENTS.md](src/server/AGENTS.md) (local server, lock file and launcher behind `/break-the-wall`)
- [plugin/AGENTS.md](plugin/AGENTS.md) (Claude Code plugin: the thin mod, its validator, mods API gotchas)
- [src/mcp/AGENTS.md](src/mcp/AGENTS.md) (hand written MCP server, Node only, prompt argument gotcha)
- [src/renderer/AGENTS.md](src/renderer/AGENTS.md) (React UI: paired Italian and English catalogs, no HTML from content)

## Agent skills

### Issue tracker

GitHub Issues on `simoneriggi92/BreakTheWall`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily by `/domain-modeling`. See `docs/agents/domain.md`.
