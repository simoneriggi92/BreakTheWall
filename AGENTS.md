# BreakTheWall workflow adapter

This repository uses the `project-workflow` skills for research → plan → review → approve → implement → verify → archive. Every workflow skill reads this adapter and the plugin's shared workflow contract. Keep this adapter specific to this repository.

## Repository constraints

- Product identity: BreakTheWall takes material apart into source-linked parts, lets the learner run the mechanism, and asks them to reassemble it (disassemble → run → reassemble). It is not a course, chatbot, summarizer, memorization or gamified study app; review is opt-in. One loop for every subject: only the kind of joint changes (mechanism, argument, story), and "run" always means the learner puts a joint under load. Do not add subject-specific modes. Judge new features against this. Source: [product definition](docs/product.md#identity).
- Product boundary: BreakTheWall supports general subjects as well as code. Sources may be user supplied or retrieved with AI assistance. Preserve this distinction when designing contracts and UI. Source: [product definition](docs/product.md).
- Current owners: `src/core` owns shell-independent lesson validation/state, `src/fixtures` owns original prepared content, `src/renderer` owns React UI, and `src/desktop` owns Electron access. Documentation lives under `docs/`; workflow evidence lives under `docs/workflow/`.
- Build and test runners: npm with `package-lock.json`. Use `npm run check` for TypeScript and Vitest, `npm run build` for production bundles, `npm start` for the local production desktop, and `npm run dev` for development. See [development](docs/development.md).
- Technical direction: TypeScript/React and Electron are established in T1. Exact versions are pinned in `package.json`; domain code must remain independent of React/Electron. `npm run package` builds an ad-hoc signed DMG for Apple Silicon (plan P-20261027-macos-dmg) and `npm run package:win` an unsigned Squirrel setup for Windows x64 (plan P-20261027-windows-alpha); CI checks both systems. There is no Developer ID or Windows code signing, notarization or updater.
- External dependencies: no credentials or AI services are configured by this foundation. Provider documentation review is not proof of account access or a successful inference. Source: [foundation evidence](docs/workflow/research/R-20261021-foundation.md).
- Generated file: `STATUS.md` is derived from plan front matter by the project-workflow status generator. Edit the plan, then regenerate status.
- License: Apache-2.0, chosen by the owner on 2026-10-27 ([LICENSE](LICENSE), [NOTICE](NOTICE)). Contributions are accepted under its section 5; there is no separate CLA.
- Publication boundary: the remote repository is public. Use original or suitably licensed fixtures. Earlier private code excerpts and local source snapshots are outside this repository's content scope. Source: [README](README.md) and foundation evidence.

## Open questions

- Can the selected provider/account complete the required structured generation through the documented authentication route? This needs a witnessed integration check.
- Which retrieval route will support the later AI-assisted source-discovery mode? Do not show this mode as working before it is implemented and checked.
