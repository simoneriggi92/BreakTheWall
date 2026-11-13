# Scope: Break the Wall

Break the Wall takes a source apart into parts tied to their lines and lets you explore how it holds together. This scope takes it to code repositories, read as one more kind of source (a map of the whole, then one area at a time, with nothing left out silently).

**Build approach:** Skateboard (ship the smallest usable whole first, then grow it release by release, each release shippable).
**Workflow:** Alpha (after `/develop`, `/check verify` on the real app). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

Direction set by the owner on 2026-11-13, inspired by a four step way of reading a repository (what it is, how it fits, the code, then questions). It is not a copy of four tools: a repository is a source like any other, explored in the same view with three roles, and the identity in [docs/product.md](../product.md#identity) stays as it is (not a chatbot, not a summarizer, one loop for every subject).

Later on 2026-11-13 the owner parked the browser release: opening an exploration inside Claude on claude.ai needs a public server, because Claude runs in Anthropic's cloud and cannot reach your computer. Features 2, 3 and 8 moved to Deferred, and the repository release became Release 1. Feature numbers stay as they were.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Desktop app and packaging | Existing | existing |
| B | Text sources | Existing | existing |
| C | Exploration | Existing | existing |
| D | Generation routes | Existing | existing |
| E | Disassembly player | Existing | existing |
| 1 | Handover to the scope pipeline | Foundation | done |
| 4 | Repository intake | Release 1: Repository | planned |
| 5 | Repository map | Release 1: Repository | planned |
| 6 | Explore one area | Release 1: Repository | planned |
| 7 | A question becomes a trace | Release 2: Questions | planned |

## Already built

### A. Desktop app and packaging · existing
Electron host with an ad hoc signed DMG for Apple Silicon and an unsigned Windows installer, interface in English and Italian, paper and blueprint themes. code in `src/desktop/`, `src/renderer/`

### B. Text sources · existing
Pasted text and UTF 8 `.txt` / `.md` files, up to 120,000 characters across all sources. code in `src/core/source.ts`

### C. Exploration · existing
Structure contract, detector, source index, reading report, and the view with three roles (guide, structure, source) on one shared state. Closed by the owner on 2026-11-13; X20.4 (the owner's own sources) is dropped. code in `src/core/exploration*.ts`, `src/renderer/exploration/`

### D. Generation routes · existing
ChatGPT inside the app, and Claude through the local MCP server, which writes a structure the app checks over a local socket. code in `src/desktop/chatgpt/`, `src/mcp/`

### E. Disassembly player · existing
The earlier loop with run and reassemble; disassemblies made so far stay readable. code in `src/core/disassembly*.ts`, `src/renderer/disassembly/`

## Foundations

### 1. Handover to the scope pipeline · done
The repository's workflow becomes the `jsmastery-pro/skills` set: `/scope` → `/architect` (specs in `docs/specs/`) → `/develop` → `/check` · `/test` → `/sync`, with `/debug` and `/document` when needed. project-workflow stops being the way work is done; its plans and research stay as history. `/audit` never rewrites curated text, so the adapter section is replaced by a direct edit first.
code in `AGENTS.md`, `STATUS.md`, `docs/workflow/README.md`, `CONTRIBUTING.md`, `README.md`
**Done when:** root `AGENTS.md` names the `jsmastery-pro/skills` workflow and no longer sends work to project-workflow; plan P-20261105-exploration is marked closed with X20 dropped; `docs/workflow/` and `STATUS.md` are marked as frozen history; `/audit` has filled any conventions the new skills read that are still missing.
- [x] Replace the workflow adapter and freeze the old plans: `/develop handover to the scope pipeline`
- [x] Fill the missing conventions: `/audit`

## Release 1: Repository

A local repository becomes a source. First the whole (what it is, its areas), then one area explored in depth. The point that sets it apart: every file not read is listed with its reason, so the file you needed never disappears without a word.

### 4. Repository intake · needs a decision · Beta
Read a local folder safely and say exactly what was read. Raised to Beta because a missed secret would travel into a conversation.
**Done when:** you pick a local folder; the snapshot is recorded (commit and modified files); ignored, binary and generated files are skipped; files holding secrets are held back by their content, not their name; every file not read is listed with its reason (size, kind, secret), and none is dropped silently.
- [ ] Design it (spec): `/architect repository intake`

### 5. Repository map · needs a decision
The whole repository at a glance: what it is and how it divides, the first two steps of reading a new repo, with evidence instead of a pitch.
**Done when:** a repository opens as one sentence on what it is plus its areas by responsibility (not by directory), each tied to its folders and files and citing lines; it works on a public repository of about 3,000 files, the size of FastAPI.
- [ ] Design it (spec): `/architect repository map`

### 6. Explore one area · needs a decision
Choosing an area on the map opens it in the existing exploration, so code is read with the same guide, structure and source as any text.
**Done when:** an area chosen on the map opens in the exploration with citations as file and line; a file larger than one request is read in parts or listed as not read with its reason, never skipped silently; the map is one step away.
- [ ] Design it (spec): `/architect explore one area`

## Release 2: Questions

### 7. A question becomes a trace · needs a decision
The answer to a question is a path through the parts already read, never more prose. It replaces chat while keeping "not a chatbot"; free conversation stays in Claude.
**Done when:** after a source or repository is read, you ask a question and get a trace through the existing parts, each step citing its lines; a question the structure cannot answer says so instead of writing prose.
- [ ] Design it (spec): `/architect a question becomes a trace`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **3. Explore inside Claude**: open the exploration inside the conversation on claude.ai, with nothing installed. Parked on 2026-11-13: any automatic route from claude.ai needs a public server. The verified route is a remote connector with MCP Apps (the view opens in the chat, the repair stays automatic); the alternatives are a link to a static site, or manual copy and paste with no server and a manual repair · needs a decision
- **2. Exploration view without a desktop host**: the view, its checks and the reading report run from one structure document with no desktop host. Its reason was the browser release; it comes back with feature 3 · needs a decision
- **8. Public GitHub repository**: start from a public github.com URL, pinned to a commit, through the same map and area as a local folder. Its reason was claude.ai, where a local folder cannot be reached; developers already have a clone, so the local folder covers Release 1 · needs a decision
- **Dependency map computed from code**: who imports, registers or resolves a part, computed by the app, never by the model · needs a decision
- **From the browser to the desktop app**: keep an exploration made in Claude in the desktop library · needs a decision
- **Run and reassemble on exploration**: the earlier loop, designed again on top of the view with three roles · needs a decision
- **Parts store**: parts understood, kept across sources · needs a decision
- **PDF documents**: extraction with a quality check, page map · needs a decision
- **Local models for exploration**: set aside by the owner on 2026-11-05 · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards and tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (before this workflow) and `dropped` (taken out of scope, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· Beta`) sets that one feature's rigor above or below the project default; no tag inherits the default.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
