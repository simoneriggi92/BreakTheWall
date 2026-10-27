# Contributing to Break the Wall

Thank you for your interest. Break the Wall is an alpha, and contributions of every size help: a bug report, a translation fix, a new prepared disassembly, a layout improvement, or a step on the [roadmap](README.md#roadmap).

## What the project is, and is not

Break the Wall takes material apart into source-linked parts, lets the learner run the mechanism, and asks them to reassemble it: **disassemble → run → reassemble**. It is not a course, a chatbot, a summarizer or a flashcard app, and review is opt-in. There is one loop for every subject: only the kind of joint changes (mechanism, argument, story).

Please judge a proposal against this before writing code. Subject-specific modes and features that turn the app into a study tracker will be declined. The [product definition](docs/product.md) explains the reasoning.

## Ways to contribute

- **Report a bug.** Open an issue with what you did, what you expected and what happened, your macOS and Node versions, and a screenshot when it is visual. Never attach private documents or credentials.
- **Suggest an improvement.** Open an issue first for anything larger than a small fix, so we can agree on the approach before you spend time on it.
- **Improve the interface text.** Every string exists in Italian and English (`src/renderer/i18n/it.ts` and `en.ts`); both catalogs must change together.
- **Write a prepared disassembly.** Prepared examples live in `src/fixtures/disassemblies/`. Their sources must be original or in the public domain, and the file must pass the host checks (`npm run check` validates every fixture).
- **Pick up a roadmap item.** Repositories and PDF documents as sources are the next large steps; comment on the matching issue before starting.

## Set up

Requirements: macOS, Node.js 22.23.2 and npm 10.9.8 (pinned in `package.json`).

```bash
npm ci
npm run dev       # Vite + Electron with reload
npm run dev:web   # renderer only, in a browser (no generation)
```

The prepared disassemblies work without any account. To generate from your own sources you need either a ChatGPT account with plan usage (experimental route) or a local model server such as llama.cpp, LM Studio or Ollama. See [Local development](docs/development.md).

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

## Larger changes: research → plan → implement

Larger changes follow the workflow described in [AGENTS.md](AGENTS.md):

1. **Research** (`docs/workflow/research/`): the problem, the current code path, the constraints and the open questions, with evidence.
2. **Plan** (`docs/workflow/plans/`): ordered tasks with acceptance criteria, risks and the checks that will prove each task.
3. **Approval** by the maintainer, recorded in the plan.
4. **Implementation**, one phase at a time, with its evidence recorded in the plan.
5. **Verification**: every task is marked verified only with evidence; `STATUS.md` is generated from the plan.

You do not need to write the research and plan yourself to propose a large change: open an issue, and we can write them together.

## Licensing of contributions

Break the Wall is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution you agree that it is licensed under the same terms, as set out in section 5 of the license. There is no separate contributor agreement.
