# Changelog

All notable changes to Break the Wall are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Until 1.0, an alpha may change its formats; saved disassemblies and progress are migrated or kept readable, never silently dropped.

## [Unreleased]

### Added
- **Use with Claude:** Break the Wall works with Claude Desktop and Claude Code through a local MCP server that ships inside the app. Connect it once from **Use with Claude** at the top of the library: one click adds the extension to Claude Desktop, and one command adds the server to Claude Code. You install nothing else.
  - **Open in Studio:** ask Claude to open a text in Break the Wall, and the app comes to the front with it and your question in Studio.
  - **Claude writes it:** Claude writes the disassembly itself, phase by phase, on your Claude plan. The app checks each phase with its own rules and saves the result as "Written by your assistant".
  - **The `break` prompt** explains a topic and has Claude take it apart; with no topic, it takes apart Claude's last long answer.
- **A switch for the connection:** "Connect AI assistants" is off by default. While it is on, the app listens on a socket in its data folder, or a per-user pipe on Windows; it imports texts like a paste and validates disassemblies like stored files.

## [0.2.0-alpha] - 2026-10-27

The first alpha for Windows, next to the Mac app.

### Added
- A Windows app for x64 PCs (Windows 10 or 11): an unsigned Squirrel setup, installed per user without administrator rights, with Start menu and desktop shortcuts. The README explains SmartScreen's "Run anyway" step and checking the checksum in PowerShell.
- Every pull request runs the checks and the start check on Windows too.

### Changed
- The interface names the right computer: "this PC" and Windows' credential protection on Windows, "this Mac" and the Keychain on macOS.

## [0.1.1-alpha] - 2026-10-27

The first alpha you can download: a Mac app for Apple Silicon, no Node.js needed.

### Added
- A downloadable app for Apple Silicon Macs (macOS 13 or later): `npm run package` builds an ad-hoc signed DMG with a SHA-256 checksum, after starting the packaged app to check that the library is drawn. The README explains the install and the Open Anyway step, since the app is not notarized.
- A Release workflow: a `v*` tag builds the DMG on an Apple Silicon runner and attaches it, with its checksum, to the tag's release.
- The app starts clean: only the two prepared examples, no account and nothing saved. Your data stays in `~/Library/Application Support/Break the Wall`, shared with a build run from source.

## [0.1.0-alpha] - 2026-10-27

The first public alpha. It runs from source on macOS; there is no installer yet.

### Identity
- A new identity: the name stays Break the Wall, with the tagline "Take the text apart." / "Smonta il testo." and a mark of four lines of text, one piece pulled out in terracotta and still linked to its place.
- The mark and tagline in the header of both themes, the home's new opening, and the app icon in the Dock. Paper and blueprint keep their colours; terracotta appears only in the logo.
- Brand assets in `docs/images/brand/`; `npm run brand` renders the app icon and the social card from them.

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

[Unreleased]: https://github.com/simoneriggi92/BreakTheWall/compare/v0.2.0-alpha...HEAD
[0.2.0-alpha]: https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.2.0-alpha
[0.1.1-alpha]: https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.1.1-alpha
[0.1.0-alpha]: https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.1.0-alpha
