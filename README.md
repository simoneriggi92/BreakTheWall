# BreakTheWall

Turn sources and questions into visual, interactive learning journeys.

BreakTheWall is a desktop learning app in development. Its intended scope covers any subject that can be explained from suitable sources: programming, engineering, science, and other complex topics. Code exploration is one use case.

**Material or question → sources → explanations in several forms → your response → feedback.**

The experience combines deliberately paced pages, concept maps, controlled sequences, short concept lenses, source excerpts, and activities. The representation should fit the concept. A learning journey should help someone explain a relationship, apply it, and recognize its limits.

## Current state

The `player` phase is in progress. A minimal Electron desktop shell launches on macOS, and runtime-validated lesson/source/state contracts have focused tests. Two original prepared lesson packages are authored; their complete visual player and interaction checks are still being implemented. This checkpoint is not a completed learning application.

An earlier interactive prototype informed the experience. Its private source material is not distributed here. User-reported usefulness is an early signal, not evidence of general learning effectiveness or market demand.

## Start here

- [Product definition](docs/product.md): goals, experience, source modes, and scope.
- [Proposed architecture](docs/architecture.md): components, boundaries, and technical direction.
- [Foundation evidence](docs/workflow/research/R-20261021-foundation.md): observations, assumptions, and documentation references.
- [First learning loop plan](docs/workflow/plans/P-20261021-first-learning-loop/plan.md): tasks, acceptance criteria, and verification.
- [Workflow status](STATUS.md): generated implementation status. The plan also records work awaiting approval.
- [Agent instructions](AGENTS.md): repository-specific working constraints.

## Proposed first alpha

Import a small text source, describe a learning goal, generate a source-linked lesson, interact with it, and resume it after closing the app. Validate the same experience with one code topic and one topic without code.

The first alpha focuses on pasted text and UTF-8 text/Markdown files. AI-assisted web discovery is a planned source mode; PDF, audiovisual material, and whole-repository import require separate adapters. The product model must accommodate these without assuming every source is code.

The implementation uses TypeScript/React in a thin Electron desktop host, with the lesson model independent of both. Import and live AI generation are not implemented in the current player phase.

## Development and licensing

See [Local development](docs/development.md) for toolchain, commands, and runtime boundaries. Quick start: `npm ci`, `npm run build`, `npm start`. Development: `npm run dev`. Checks: `npm run check`. The first alpha targets macOS; other platforms require separate verification.

The intended distribution is open source. A license has not been selected or added; publishing source alone does not establish a license grant. Local storage is intended for lessons and progress; AI generation will require an eligible remote provider account and will send the selected source content to that provider.
