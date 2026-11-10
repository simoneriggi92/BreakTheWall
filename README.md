<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/brand/wordmark-blueprint.svg">
    <img src="docs/images/brand/wordmark.svg" alt="Break the Wall" width="460">
  </picture>
</p>

<h1 align="center">Take the text apart.</h1>

<p align="center">AI gives you a wall of text. Break the Wall reads its structure and lets you explore how it holds together, down to its source lines.</p>

<p align="center"><strong>Open-source alpha · macOS · Windows · Works with Claude · English &amp; Italian · Apache-2.0</strong></p>

<p align="center">
  <a href="https://github.com/simoneriggi92/BreakTheWall/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/simoneriggi92/BreakTheWall/ci.yml?branch=main&amp;style=flat-square&amp;label=CI" alt="CI"></a>
  <a href="https://github.com/simoneriggi92/BreakTheWall/releases"><img src="https://img.shields.io/github/v/release/simoneriggi92/BreakTheWall?include_prereleases&amp;style=flat-square&amp;color=D96B4B" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%C2%B7%20Windows-102B46?style=flat-square" alt="Platform: macOS and Windows">
  <img src="https://img.shields.io/badge/interface-English%20%C2%B7%20Italiano-102B46?style=flat-square" alt="Interface: English and Italian">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-102B46?style=flat-square" alt="License: Apache-2.0"></a>
</p>

<p align="center"><a href="#try-the-alpha"><strong>Try the alpha</strong></a> · <a href="#how-it-works">How it works</a> · <a href="#roadmap">Roadmap</a> · <a href="CONTRIBUTING.md">Contribute</a></p>

<p align="center"><strong>1 · Explore a source</strong></p>

