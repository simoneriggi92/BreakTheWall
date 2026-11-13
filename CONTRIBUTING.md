# Contributing to Break the Wall

Thank you for your interest. Break the Wall is an alpha, and contributions of every size help: a bug report, a translation fix, a new prepared exploration, a layout improvement, or a step on the [roadmap](README.md#roadmap).

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Questions and ideas are welcome in [Discussions](https://github.com/simoneriggi92/BreakTheWall/discussions); security problems go to the private channel in [SECURITY.md](SECURITY.md).

## What the project is, and is not

Break the Wall reads the structure of a source and lets the learner explore how it holds together: its aspects, its roles and their components, the links the source states (each with its basis), and the questions the source walks, every one tied to its lines. **Exploring is the core**; running a link under load and reassembling come later. It is not a course, a chatbot, a summarizer or a flashcard app, and review is opt-in. There is one loop for every subject: the way in is chosen from the source's shape, never from its genre.

Please judge a proposal against this before writing code. Subject-specific modes and features that turn the app into a study tracker will be declined. The [product definition](docs/product.md) explains the reasoning.

## Ways to contribute

- **Report a bug.** Open an issue with what you did, what you expected and what happened, your macOS and Node versions, and a screenshot when it is visual. Never attach private documents or credentials.
- **Suggest an improvement.** Open an issue first for anything larger than a small fix, so we can agree on the approach before you spend time on it.
- **Improve the interface text.** Every string exists in Italian and English (`src/renderer/i18n/it.ts` and `en.ts`); both catalogs must change together.
- **Write a prepared exploration.** Prepared explorations live in `src/fixtures/explorations/`, one file per language. Their sources must be original or in the public domain, and the file must pass the exploration checks (`npm run check` validates every fixture). Prepared disassemblies in `src/fixtures/disassemblies/` stay welcome too.
- **Pick up a roadmap item.** Repositories as a source are the next large step, laid out in [the scope](docs/scope/scope.md). Start a thread in [Discussions](https://github.com/simoneriggi92/BreakTheWall/discussions) before writing code, so the work fits the scope.

## Set up

Requirements: macOS, Node.js 22.23.2 and npm 10.9.8 (pinned in `package.json`).

```bash
npm ci
npm run dev       # Vite + Electron with reload
npm run dev:web   # renderer only, in a browser (no generation)
```

The prepared explorations and disassemblies work without any account. To explore your own sources you need a ChatGPT account with plan usage (experimental route), or Claude Desktop or Claude Code through the app's MCP server; a local model server such as llama.cpp, LM Studio or Ollama can generate disassemblies. See [Local development](docs/development.md).

## Before you open a pull request

```bash
npm run check     # strict TypeScript and every test
npm run build     # production bundles
```

Both must pass. In addition:

- **Tests.** A change in behavior comes with a test that fails without it. Interface changes are tested in both interface languages where wording matters.
- **Boundaries.** `src/core` stays independent of React and Electron. The renderer has no Node, filesystem or network access: new desktop operations go through a named, validated IPC call in `src/desktop/preload.ts`. The production content policy is not loosened.
- **Dependencies.** Add one only when it is needed, at an exact version (`save-exact` is set), and say why in the pull request.
- **Public content only.** The repository is public. Never commit credentials, private documents, private code, or text you do not have the right to publish. Evaluation cases that are private stay in the ignored `.local/` folder.
- **Language.** Code, comments and documentation are written in English. Comments explain why, not what.

Small fixes can go straight to a pull request against `main`. Describe what changed and how you checked it.

## Larger changes: scope → spec → build

Larger changes follow the workflow described in [AGENTS.md](AGENTS.md#workflow):

1. **Scope** ([docs/scope/scope.md](docs/scope/scope.md)): the feature, its release, and when it is done.
2. **Spec** (`docs/specs/`): the decision and its acceptance criteria, written before building when the feature has a real choice to make.
3. **Build** against the spec, then **verify** it on the real app, and **test** it when the feature asks for it.
4. **Sync**: the conventions the change settled go back into `AGENTS.md`.

You do not need to write the spec yourself to propose a large change: open an issue, and we can write it together. The earlier research and plans in [docs/workflow/](docs/workflow/README.md) are kept as history.

## Licensing of contributions

Break the Wall is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution you agree that it is licensed under the same terms, as set out in section 5 of the license. There is no separate contributor agreement.
