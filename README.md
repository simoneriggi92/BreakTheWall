<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/brand/wordmark-blueprint.svg">
    <img src="docs/images/brand/wordmark.svg" alt="Break the Wall" width="460">
  </picture>
</p>

<h1 align="center">Take the text apart.</h1>

<p align="center">AI gives you a wall of text. Break the Wall turns it into source-linked parts you can explore, test and put back together.</p>

<p align="center"><strong>Open-source alpha · macOS · Windows · Works with Claude · English &amp; Italian · Apache-2.0</strong></p>

<p align="center">
  <a href="https://github.com/simoneriggi92/BreakTheWall/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/simoneriggi92/BreakTheWall/ci.yml?branch=main&amp;style=flat-square&amp;label=CI" alt="CI"></a>
  <a href="https://github.com/simoneriggi92/BreakTheWall/releases"><img src="https://img.shields.io/github/v/release/simoneriggi92/BreakTheWall?include_prereleases&amp;style=flat-square&amp;color=D96B4B" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%C2%B7%20Windows-102B46?style=flat-square" alt="Platform: macOS and Windows">
  <img src="https://img.shields.io/badge/interface-English%20%C2%B7%20Italiano-102B46?style=flat-square" alt="Interface: English and Italian">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-102B46?style=flat-square" alt="License: Apache-2.0"></a>
</p>

<p align="center"><a href="#try-the-alpha"><strong>Try the alpha</strong></a> · <a href="#how-it-works">How it works</a> · <a href="#roadmap">Roadmap</a> · <a href="CONTRIBUTING.md">Contribute</a></p>

<p align="center"><strong>1 · Claude writes it, Break the Wall checks it</strong> · <a href="#use-with-claude">Use with Claude</a></p>

![Demo with Claude: Use with Claude turned on in the app; in Claude Code the request is typed, Claude explains how a browser checks an HTTPS certificate and takes the explanation apart with Break the Wall, phase by phase; the app refuses the first structure and the first runs and Claude fixes them; the disassembly opens in the app marked as written by your assistant, a part shows its source lines, and the scenario is run step by step with a prediction](docs/images/claude.gif)

<p align="center"><strong>2 · Explore it, run it, put it back together</strong></p>

![Demo: a release runbook taken apart into six parts; a part's card with its source lines highlighted, then its sub-assembly opened one level down; a scenario predicted and run on the drawing, where a smoke test fails and the rollback takes over; the theme switched from blueprint to paper; Mill's harm principle, where pulling out one premise makes the claim fall; the blank drawing for reassembly; the bill of materials](docs/images/demo.gif)