![Demo: the library opens on its explorations; the Larkspur importer opens at its aspect level; an aspect's card lists its roles and one opens the aspect in place, down to its roles; a joint label is clicked and its link card says the source declares it, with its lines lit in the source; the source's own question is followed step by step; the source is read line by line; "How it was read" shows coverage, basis and order; the theme switches from blueprint to paper; Mill's harm principle opens on its roles, layer by layer, its card explaining the selected role](docs/images/demo.gif)

<p align="center"><strong>2 · Claude writes the structure, Break the Wall checks it</strong> · <a href="#use-with-claude">Use with Claude</a></p>

![Demo with Claude: Use with Claude turned on in the app; in Claude Code the request is typed; Claude explains how a browser checks an HTTPS certificate and explores the explanation with Break the Wall; the app refuses the first structure because one role's text is three characters too long, and Claude fixes it; the exploration opens in the app marked as written by your assistant, with its roles, a role's card and a link's card](docs/images/claude.gif)

> [!NOTE]
> **Alpha.** [Download the app](#try-the-alpha) for Apple Silicon Macs or Windows x64 PCs, or run it from source. The prepared explorations work without an account. Exploring your own text or Markdown uses ChatGPT (experimental) or [Claude Desktop and Claude Code](#use-with-claude), which write the structure themselves. PDF documents and repositories as sources are on the [roadmap](#roadmap).

## Table of contents

- [Why Break the Wall?](#why-break-the-wall)
- [How it works](#how-it-works)
- [Try the alpha](#try-the-alpha)
- [Features](#features)
  - [The exploration](#the-exploration)
  - [How it was read](#how-it-was-read)
  - [Two themes, two languages](#two-themes-two-languages)
  - [Generation](#generation)
  - [Disassemblies (earlier loop)](#disassemblies-earlier-loop)
  - [Progress and privacy](#progress-and-privacy)
- [Use with Claude](#use-with-claude)
- [Local models](#local-models)
- [Tech stack](#tech-stack)
- [Project status](#project-status)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Community](#community)
- [License](#license)

## Why Break the Wall?

A useful AI explanation can still be a wall of text: correct-sounding, hard to retain and hard to check. Break the Wall reads how the text holds together and shows it as a structure you can explore:
- its large concerns;
- the roles inside each one, and the components each role names;
- the links between them, each saying whether the source states it or it was inferred;
- the questions the source itself walks.

Every block and every link points back to its source lines. The question is not only "can I read this?" but "can I explain how its parts work together?"

The idea comes from reverse engineering, which takes software apart with evidence for every finding so it can be understood and rebuilt. Break the Wall is not a course, a summarizer, a chatbot or a flashcard app. See the [product definition](docs/product.md).

| | A chat answer | Break the Wall |
|---|:---:|:---:|
| The whole by levels: aspects, then their roles, then each role's components | ❌ | ✅ |
| Links that say what they do, and whether the source states them or they were inferred | ❌ | ✅ |
| Every block, link and point linked to exact source lines | ❌ | ✅ |
| A way in chosen from the source's shape: its own question, or its premise and layers | ❌ | ✅ |
| "How it was read": how much of the source is in the map, and what was left out | ❌ | ✅ |
| Explorations kept on your computer, each with the source it came from | ❌ | ✅ |

> [!IMPORTANT]
> Source links are checked; explanations can still be wrong. The app checks that every cited line exists, that every link joins blocks that exist, and that an inferred link is marked as inferred. A wrong reading can still sit next to a correct citation, so read the highlighted lines, and look at "How it was read" before you trust the map.

## How it works

| Step | What happens |
|---|---|
| **Give a source** | Paste text or pick a `.txt` / `.md` file in Studio, or ask Claude to explore an explanation it wrote. A question is optional. |
| **The structure is read** | One request reads the whole source and returns its structure. The app checks every citation and every link before keeping it. |
| **The way in is chosen** | From the shape of what was read, never from the subject: the source's own question when it walks most of the mechanism, otherwise its premise and then its layers. |
| **Explore** | One view with three roles on one shared state: the guide, the structure and the source. Click a block, a link or a line, and the other two follow. |

The prepared explorations cover a technical document (the Larkspur importer), a release runbook (Atlas Reader) and an argument (Mill's harm principle). The same view works for any subject. Putting a link under load and reassembling the structure are later additions, not part of the current loop.

## Try the alpha

### Download for Mac

**Requirements:** a Mac with Apple Silicon (M1 or later) and macOS 13 Ventura or later.

1. Download `Break-the-Wall-<version>-arm64.dmg` from the [latest release](https://github.com/simoneriggi92/BreakTheWall/releases).
2. Open it and drag **Break the Wall** to **Applications**.
3. Open the app. The first time, macOS shows **“Break the Wall” Not Opened**: *Apple could not verify “Break the Wall” is free of malware that may harm your Mac or compromise your privacy.* The alpha is signed ad-hoc and not notarized by Apple, so this is expected.
   - Choose **Done**.
   - Open **System Settings → Privacy & Security**, scroll to **Security**, choose **Open Anyway** next to Break the Wall, and confirm with Touch ID or your password.
   - Open the app again and choose **Open Anyway** in the dialog.

   You do this once for each download.

To check the download, put the `.sha256` file from the release next to the DMG and run:

```bash
shasum -a 256 -c Break-the-Wall-<version>-arm64.dmg.sha256
```

The app starts clean: the prepared examples, no account and nothing saved. What you create stays on your Mac in `~/Library/Application Support/Break the Wall`, and ChatGPT credentials stay in your Keychain.

There are no automatic updates yet. To update, download the DMG of a newer release and replace the app; your data stays where it is. The ChatGPT sign-in does not carry over from a build run from source, and may not survive an update, because each version is signed ad-hoc. If Studio shows you signed out, sign in again.

### Download for Windows

**Requirements:** a 64-bit (x64) PC with Windows 10 or 11.

1. Download `Break-the-Wall-<version>-x64-setup.exe` from the [latest release](https://github.com/simoneriggi92/BreakTheWall/releases).
2. Run it. The alpha is not code-signed, so Windows SmartScreen shows **Windows protected your PC**. Choose **More info**, then **Run anyway**. You do this once for each download.
3. The setup installs Break the Wall for your user only, without administrator rights, adds it to the Start menu and the desktop, and opens it.

To check the download, put the `.sha256` file from the release next to the setup and run in PowerShell (it prints `True` when they match):

```powershell
(Get-FileHash .\Break-the-Wall-<version>-x64-setup.exe).Hash -eq (Get-Content .\Break-the-Wall-<version>-x64-setup.exe.sha256).Split(' ')[0]
```

The app starts clean, as on the Mac. What you create stays in `%APPDATA%\Break the Wall`, and ChatGPT credentials are encrypted by Windows for your user.
- **To update,** run the setup of a newer release; your data stays.
- **To uninstall,** open **Settings → Apps → Installed apps**, find **Break the Wall** and choose **Uninstall**. The app and its shortcuts go; your data folder stays until you delete it.

### Run from source

For an Intel Mac, or to change the code. **Requirements:** macOS or Windows, Node.js 22.23.2 and npm 10.9.8 (pinned in `package.json`).

```bash
git clone https://github.com/simoneriggi92/BreakTheWall.git
cd BreakTheWall
npm ci
npm run build
npm start
```

The first `npm start` downloads Electron's binary for your computer. Open a prepared exploration to try it without an account. To explore your own material, choose **Take apart a source**, paste text or pick a `.txt` / `.md` file, and press **Explore the source**. This needs a ChatGPT sign-in, or ask [Claude](#use-with-claude) instead.

**Development**

```bash
npm run dev       # Vite + Electron with reload
npm run check     # strict TypeScript + Vitest
npm run dev:web   # renderer only, in a browser (no generation)
npm run eval      # measure generation on fixed cases (see Local development)
npm run brand     # render the app icon and the social card from docs/images/brand
npm run package   # build the Apple Silicon DMG into release/
```

Set `BTW_USER_DATA_DIR` to an absolute path to keep test data separate from your own. More details are in [Local development](docs/development.md), with links to the [product](docs/product.md), [architecture](docs/architecture.md), [plans](docs/workflow/plans/), [status](STATUS.md) and [changelog](CHANGELOG.md).

## Features

### The exploration

![The Larkspur importer explored in the paper theme: the index of the source with its legend on the left; in the middle the premise and the aspect "Who reads the signals and acts", with its lit joints, and its card listing its two roles; the source on the right with the aspect's lines highlighted](docs/images/exploration-importer-paper.png)

- **Levels of abstraction:**
  - when the source names large concerns, the view opens on its **aspects** (two to four), each with its own hue at every level;
  - an aspect opens **in place**, down to its roles, while the rest of the whole stays where it was;
  - a **role** lists the components the source names (classes, services, settings, files), each with what it does and its lines;
  - with no aspects, the view opens on the roles.
- **Joints and their labels:**
  - each joint says what it does, with an arrow the way it runs;
  - pointing at a label marks "who" and "to whom", and choosing a block lights its joints;
  - a label can be dragged out of the way, or moved with the arrow keys;
  - clicking a label opens the **link's card**: its ends, whether the source declares it or it was inferred, and its lines.
- **The card** explains only what is selected, and repeats nothing already on screen:
  - an aspect's card gives its roles;
  - a role's card gives what it does for the whole and its points, marked → (then), = (stays the same) or ⚠ (caution);
  - a component's card gives what it does and its role.
- **Two guides:**
  - **The whole source** starts from the source's premise, then goes layer by layer;
  - **A question of the source** follows a question the source itself walks, lighting the blocks each step touches.

  The guide waits on its step while you explore, and "Back to the step" returns to it.
- **The source:**
  - shown rendered (**Document**) or line by line (**Lines**);
  - each gutter is coloured by the block that cites it, and a click on a line opens that block;
  - a leader line joins the card to its first highlighted line.
- **The index:** the source's own sections in order, with a dot for each block that cites a section, filled once the guide has shown it, and a legend for every sign.
- **Room to read:** the separators between the index, the structure, the card and the source resize them with the pointer or the keyboard. The index and the source fold to a rail, and sizes are remembered on this device.
- **Set apart:** references and pieces outside the mechanism sit in a band at the foot of the structure, never in the middle of it.

### How it was read

One button replaces the three columns with the reading report, built by the app from what it kept:
- **Coverage:** how many lines of the source are in the map, and a grid with a verdict for every line.
- **Shape:** how many aspects, roles, components, prerequisites and annotations.
- **Basis:** how many links the source states, and how many were inferred.
- **Way in:** why the guide starts where it does.
- **Order:** how far the logic follows the source's chapters.

A cell opens its line, and an inferred link opens its card.

### Two themes, two languages

- **Paper** (light) and **blueprint** (dark), following the system or chosen in the header. Every text color reaches WCAG AA in both themes, checked by a test.
- **English and Italian** interface, following the system or chosen in the header. Content keeps its own language and is never translated by the app. The prepared explorations exist in both languages.

### Generation

Studio explores pasted text or a `.txt` / `.md` file, up to 52,000 characters, in **one request**:
- The answer is checked by the app: citations, links, kinds, lengths and the structure's own rules.
- It can be repaired once with the app's findings. Texts a few characters too long are shortened by one small request.
- Nothing is saved unless the whole of it passes.
- A question is optional: the exploration reads the whole source either way.

| Route | Account | Where your source goes | Status for explorations |
|---|---|---|---|
| **ChatGPT** | Sign in with ChatGPT; uses your plan | OpenAI, over the documented Responses API | Experimental. Witnessed in the app on a public source: one request, valid without repair, about two minutes |
| **Your Claude assistant** | your Claude Desktop or Claude Code | Anthropic, through your Claude app ([Use with Claude](#use-with-claude)) | Experimental. Witnessed in Claude Code: one finding sent back and fixed, saved and opened |
| **Local model** | none | a server on `127.0.0.1` on your computer | Not offered for explorations yet: it has not passed the quality check |

### Disassemblies (earlier loop)

Before explorations, Break the Wall took a source apart into a **disassembly**: an exploded view of 3–7 parts per level, scenarios to predict, load tests that remove one premise at a time, a blank drawing to reassemble, and a bill of materials. Disassemblies you already have still open, with their progress. Studio can still generate one ("Generate a disassembly instead"), and three prepared disassemblies are in the library. Running and reassembling will come back, redesigned around the exploration.

Lessons created before disassemblies stay readable, with their progress, under "Earlier paths".

### Progress and privacy

- **Storage:** explorations, disassemblies, lessons, progress and notes stay on your device, written atomically. Progress that no longer matches its disassembly is kept on disk and the session restarts, with a notice.
- **Credentials:** ChatGPT tokens are encrypted with Electron `safeStorage` (the Keychain on macOS, the system's data protection on Windows) and never reach the interface or the logs.
- **Isolation:** the renderer has no Node, filesystem or network access. Every desktop operation goes through narrow, validated IPC calls.
- **Local entry point for assistants:** only while **Connect AI assistants** is on, the app listens on a socket in its data folder (readable only by you) or, on Windows, a named pipe. A text arriving there is imported like a paste. An exploration or a disassembly arriving there is checked with the same rules as the app's own generations, and accepted only as a new one written by an assistant.

## Use with Claude

Break the Wall works with **Claude Desktop** and **Claude Code** through a local MCP server that ships inside the app. You install nothing else.

The second demo at the top of this page comes from a real run in Claude Code (2.1.319, Sonnet), on 2026-11-09:
- **The run:** 7 turns, 67 seconds, about $0.29 on the user's plan.
- **One refusal:** the app refused the first structure, because one role's text had 113 characters for a limit of 110. Claude fixed it, and the second was accepted.
- **How the GIF is made:** the terminal is redrawn from the run's transcript, with each result summarized. The app frames show the exploration Claude wrote in that run.

There are two ways to use it:

| | You ask Claude | What happens | Who writes the structure |
|---|---|---|---|
| **Claude explores it** | "Explain how a browser checks an HTTPS certificate, then explore your explanation with Break the Wall" | Claude reads the source and writes its structure: aspects, roles and components, links with their basis, the source's questions. The app checks it with the same rules it uses for its own generations and returns findings for Claude to fix, once | Claude, on your Claude plan. The result opens in the library as "Written by your assistant" |
| **Open in Studio** | "Explain how a browser checks an HTTPS certificate and open it in Break the Wall" | The app comes to the front with Claude's text in Studio | Break the Wall, with the route you choose, when you press **Explore the source** |

**Connect it once.** In the app, open **Use with Claude** at the top of the library:
1. Turn on **Connect AI assistants**. While it is off, Break the Wall accepts nothing from other apps.
2. **Claude Desktop:** press **Add to Claude Desktop**. Claude Desktop opens and asks to install the Break the Wall extension.
3. **Claude Code:** press **Copy command** and run it once in a terminal. It adds the server for every project, using the app's own runtime:

   ```bash
   claude mcp add --scope user break-the-wall -e ELECTRON_RUN_AS_NODE=1 -- "<the app>" "<its MCP server>"
   ```

**The `break` prompt.** It explains your topic and has Claude explore the explanation with Break the Wall, in one step.
- *Claude Desktop:* pick it among the conversation's attachments and type your topic in its field.
- *Claude Code:* type `/break-the-wall:break`. Claude Code passes on only the first word after a prompt's name, so Claude asks for your topic. With nothing to ask, it explores Claude's last long answer.

> [!NOTE]
> **What leaves your computer.**
> - *Claude explores it:* your source goes to Anthropic, through your own Claude app and on your plan, because Claude is the one writing.
> - *Open in Studio:* the text is written by Claude, in your Claude conversation, and reaches the app over a local socket. Nothing more leaves the computer until you press **Explore the source**, and then only to the route you choose.
>
> Either way, Break the Wall itself sends nothing to Claude.

**Limits.**
- **Supported clients:** Claude Desktop and Claude Code. ChatGPT cannot reach a server on your computer: it needs a remote server, which would take your sources off the device, so it is not supported.
- **After updating the app:** add the extension to Claude Desktop again. On Windows, copy the Claude Code command again too, since it names the app's version folder.
- **Disassemblies:** Claude can still write one if you ask for a disassembly with runs (`start_disassembly`).

**To disconnect,** turn the switch off. **To remove it:**
- in Claude Desktop: Settings → Extensions;
- in Claude Code: `claude mcp remove --scope user break-the-wall`.

## Local models

A local model on your computer can generate **disassemblies and lessons**, not explorations yet. Start a model server, open **Take apart a source → Generation → Local model**, and the app finds it: it probes the default ports and identifies each runtime by its own endpoints. Before first use, it sends a tiny probe to check whether the server really enforces the output format.

| Runtime | Default address | How the format is enforced | Observed on Ollama 0.30.8 / llama.cpp b9509 |
|---|---|---|---|
| llama.cpp server | `127.0.0.1:8080` | `/completion` with `json_schema` | ✅ enforced |
| LM Studio | `127.0.0.1:1234` | `response_format` JSON Schema | not yet tested |
| Ollama | `127.0.0.1:11434` | `format` | depends on the model: ✅ Qwen3.6, ⚠️ ignored for LFM2.5 (the app warns) |
| Other OpenAI-compatible server | any loopback port | `response_format` JSON Schema | depends on the server |

Measured on an M4 Pro with 48 GB, using Qwen3.6-35B-A3B (Q4_K_M) through llama.cpp: a lesson took about 1–2 minutes. Details are in the [local inference trial](docs/workflow/research/R-20261022-local-inference.md).

```bash
llama-server -m Qwen3.6-35B-A3B-Q4_K_M.gguf -c 32768
```

> [!TIP]
> Use a model with at least ~30B parameters and a 32k context. Plan for 32 GB of memory or more. Only addresses on this machine are accepted, so your source never leaves the computer on this route.

## Tech stack

| Layer | Stack |
|---|---|
| Desktop host | Electron 45: sandboxed renderer, context isolation, custom `btw://` protocol |
| Interface | React 19, TypeScript 7, Vite 8, SVG drawings, lucide icons, system fonts; markdown-it for sources read as documents, Mermaid for their diagrams (loaded on first use) |
| Exploration model | zod 4 contract with located findings, the structure's detector (nuclei, layers, way in), the source index, the levels of abstraction, a deterministic layout with label placement, and the reading report; independent of React and Electron |
| AI routes | Sign in with ChatGPT (OAuth + PKCE, Responses API); Ollama, LM Studio and llama.cpp over loopback for disassemblies and lessons |
| Assistants | An MCP server over stdio, written without an SDK: 8 tools and 1 prompt. It ships as a Claude Desktop extension (`.mcpb`) and runs in Claude Code on the app's Electron in Node mode |
| Storage | atomic JSON files in the app's data folder; credentials via `safeStorage` (Keychain on macOS, DPAPI on Windows) |
| Tests | Vitest, Testing Library (jsdom): contracts, detector, layout geometry, contrast, catalogs, view interactions |

## Project status

The exploration follows the approved plan [P-20261105-exploration](docs/workflow/plans/P-20261105-exploration/plan.md) (v10). Earlier work follows [P-20261024-disassembly](docs/workflow/plans/P-20261024-disassembly/plan.md), [P-20261027-macos-dmg](docs/workflow/plans/P-20261027-macos-dmg/plan.md), [P-20261027-windows-alpha](docs/workflow/plans/P-20261027-windows-alpha/plan.md) and [P-20261028-mcp-integration](docs/workflow/plans/P-20261028-mcp-integration/plan.md). Evidence for each task is in its plan.

| Phase | Tasks | Status |
|---|---|---|
| Gate | X1 the structure request on Claude and ChatGPT, judged by the owner on six sources | ✅ passed |
| Core | X2–X6 contract, detector, source index, layout, levels of abstraction, reading report | ✅ code and automated tests |
| Generation | X7–X10 the request through ChatGPT, the store, Claude over MCP, three prepared explorations | ✅ code and automated tests; one ChatGPT run and one Claude Code run witnessed |
| View | X11–X19 tokens, the view and its guides, the sub-level in place, joint labels, card and index, "How it was read", opening from the library and Studio | ✅ code, automated tests and the built app driven on macOS |
| Polish | X21–X28 the card explains the selection, two views of the source, resizable panes, the index legend, a readable bar | ✅ code, automated tests and the built app driven, after the owner's look |
| Verify | X20 CI on macOS and Windows, the owner's look at their own sources | 🟡 the owner's own sources are being judged |
| Earlier | Disassembly player, generation and Studio; macOS and Windows apps; Claude integration | ✅ see the earlier plans; released up to `v0.4.0-alpha` |

Not claimed: learning effectiveness, correctness of generated explorations, platforms other than macOS and Windows x64, Intel Mac or Windows on ARM builds, or apps signed by Apple or Microsoft.

## Roadmap

- [x] Exploration: structure read in one request, checked links with their basis, levels of abstraction, two guides, "How it was read"
- [x] Claude Desktop and Claude Code write explorations (MCP); ChatGPT generates them in the app
- [x] Paper and blueprint themes; English and Italian interface
- [x] Downloadable macOS app for Apple Silicon (ad-hoc signed) and Windows app for x64 (unsigned installer)
- [ ] The owner's own sources judged, and long sources split across requests
- [ ] Run and reassemble, redesigned around the exploration
- [ ] Local models measured and offered for explorations
- [ ] Repositories as a source: snapshot identity, secrets found by content
- [ ] PDF documents as a source: checked extraction, page citations
- [ ] Signed and notarized macOS app (Apple Developer ID), with updates; code-signed Windows installer
- [ ] ChatGPT integration as an assistant (needs a remote MCP server; sources would leave the device)

## Contributing

Contributions are welcome, from a bug report or a translation fix to a new prepared exploration. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the setup, the checks every change passes and the research → plan → implement workflow used for larger changes.

## Community

- **Questions and ideas:** [Discussions](https://github.com/simoneriggi92/BreakTheWall/discussions).
- **Bugs and proposals:** [issues](https://github.com/simoneriggi92/BreakTheWall/issues/new/choose), with a form for each. Issues labelled [good first issue](https://github.com/simoneriggi92/BreakTheWall/labels/good%20first%20issue) are a good place to start.
- **Security:** report privately, as described in [SECURITY.md](SECURITY.md).
- **Conduct:** everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Changes:** each version is described in the [changelog](CHANGELOG.md).

## License

Break the Wall is licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
