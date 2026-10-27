# Changelog

All notable changes to Break the Wall are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Until 1.0, an alpha may change its formats; saved disassemblies and progress are migrated or kept readable, never silently dropped.

## [Unreleased]

## [0.1.0-alpha] - 2026-10-27

The first public alpha. It runs from source on macOS; there is no installer yet.

### Disassemblies
- A disassembly format with typed joints for three kinds of material (mechanism, argument, story), sub-assemblies as deep as the source allows, and a bill of materials that accounts for every line of the source. The host checks every file before showing it.
- An automatic layout: mechanisms and stories flow left to right; arguments stack the claim above its grounds, with attacks and limits beside it. Part numbers follow the reading order.
- The player: exploded view with a part card (a short lead, then marked points), runs (scenarios with a prediction before each step, load tests that pull out one brick at a time, new cases), reassembly on a blank drawing, and the bill of materials.
- Resizable drawing, card and source panes; a way back to the level above with ↑, Escape or Alt+↑.
- Sources read as numbered lines or as a rendered document with tables and Mermaid diagrams, where citations highlight their blocks.
- Paper and blueprint themes, and an English and Italian interface. Progress, runs and notes resume after a restart.
- Two prepared examples, each in English and Italian: an original release runbook (mechanism) and Mill's harm principle (argument, public domain).

### Generation
- Studio takes apart pasted text or `.txt` / `.md` files around the learner's question, in three phases: structure with the bill of materials, one request per part with only its lines, then runs and reassembly hints. Each phase is checked and repaired at most once; a repair that leaves only over-long texts gets one small shorten request.
- Suggested break-downs on request: 3–5 questions with the kind and parts they would give.
- The top level is drawn while it is written, with each part's status.
- A failed or cancelled generation keeps what was accepted and can be resumed.
- Any part with enough lines can be taken apart further on demand, as a new revision of the disassembly.
- Two routes: Sign in with ChatGPT (experimental, uses the learner's plan), or a local model server on this Mac (llama.cpp, LM Studio, Ollama or an OpenAI-compatible server).
- `npm run eval` measures generation on fixed public cases.

### Earlier lessons
- Lessons generated before disassemblies stay readable, with their progress, under "Earlier paths".

[Unreleased]: https://github.com/simoneriggi92/BreakTheWall/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.1.0-alpha