> [!NOTE]
> **Alpha.** [Download the app](#try-the-alpha) for Apple Silicon Macs or Windows x64 PCs, or run it from source. The prepared examples work without an account. Taking apart your own text or Markdown uses ChatGPT (experimental), a local model on your computer, or [Claude Desktop and Claude Code](#use-with-claude), which can open a text in Studio or write the disassembly themselves. PDF documents and repositories as sources are on the [roadmap](#roadmap).

## Table of contents

- [Why Break the Wall?](#why-break-the-wall)
- [How it works](#how-it-works)
- [Try the alpha](#try-the-alpha)
- [Features](#features)
  - [The disassembly](#the-disassembly)
  - [Run](#run)
  - [Reassemble](#reassemble)
  - [Bill of materials](#bill-of-materials)
  - [Two themes, two languages](#two-themes-two-languages)
  - [Generation](#generation)
  - [Progress and privacy](#progress-and-privacy)
- [Local models](#local-models)
- [Use with Claude](#use-with-claude)
- [Tech stack](#tech-stack)
- [Project status](#project-status)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Community](#community)
- [License](#license)

## Why Break the Wall?

A useful AI explanation can still be a wall of text: correct-sounding, hard to retain and hard to check. Break the Wall makes its structure explorable: open one part, see what it connects to, and return to the source lines behind it. The question is not only "can I read this?" but "can I explain how its parts work together?"

The idea comes from reverse engineering, which takes software apart with evidence for every finding so it can be understood and rebuilt. It is not a course, a summarizer, a chatbot or a flashcard app; review is there only if you want it. See the [product definition](docs/product.md).

| | A chat answer | Break the Wall |
|---|:---:|:---:|
| The whole as an exploded view of 3–7 parts, with sub-assemblies | ❌ | ✅ |
| Joints that say how parts connect: sends to, causes, supports, attacks, leads to… | ❌ | ✅ |
| Every part linked to exact source lines | ❌ | ✅ |
| Predict before each step runs; remove a brick and see if the claim falls | ❌ | ✅ |
| A bill of materials that accounts for every line of the source | ❌ | ✅ |
| Progress, runs and notes that resume after restart | ❌ | ✅ |

> [!IMPORTANT]
> Source links are checked; explanations can still be wrong. The app checks that every cited line exists in your source, and that every line is either in a part or excluded with a reason. A wrong explanation can still sit next to a correct citation, so read the highlighted lines.

## How it works

| Step | What you do |
|---|---|
| **Disassemble** | Explore 3–7 parts per level, with named connections and links to source lines. Open a part to go deeper. |
| **Run** | Predict a process step before it runs, remove a premise from an argument, or apply the whole to a new case. |
| **Reassemble** | If you want, rebuild the structure on a drawing whose names are hidden. |

The prepared examples show a release runbook and Mill's harm principle. The same loop works for any subject: only the kind of connection changes (mechanism, argument, story).

## Try the alpha

### Download for Mac

**Requirements:** a Mac with Apple Silicon (M1 or later) and macOS 13 Ventura or later.

1. Download `Break-the-Wall-<version>-arm64.dmg` from the [latest release](https://github.com/simoneriggi92/BreakTheWall/releases).
2. Open it and drag **Break the Wall** to **Applications**.
3. Open the app. The first time, macOS shows **“Break the Wall” Not Opened**: *Apple could not verify “Break the Wall” is free of malware that may harm your Mac or compromise your privacy.* The alpha is signed ad-hoc and not notarized by Apple, so this is expected. Choose **Done**. Open **System Settings → Privacy & Security**, scroll to **Security**, choose **Open Anyway** next to Break the Wall, and confirm with Touch ID or your password. Open the app again and choose **Open Anyway** in the dialog. You do this once for each download.

To check the download, put the `.sha256` file from the release next to the DMG and run:

```bash
shasum -a 256 -c Break-the-Wall-<version>-arm64.dmg.sha256
```

The app starts clean: the two prepared examples, no account and nothing saved. What you create stays on your Mac in `~/Library/Application Support/Break the Wall`, and ChatGPT credentials stay in your Keychain. There are no automatic updates yet: to update, download the DMG of a newer release and replace the app; your data stays where it is. The ChatGPT sign-in does not carry over from a build run from source, and may not survive an update, because each version is signed ad-hoc: if Studio shows you signed out, sign in again.

### Download for Windows

**Requirements:** a 64-bit (x64) PC with Windows 10 or 11.

1. Download `Break-the-Wall-<version>-x64-setup.exe` from the [latest release](https://github.com/simoneriggi92/BreakTheWall/releases).
2. Run it. The alpha is not code-signed, so Windows SmartScreen shows **Windows protected your PC**. Choose **More info**, then **Run anyway**. You do this once for each download.
3. The setup installs Break the Wall for your user only, without administrator rights, adds it to the Start menu and the desktop, and opens it.

To check the download, put the `.sha256` file from the release next to the setup and run in PowerShell (it prints `True` when they match):

```powershell
(Get-FileHash .\Break-the-Wall-<version>-x64-setup.exe).Hash -eq (Get-Content .\Break-the-Wall-<version>-x64-setup.exe.sha256).Split(' ')[0]
```

The app starts clean, as on the Mac. What you create stays in `%APPDATA%\Break the Wall`, and ChatGPT credentials are encrypted by Windows for your user. To update, run the setup of a newer release; your data stays. To uninstall, open **Settings → Apps → Installed apps**, find **Break the Wall** and choose **Uninstall**: the app and its shortcuts go, your data folder stays until you delete it.

### Run from source

For an Intel Mac, or to change the code. **Requirements:** macOS or Windows, Node.js 22.23.2 and npm 10.9.8 (pinned in `package.json`).

```bash
git clone https://github.com/simoneriggi92/BreakTheWall.git
cd BreakTheWall
npm ci
npm run build
npm start
```

The first `npm start` downloads Electron's binary for your Mac. Open either prepared example to try the loop without an account. To take apart your own material, choose **Take apart a source** and paste text or pick a `.txt` / `.md` file; generation needs a ChatGPT sign-in or a [local model](#local-models).

**Development**

```bash
npm run dev       # Vite + Electron with reload
npm run check     # strict TypeScript + Vitest
npm run dev:web   # renderer only, in a browser (no generation)
npm run eval      # measure generation on fixed cases (see Local development)
npm run brand     # render the app icon from docs/images/brand
npm run package   # build the Apple Silicon DMG into release/
```

Set `BTW_USER_DATA_DIR` to an absolute path to keep test data separate from your own. More details are in [Local development](docs/development.md), with links to the [product](docs/product.md), [architecture](docs/architecture.md), [plans](docs/workflow/plans/), [status](STATUS.md) and [changelog](CHANGELOG.md).

## Features

### The disassembly

- **Exploded view:** the parts drawn as plates on a technical sheet, with balloons, a title block and an automatic layout. Mechanisms and stories run left to right; arguments stack, with the claim above its grounds and attacks or limits beside it.
- **Numbers in reading order:** a part's number follows the arrows: the flow of a mechanism, grounds before the claim they support, the events of a story. The bill of materials numbers parts the same way ("2.1.3").
- **Room to read:** drag the bar under the drawing to make the plates bigger, and the bar between the card and the source to share the row. Sizes are remembered on this device. Inside a sub-assembly, the ↑ control, Escape or Alt+↑ goes back to the level above.
- **Sub-assemblies, as deep as the source goes:** a part can open into its own 3–7 parts, and so on, level after level. Every level accounts for its parent's lines. A part with at least 6 lines of its own can be taken apart on request ("Take this part apart", one small request); a smaller one says why it stops there. Parts outside your question stay closed and hatched, but you can still open them.
- **Three kinds of joint:** mechanism (sends to, causes, depends on), argument (supports, attacks, limits) and story (leads to, because). Each kind has a color, a line style and an end mark, so color is never the only cue.
- **Part card:** a short lead (what the part is for), then 2–4 points that add the details, marked → (then), = (stays the same) or ⚠ (caution), and an optional lens, metaphor with its limit, and critical note. It also lists the part's joints in words, its citations and your notes.
- **Source pane:** numbered lines, the cited lines highlighted, page breaks for documents, and a file picker when there are many sources. A markdown or text source can also be read as a document, beside the card or in a full-window reader with an outline: tables and Mermaid diagrams are drawn, and citations highlight their blocks. HTML inside a source is shown as text, links are not followed and images are not fetched.

### Run

- **Scenario:** a setup and instruments (for example `staging: digest A`), then one step at a time. Before a step runs you predict what happens. The step's parts then show as running and its effects land: states, instruments and the explanation, with its source lines.
- **Load test:** remove one brick at a time and see whether the target **falls**, **weakens** or **holds**. Interpretations that the text does not state are labelled.
- **New case:** apply the disassembly to a situation it does not describe, labelled as a constructed case.

### Reassemble

Optional. The drawing keeps its shape but loses its names; put the parts back by click or drag. The tray never starts in solution order, and item numbers are hidden. A wrong placement names the part with its hint. Interchangeable parts, such as three independent supports, can go in any of their slots.

### Bill of materials

Every source line is in a part, in a joint, or excluded with a reason: context, outside the question, repetition, detail, contains secrets, generated. The view shows the scope (a repository snapshot or a document's pages), a strip per source, the items with their line ranges, and file-level exclusions. It also shows the app's own check, which names any forgotten range.

### Two themes, two languages

![Mill's harm principle taken apart in the blueprint theme: the claim in the middle, its grounds below, the consequence above, the objection and the limit at its sides](docs/images/disassembly-mill-blueprint.png)

- **Paper** (light) and **blueprint** (dark), following the system or chosen in the header. Every text color reaches WCAG AA in both themes, checked by a test.
- **English and Italian** interface, following the system or chosen in the header. Content keeps its own language and is never translated by the app. When a disassembly exists in both languages, the player offers the other version, and progress stays separate for each version.

### Generation

Studio takes apart pasted text or `.txt` / `.md` files around your question, in three phases:
1. **Structure:** the parts, their joints and the bill of materials. The app checks it line by line before going on.
2. **Parts:** one request per top-level part, carrying only that part's lines.
3. **Runs:** scenarios, load tests or cases, and the reassembly hints.

Each phase can be repaired once with the app's findings. When the repair leaves only texts a few characters too long, one small request shortens just those. Nothing is saved as a disassembly unless the whole of it passes.

- **Suggested break-downs:** on the question step, "Suggest break-downs" sends one request and proposes 3–5 questions, each with its kind (mechanism, argument, story) and the parts it would give. Choosing one fills the question field, which you can still edit. Nothing is sent until you press the button.
- **The drawing while it is written:** once the structure is accepted, Studio draws the top level, and each plate shows whether its part is waiting, being written, done or failed. A part that is done opens its lead and points.
- **Resume:** a failed or cancelled generation keeps what was accepted (structure, parts, runs) in one draft file in the app's data folder. Studio says what was kept and offers "Resume", which asks only for what is missing, or "Start over". The draft is deleted on success and when a new generation starts.
 You choose the content language (by default, your question's), and you can give the structure and the parts different models, for example a cheaper one for the parts. There are two routes:

| Route | Account | Where your source goes | Status |
|---|---|---|---|
| **ChatGPT** | Sign in with ChatGPT; uses your plan | OpenAI, over the documented Responses API | Experimental. Disassemblies generated live: in the last check, 4 of 4 public cases valid |
| **Local model** | none | a server on `127.0.0.1` on your Mac | Witnessed for lessons; disassemblies not yet measured |
| **Your Claude assistant** | your Claude Desktop or Claude Code | Anthropic, through your Claude app ([Use with Claude](#use-with-claude)) | Experimental. Witnessed in Claude Desktop and Claude Code: findings sent back and fixed, every run saved and opened |

Lessons created before disassemblies stay readable, with their progress, under "Earlier paths".

### Progress and privacy

- **Storage:** disassemblies, lessons, progress and notes stay on your device, written atomically. Progress that no longer matches its disassembly is kept on disk and the session restarts, with a notice.
- **Interrupted generations:** at most one draft, `generation-draft.json`, with the text generated so far. It never leaves the device and is deleted on success, on "Start over" and when a new generation starts.
- **Credentials:** ChatGPT tokens are encrypted with Electron `safeStorage` (the Keychain on macOS, the system's data protection on Windows) and never reach the interface or the logs.
- **Isolation:** the renderer has no Node, filesystem or network access. Every desktop operation goes through narrow, validated IPC calls.
- **Local entry point for assistants:** only while **Connect AI assistants** is on, the app listens on a socket in its data folder (readable only by you) or, on Windows, a named pipe. A text arriving there is imported like a paste. A disassembly arriving there is validated like a stored file and accepted only as a new one written by an assistant.

## Local models

Start a model server, open **Take apart a source → Generation → Local model**, and the app finds it. It probes the default ports and identifies each runtime by its own endpoints. Before first use, it sends a tiny probe to check whether the server really enforces the output format.

| Runtime | Default address | How the format is enforced | Observed on Ollama 0.30.8 / llama.cpp b9509 |
|---|---|---|---|
| llama.cpp server | `127.0.0.1:8080` | `/completion` with `json_schema` | ✅ enforced |
| LM Studio | `127.0.0.1:1234` | `response_format` JSON Schema | not yet tested |
| Ollama | `127.0.0.1:11434` | `format` | depends on the model: ✅ Qwen3.6, ⚠️ ignored for LFM2.5 (the app warns) |
| Other OpenAI-compatible server | any loopback port | `response_format` JSON Schema | depends on the server |

Measured on an M4 Pro with 48 GB, using Qwen3.6-35B-A3B (Q4_K_M) through llama.cpp: a lesson took about 1–2 minutes. Disassemblies have not been timed yet. Details are in the [local inference trial](docs/workflow/research/R-20261022-local-inference.md).

```bash
llama-server -m Qwen3.6-35B-A3B-Q4_K_M.gguf -c 32768
```

> [!TIP]
> Use a model with at least ~30B parameters and a 32k context. Plan for 32 GB of memory or more. Only addresses on this machine are accepted, so your source never leaves the computer on this route.

## Use with Claude

Break the Wall works with **Claude Desktop** and **Claude Code** through a local MCP server that ships inside the app. You install nothing else.

The first demo at the top of this page comes from a real run in Claude Code, with Sonnet: 13 turns and about $0.38 on the user's plan. The first structure and the first runs were refused, and Claude fixed them. The terminal is redrawn from the run's transcript, with each result summarized. The app frames show the disassembly Claude wrote in that run.

There are two ways to use it:

| | You ask Claude | What happens | Who writes the disassembly |
|---|---|---|---|
| **Open in Studio** | "Explain how a browser checks an HTTPS certificate and open it in Break the Wall" | The app comes to the front with Claude's text and your question in Studio | Break the Wall, with the route you choose (ChatGPT or a local model), when you press Generate |
| **Claude writes it** | "Take this apart with Break the Wall" | Claude writes the structure, then each part, then the runs. The app checks every phase with the same rules it uses for its own generations, and returns findings for Claude to fix. After 3 attempts at a step, Claude asks you before trying again, and nothing already accepted is lost | Claude, on your Claude plan; the result opens in the library as "Written by your assistant" |

**Connect it once.** In the app, open **Use with Claude** at the top of the library:
1. Turn on **Connect AI assistants**. While it is off, Break the Wall accepts nothing from other apps.
2. **Claude Desktop:** press **Add to Claude Desktop**. Claude Desktop opens and asks to install the Break the Wall extension.
3. **Claude Code:** press **Copy command** and run it once in a terminal. It adds the server for every project, using the app's own runtime:

   ```bash
   claude mcp add --scope user break-the-wall -e ELECTRON_RUN_AS_NODE=1 -- "<the app>" "<its MCP server>"
   ```

**The `break` prompt.**
It explains your question and has Claude take the explanation apart: the "Claude writes it" way, in one step.
- *Claude Desktop:* pick it among the conversation's attachments and type your question in its field.
- *Claude Code:* type `/break-the-wall:break`. Claude Code passes on only the first word after a prompt's name, so Claude asks for your question. With nothing to ask, it takes apart Claude's last long answer.

> [!NOTE]
> **What leaves your computer.**
> - *Open in Studio:* the text is written by Claude, in your Claude conversation, and reaches the app over a local socket. Nothing more leaves the computer until you press Generate, and then only to the route you choose.
> - *Claude writes it:* your source goes to Anthropic, through your own Claude app and on your plan, because Claude is the one writing.
>
> Either way, Break the Wall itself sends nothing to Claude.

**Limits.**
- **Supported clients:** Claude Desktop and Claude Code. ChatGPT cannot reach a server on your computer: it needs a remote server, which would take your sources off the device, so it is not supported.
- **After updating the app:** add the extension to Claude Desktop again. On Windows, copy the Claude Code command again too, since it names the app's version folder.
- **Interrupted work:** an unfinished "Claude writes it" session lives only in that conversation. If the conversation ends, start again.

**To disconnect,** turn the switch off. **To remove it:**
- in Claude Desktop: Settings → Extensions;
- in Claude Code: `claude mcp remove --scope user break-the-wall`.

## Tech stack

| Layer | Stack |
|---|---|
| Desktop host | Electron 45: sandboxed renderer, context isolation, custom `btw://` protocol |
| Interface | React 19, TypeScript 7, Vite 8, SVG technical drawings, lucide icons, system fonts; markdown-it for sources read as documents, Mermaid for their diagrams (loaded on first use) |
| Disassembly model | zod 4 contract with located findings, bill-of-materials check, deterministic layered layout and pure run/reassembly transitions; independent of React and Electron |
| AI routes | Sign in with ChatGPT (OAuth + PKCE, Responses API); Ollama, LM Studio and llama.cpp over loopback |
| Assistants | An MCP server over stdio, written without an SDK: 5 tools and 1 prompt. It ships as a Claude Desktop extension (`.mcpb`) and runs in Claude Code on the app's Electron in Node mode |
| Storage | atomic JSON files in the app's data folder; credentials via `safeStorage` (Keychain on macOS, DPAPI on Windows) |
| Tests | Vitest, Testing Library (jsdom): contract, layout geometry, contrast, catalogs, player interactions |

## Project status

Work follows the approved plans [P-20261024-disassembly](docs/workflow/plans/P-20261024-disassembly/plan.md) (v7), [P-20261027-macos-dmg](docs/workflow/plans/P-20261027-macos-dmg/plan.md) (v1), [P-20261027-windows-alpha](docs/workflow/plans/P-20261027-windows-alpha/plan.md) (v1) and [P-20261028-mcp-integration](docs/workflow/plans/P-20261028-mcp-integration/plan.md) (v2). Evidence for each task is in its implementation record.

| Phase | Tasks | Status |
|---|---|---|
| Contract | D1 format and host checks · D2 automatic layout · D3 learner state | ✅ automated tests |
| Player | D4 themes and languages · D5 exploded view · D6 run · D7 reassembly and bill of materials · D8 library and store | ✅ automated tests; 🟡 D8 desktop flow being witnessed by the owner |
| Generation | D9 two-phase generation and model comparison · D10 Studio and witnessed generation | ✅ code, automated tests and model comparison (setup A chosen); ⏳ witnessed generation |
| Depth | D13 depth guided by the source · D14 take a part apart on demand | ✅ code, automated tests and 2 measured expansions |
| Player usability | D15 numbers in reading order · D16 back to the level above · D17 resizable panes · D18 rendered markdown source | ✅ code, automated tests and owner check |
| Player workbench | U1–U9 lighter chrome · claim and source together · runs that start with the question · one voice for text | ✅ code, automated tests on macOS and Windows, 32 measured layouts and owner check; released in `v0.4.0-alpha` |
| Generation usability | D19 length repair · D20 short lead · D21 resume · D22 drawing while generating · D23 suggested break-downs | ✅ code, automated tests, D20 live check (4 of 4 valid) and owner check |
| Identity and presentation | D24 brand assets · D25 mark and tagline · D26 home opening · D27 app icon · D28–D31 README, images, GitHub page, first release | ✅ identity in the app and this page; pre-release [`v0.1.0-alpha`](https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.1.0-alpha) |
| macOS app | K1–K3 package script, ad-hoc signature, start check · K4–K6 release workflow, install steps, witnessed install | ✅ DMG built in CI on a tag and attached to [`v0.1.1-alpha`](https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.1.1-alpha); install from a download witnessed by the owner |
| Windows app | W1 Windows in CI · W2 platform-aware wording · W3–W5 icon, installer events, setup and release job · W6–W7 install steps and witnessed install | ✅ CI and start check on Windows; setup built in CI on a tag and attached to [`v0.2.0-alpha`](https://github.com/simoneriggi92/BreakTheWall/releases/tag/v0.2.0-alpha); install witnessed by the owner in a Windows 11 VM |
| Claude integration | M1–M2 local entry point and Studio hand-off · M3–M4a MCP server, Claude Desktop extension, panel and prompt · M5–M7 Claude writes the disassembly · M8–M9 docs and witnessed checks | ✅ code and automated tests on macOS and Windows, the packaged server checked on both; Claude writing a disassembly witnessed in Claude Desktop and Claude Code |
| Repository (gated) | D11 local repository as a source | ⏳ after D9 |
| Document (gated) | D12 PDF document as a source | ⏳ after D9 |

Not claimed: learning effectiveness, correctness of generated explanations, platforms other than macOS and Windows x64, Intel Mac or Windows on ARM builds, or apps signed by Apple or Microsoft.

## Roadmap

- [x] Disassembly format with a verified bill of materials
- [x] Automatic layout for mechanisms, arguments and stories
- [x] Player: exploded view, run, reassemble, bill of materials
- [x] Paper and blueprint themes; English and Italian interface
- [x] Two-phase generation of disassemblies, with suggested questions, a live drawing and resume
- [ ] Local models measured on disassemblies
- [ ] Repositories as a source: snapshot identity, secrets found by content, file-level bill of materials
- [ ] PDF documents as a source: checked extraction, page citations
- [ ] Dependency map for repositories, and a reassembly that simulates the effect of a misplaced part
- [x] Downloadable macOS app for Apple Silicon (ad-hoc signed)
- [ ] Signed and notarized macOS app (Apple Developer ID), with updates
- [x] Downloadable Windows app for x64 (unsigned installer)
- [ ] Code-signed Windows installer
- [x] Claude Desktop and Claude Code integration (MCP): open a text in Studio, or let Claude write the disassembly
- [ ] ChatGPT integration (needs a remote MCP server; sources would leave the device)

## Contributing

Contributions are welcome, from a bug report or a translation fix to a new prepared disassembly. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the setup, the checks every change passes and the research → plan → implement workflow used for larger changes.

## Community

- **Questions and ideas:** [Discussions](https://github.com/simoneriggi92/BreakTheWall/discussions).
- **Bugs and proposals:** [issues](https://github.com/simoneriggi92/BreakTheWall/issues/new/choose), with a form for each. Issues labelled [good first issue](https://github.com/simoneriggi92/BreakTheWall/labels/good%20first%20issue) are a good place to start.
- **Security:** report privately, as described in [SECURITY.md](SECURITY.md).
- **Conduct:** everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- **Changes:** each version is described in the [changelog](CHANGELOG.md).

## License

Break the Wall is licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
