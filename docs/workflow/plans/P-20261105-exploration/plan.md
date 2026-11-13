---
id: P-20261105-exploration
title: Exploration - the structure of a source, read by the app and explored by levels of abstraction in one view with three roles
version: 9
state: implementing
current_task: X20
last_evidence: X27-X28 (2026-11-09) tsc; vitest --dir tests 41 files 608 tests; build; built app over DevTools 125/125 (with X22-X26: bar on two lines, premise chip, no off-guide note for the step's own part). X21 and X20.1-X20.3 as recorded
next_action: owner - look at polish and clarity, then commit and push to PR 47 on request; then CI (X20.1), witness X20.2, X20.3 through Claude over MCP, X20.4
approval: approved
---

# Exploration

## Outcome

A learner gives a source, and the app opens it for exploration:
- **The app reads the source's structure** in one request:
  - parts of five kinds, at the grain of roles: what a piece does for the whole, not every component the source names;
  - the **members** of each role: the components the source names (classes, services, settings, files), already extracted, each with what it does and its cites;
  - the **aspects**: the large concerns of the source, and the aspect of each role;
  - the **whole**: one sentence on what the source is about;
  - links of four classes, each citing its lines and saying whether the source declares it or the extractor interprets it;
  - 2–4 points per part, each citing its own lines;
  - the questions the source itself walks (traces).
  
  The app checks every citation and relation before keeping it.
- **The app computes the levels and chooses the way in** from the shape, never from a genre:
  - the nuclei (the groups the bonds connect), with their layers along the flow;
  - the prerequisites, the annotations and the pieces aside;
  - how much of the main nucleus the source's own question walks;
  - the **premise**: the starting point the source states before any part, read first and alone;
  - the **aspect level**, derived by the app from the roles' aspects, and each aspect's **sub-level** of roles.
- **One view, three roles, on one shared state** (prototype E):
  - the **guide** moves it: "the whole source" by layers, after the premise, or "a question of the source";
  - the **structure** shows it, by levels of abstraction on one page:
    - the aspects, in labelled layer strips, with the prerequisites above what they open;
    - opening an aspect lifts its roles out **in place**, on a sub-level under the block. The whole keeps every position and fades, and the opened block stays highlighted;
    - inside the sub-level, a role shows its components in place, each selectable;
    - closing plays the sub-level back into its block, and the reader is on the same step;
    - each aspect has its own hue, kept by its roles, its sub-level, the card and the index;
    - a joint's label is short and says a relation, with an arrow the way the joint runs; labels are placed clear of blocks and can be moved, tied to their joint by a dashed leader;
    - choosing a block lights its joints and their labels, and steps the others back;
  - the **source** proves it, with a leader line from the selection (part, component, point or link) to its lines.
- **Beside the three roles:**
  - the source's own **index**, in its order;
  - the **card**, which leads with the explanation and its points; components, roles and joints wait folded;
  - **"how it was read"**: a verdict for every line, plus coverage, shape, basis, why this way in, and whether the logic follows the chapters.
- **Exploring off the guide is a pause**, with a way back to the step. An open sub-level is such a pause.
- **Everything is read before the view opens.** Every part, member, layer, aspect and nucleus is there when the source opens. The guide paces the reading. Nothing is taken apart on demand, and the learner never waits inside the view.
- **Style:** the technical drawing, in paper and blueprint, set as tokens before the view is built.
- **Routes:** the structure is written by OpenAI through the app's ChatGPT route, or by Claude through the MCP server. Local models come in a later phase.

Run and reassemble are not part of this outcome (owner, 2026-11-04). Disassemblies made so far stay readable in their player, which loses its "take this part apart" action.

## What changes from v4

v4 was approved on 2026-11-05 and its X1 ran run 0 and R1. The owner then set R2 aside for an abstraction study (2026-11-06). v5 carries what that study and the owner's three looks decided:
- **X1** continues with the abstraction request (R2's rules, the top-down principle, members, aspects, whole), on all six sources and both routes;
- **the contract** gains members, aspects and the whole (X2);
- **a new core task** derives the aspect level, the sub-levels and the premise (X5);
- **the layout** gains the spacing of E and the placement of joint labels (X4);
- **the view** is prototype E instead of D: two new tasks, the sub-level in place (X14) and movable joint labels (X15);
- D's "detail" control (aspects / roles / roles and components) is not built: E replaces it.

The tasks are renumbered:

| v4 | v5 | v4 | v5 |
|---|---|---|---|
| X1–X4 | X1–X4 | X11 view | X12 |
| — | X5 levels of abstraction | X12 guides | X13 |
| X5 reading report | X6 | — | X14 sub-level in place |
| X6 request | X7 | — | X15 joint labels |
| X7 store | X8 | X13 card and index | X16 |
| X8 MCP | X9 | X14 how it was read | X17 |
| X9 prepared examples | X10 | X15 open as exploration | X18 |
| X10 tokens | X11 | X16 retire take-apart | X19 |
| | | X17 verify | X20 |

## What changes from v5

v5 was approved on 2026-11-06 and its gate ran A1 on six sources and both routes, then A2 on the README. The owner judged the results and the prototype, and closed the gate: "vanno bene A2 … ho valutato tutto, creiamo questa parte di prodotto". v6 carries what the owner decided while judging:
- **X1 is passed.** The request the app ports (X7) is A2's: A1's rules plus "the problem and what answers it" and "a whiteboard grain".
- **Labels** always say a relation, never a bare count (X4, X5). Short, with an arrow the way the joint runs. The acting block is marked on pointing, and its hue colours the arrow (X15).
- **A chosen block lights its joints** and their labels, animated, and the others step back; choosing it again restores the view (X15).
- **Each aspect has a hue** at every level, from a colour study the owner preferred; prerequisites keep their own colour (X11, X12).
- **The card leads with the explanation**, with components, roles and joints folded (X16).
- **The aspect level draws every aspect** when no bond joins them (X5).
- **The frame is prototype NB**, whose panels fold; D's "space" control is not built (X12).

No task is added or renumbered.

## What changes from v6

v6 was approved on 2026-11-06 and X2–X20.3 are implemented on `feature/exploration`. Looking at the card on 2026-11-09, the owner found that it mostly repeats other surfaces: names already in the structure, relations already drawn as joint labels, lines already open in the source. Their rule: *if this sentence leaves the card, is an explanation lost, or only a copy of something already on screen?* The name, the kind and where the element sits stay, because they orient.

v7 adds one phase, `card`, with one task, **X21**:
- the card explains only the selected element, with one content per kind of selection (aspect, role, link, component);
- a link gets its own card, opened by choosing its joint label;
- the cited lines become a fallback, shown only while the source column is hidden.

X16 is superseded where X21 says otherwise. No other task changes. The contract and the request are untouched: the visible cuts come first, before any prompt is changed.

## What changes from v7

v7 was approved on 2026-11-09 and X21 is implemented and pushed (commit 1ad37b5, PR 47). Looking at the app the same day, the owner found five things, which v8 adds as phase `polish`:
- **X22.** The source column showed the Markdown rendered only. The disassembly player has two buttons for it, "Documento" (rendered) and "Righe" (raw, numbered), and the owner wants them back here.
- **X23.** The card, the index and the source could not be made larger or smaller, as the disassembly player's panes can. The card's height is fixed at 30%.
- **X24.** The aspect card cut by X21 confused the owner: a name and "Apri … 4 ruoli", nothing on what is inside. X21's own rule did not hold here, because at the aspect level the roles are not drawn until the aspect is opened, so the list of roles was the block's only overview, not a copy.
- **X25.** The "A parte" tray sits inside the drawing, between the graph and the guide, in the middle of the navigation. The owner chose to move it to the bottom of the structure column, in the aside colour ("A. Fascia in fondo al pannello").
- **X26.** The index's dots carry four signs (aspect hue, filled, ring, outline), and the one-line hint explains one of them. The owner asked for a legend at the bottom.

On the points, the owner asked why some cards have a bulleted list and others not. It follows the data: roles and prerequisites carry points, while aspects, annotations, references and procedures have none. It is intended, and v8 leaves it, except that X24 gives the aspect its roles.

X21 is superseded only on the aspect card (X24). No other task changes, and the contract and the request are untouched.

## What changes from v8

v8 was approved on 2026-11-09, and X22–X26 are implemented and checked (not yet committed). Looking at the app the same day, on a generated exploration of one of their own sources, the owner found two more things, which v9 adds as phase `clarity`:
- **X27.** In the bar, the title and the description are hard to read. The title is 20 px on one line. The description (the exploration's `whole`, the sentence that sums up the source) is 13 px, in the muted colour, on one line and cut with an ellipsis, so a long sentence is lost halfway.
- **X28.** The guide's strip repeats the card. At the premise step, the strip shows the premise's sentence, and the card shows the same sentence once the premise is selected. Choosing the very part the step puts forward also shows "Esplori fuori dalla guida", though the reader has not left the guide.

**The owner asked whether a popover next to the block would be better than the card.** It is not adopted, for four reasons:
- it covers neighbouring blocks, joints and labels (the problem X21 fixed for the hover peek);
- long content does not fit (the aspect's roles, the points, a link's bonds);
- it collides with the sub-level, which also opens under its block;
- the leader line to the source would start from a moving point, and on a narrow window or with the keyboard, managing focus gets hard.

The hover peek already gives a short sentence next to the block. Instead, each surface keeps one job: the strip says where the reader is, and the card says what it means.

**Not in v9:** generated explorations still take the source's file name as their title, because the request asks for no title. That needs a change to the request, and stays a separate decision.

## Evidence

- [Research R-20261104-exploration-experience](../../research/R-20261104-exploration-experience.md):
  - the diagnosis (`src/core/disassembly-generation.ts:110` asks for 3–7 parts, `:114` for a joint on every part);
  - the structure-first elements and the detector rule;
  - the owner's looks of 2026-11-04 and 2026-11-05;
  - the gate: run 0 (section 7) and R1 (section 8). Both routes were valid, but the explainer had too many blocks and the README lacked its pipeline nucleus;
  - **section 9, abstraction on the explainer (2026-11-06):**
    - four model-written approaches (by role, from the top, life cycle, reader's questions);
    - 15–21 roles, 97–121 members and 4 aspects each, all valid, citing 90–93% of the source;
    - the aspect level computed by the app;
    - prototype E, and the owner's three looks at it.
- [Product definition](../../../product.md#identity), revised on 2026-11-05: identity, the structure of a source, the signature, the visual direction, the exploration loop. X2 adds members, aspects and the derived levels to it.
- The private prototype `.local/experiments/exploration/` (outside the repository: it carries the owner's private sources). Behaviour is described here; no private content enters the repository.
  - `one.html` with `one.js` and `app.js` is the reference for the view. View E, "Livelli di astrazione", shows:
    - `aspectsOf`, `rolesOf`, `levelShape` and the premise rule;
    - `openSub` / `closeSub` and `drawSub`: the sub-level in place, with its motion;
    - `placeTags`: joint labels, placed and movable, with their arrow and the acting block's hue;
    - `nb.html`, `nb.js` and `nb.css`: prototype NB, the frame and the look the owner accepted, with the aspect hues of the colour study (`.local/prototypes/nb-color-study/`).
  - `gate/` holds the requests (`prompt.mjs` revisions 1–2, `abstraction.mjs` for the four approaches), the ChatGPT runner and the checker.
- [Research R-20261102-depth-in-advance](../../research/R-20261102-depth-in-advance.md): the owner already asked, on 2026-11-02, for "every level already taken apart and openable at once, without waiting".
- The lab's stage on `feature/lab-mode` (`src/renderer/lab/Stage.tsx`, `lab.css`) shows the motion pattern the owner named: FLIP with `Element.animate`, none under "reduce motion". It is a reference only. This plan does not depend on that branch.
- The app today, on `origin/main` (the base of this plan):
  - `src/core/disassembly.ts` (the disassembly contract, `schemaVersion: 1`, which requires runs and a reassembly);
  - `src/core/disassembly-generation.ts` (`formatSourceBlock`, repair requests);
  - `src/desktop/generator.ts` and `disassembly-store.ts` (routes, store);
  - taking a part apart during use:
    - `TakeApart` in `src/renderer/disassembly/PartCard.tsx` and `takeApart` in `DisassemblyPlayer.tsx`;
    - `expandPart` in the bridge (`src/core/provider.ts:178`, `src/desktop/preload.ts`);
    - the `disassembly:expand` handler in `src/desktop/main.ts`;
    - `expandPart` / `acceptExpansion`, with the expansion request, in `src/core/disassembly-generation.ts`;
  - `src/renderer/disassembly/SourceDocument.tsx` (a formatted source with addressable lines);
  - `src/renderer/styles.css` (paper and blueprint tokens, checked by `tests/theme.test.ts`).
- **The two routes this plan uses**, both on `origin/main`:
  - **Claude** reaches the app through the MCP server (`src/mcp/server.ts`: `start_disassembly`, `read_source`, `submit_structure`, `submit_part`, `submit_runs`). The assistant writes, the app checks and saves. Verified in Claude Desktop ([plan P-20261028-mcp-integration](../P-20261028-mcp-integration/plan.md), completed).
  - **OpenAI** is the app's ChatGPT route (`src/desktop/chatgpt/`).
    - The evaluation runner (`eval/runner.ts`, `npm run eval -- --route chatgpt --allow-chatgpt`) already drives it from outside the app, with a budget ledger (`eval/policy.ts`).
    - The gate's runner uses the same account class, and ran nine requests in run 0 and R1, all answered.
    - A witnessed ChatGPT inference in the app is still an open question of the adapter.
- The local route exists and was verified in October ([R-20261022-local-inference](../../research/R-20261022-local-inference.md)). This plan leaves it to a later phase.
- The source limits per route are in [R-20261029-source-limits](../../research/R-20261029-source-limits.md).
- ⚠ The local `main` is behind `origin/main` by the merges of pull requests #29–#39 (MCP, workbench, source entry, source limits). The base of this plan is `origin/main`.

## Owner's decisions

- **Exploration is the core**, on 2026-11-05: "Adesso direi che abbiamo un prodotto da costruire". Product definition and adapter are revised with this plan.
- **The experience is view D's three roles** (2026-11-04 and 2026-11-05):
  - two guides named by intent;
  - the source's order shown by the index;
  - the guide's step between the structure and the card;
  - "how it was read".
  
  On 2026-11-06 the structure became E's levels of abstraction.
- **Abstraction, not every component** (2026-11-06):
  - "non dobbiamo rappresentare a schermo tutto, altrimenti l'utente non sa più come navigare";
  - no fixed number of blocks: the app, through the model, finds the level that sums up without listing every technical component;
  - the components stay available as members, never drawn as parts.
- **No hand-made abstraction** (2026-11-06): "devi riutilizzare la stessa metodologia che userebbe l'applicazione". Levels come from the request and from functions the app runs.
- **The premise first, as a level of its own** (2026-11-06): the starting point of the source, before the aspects.
- **One interface for aspects and roles** (2026-11-06):
  - a separate roles page "fa perdere riferimento all'utente, ed è destabilizzante";
  - the whole must stay as it is, only fainter;
  - the sub-level opens and closes in place, with a transition like the lab's;
  - closing continues the exploration from the graph already expanded.
- **Only the level's own blocks in a sub-level** (2026-11-06): the prerequisites "sono rumore, sembra che sia uno dei blocchi relativi al livello sottostante".
- **The premise stands apart** (2026-11-06, on prototype NB): every later block sits below it, "anche quelli propedeutici".
- **The interface's look is prototype NB** (2026-11-06, "il tuo prototipo è perfetto"):
  - the frame of a notebook-style research app: an app bar with the work's title and whole, three soft card panels, folding rails, pills, tabs on a phone;
  - Break the Wall's own technical sheet, tokens and drawing conventions.
  
  X11 and X12 follow it.
- **Joints readable when crowded** (2026-11-06): more space between blocks, labels movable and tied to their joint by a dashed line. "Adesso ci siamo… l'unico accorgimento è il discorso dei giunti".
- **The app decides the way in.** The learner is never asked to choose a representation.
- **The technical drawing is kept**, revised: the drawing shows and the text reads; color carries the role and the stroke carries the basis; the title block is "how it was read"; tokens before views.
- **Run and reassemble are set aside**, to be designed later on top of exploration.
- **No part is taken apart during use** (2026-11-05): "non voglio più smontare un pezzo durante l'utilizzo ed attendere".
- **The lab-mode pull request is set aside** (2026-11-05): "per ora da parte". This plan does not depend on it.
- **Claude and OpenAI first, local models later** (2026-11-05): local models still have limitations, so the product is built on ChatGPT and on Claude's MCP first.
- **Usefulness is the owner's judgement.**

## Decisions this plan takes, to confirm at approval

1. **A new stored document, not a new version of the disassembly.**
   - Reason: a disassembly requires runs and a reassembly, and 3–7 parts per level. A structure has neither.
   - Effect: old disassemblies stay valid and keep their player; nothing is migrated.
2. **One source per exploration.** The index, the line verdicts and the leader lines are per source. Several sources are a later step.
3. **Two routes: Claude through MCP, OpenAI through ChatGPT.** The local route is not offered for exploration: it has not passed the gate. Its code path stays generic, so a later phase adds it with its own gate.
4. **One request, repaired once.** A source too long for one request is refused, with a message that names the limit, set by the gate (X1). Long sources split across requests come later, and every request runs before the view opens.
5. **Exploration becomes the default action** for a new source. Generating a disassembly stays reachable as a secondary action until run and reassemble are redesigned.
6. **Views A, B, C, D's "detail" control and the "space" control are not built.** E in NB's frame replaces them, and its panels fold to give the room.
7. **The top-down principle is X1's request.** The model first decides the whole, then 2–4 aspects, then the roles inside each, with their members. It is the approach the owner judged in E ("ABS dall'alto"). A source with a single concern names no aspects.
8. **Two drawn levels, the components inside.** The view draws the aspects and an aspect's roles. A role's components are members, shown inside the role, never a third drawn level.
9. **The aspect level is derived, not stored.** The model writes each role's aspect. The app computes the aspect blocks, their bonds and the sub-levels from it, so one stored document serves every level.
10. **No aspects, no aspect level.** With fewer than two aspects, the view opens on the roles, with their components inside them, and no sub-level exists.
11. **One sub-level open at a time.** Touching another aspect moves the sub-level there.
12. **Moved joint labels are kept for the session, not stored.** A moved label keeps its place while the exploration stays open. Storing it is a later step, if the owner asks.
13. **Motion is short and optional.** The sub-level grows out of its block and returns into it in about 0.3 s, and a lit joint's dash flows. Under "reduce motion" nothing moves, and the states are the same.
14. **Four aspect hues, by the aspect's order.** The request allows at most four aspects, so each has its own hue. The hue says which aspect; rings and outlines say selection; prerequisites, annotations and pieces aside keep their own colours.
15. **Choosing is a toggle.** A click on a block chooses it and lights its joints; a second click, or "back to the step", lets it go.

## Scope

Included:
- the gate on a real model, with the abstraction request;
- in `src/core`, pure and tested:
  - the structure contract, with members, aspects and the whole, and its checker;
  - the detector;
  - the source index;
  - the layout of the structure, with the placement of joint labels;
  - the levels of abstraction: the aspect level, the sub-levels and the premise;
  - the reading report;
- the structure request, through the ChatGPT route and through the MCP route for Claude;
- the store, and the app's actions to create, list and open an exploration;
- three prepared examples on the public fixtures;
- the style tokens;
- the view, in English and Italian, in paper and blueprint, with:
  - its guide, structure, card, source, index and "how it was read";
  - the sub-level in place;
  - the movable joint labels;
- retiring "take this part apart" from the disassembly player, from the bridge and from the core;
- `docs/product.md`, updated with the members, the aspects and the levels (X2);
- the card explaining only the selected element, and the link card (X21);
- the source's two views, resizable panes, the aspect card's roles, the "A parte" band and the index legend (X22–X26);
- a readable bar, and a guide strip that does not repeat the card (X27, X28);
- tests.

Not included:
- run, reassemble and the parts store;
- the local route for exploration (a later phase, with its own gate);
- several sources in one exploration;
- sub-assemblies, and long sources split across requests;
- a third drawn level (components stay inside their role);
- storing moved labels;
- AI-assisted discovery of sources;
- repositories and PDF documents as exploration sources;
- choosing among several traces by more than their coverage (the learner can pick another one, X13);
- telling a partial trace from a partial extraction (research, open question). The reading report shows the facts, and the entry rule does not use them;
- views A, B and C, and D's "detail" control;
- an aspect's own central idea: the contract gives an aspect only an id and a name, and adding one changes the contract and the gated request. It is decided after the owner sees the cut card (X21);
- rewriting the request or the prompts to change the card's text;
- points for aspects, annotations, references or procedures (they would need a different request);
- storing pane sizes per exploration (they are kept per device, as the player's are);
- a popover for the card next to the selected block (see "What changes from v8");
- asking the model for an exploration title;
- any new dependency.

## Preconditions

- **P-20261103-lab-mode is set aside** (owner, 2026-11-05). Its plan is `blocked`, its pull request stays open and unmerged, and this plan depends neither on it nor on `feature/guided-reading`.
- **Branch.** `feature/exploration`, from `origin/main` (the local `main` is updated first).
  - Push, pull request and merge only on the owner's confirmation when reached.
  - If the lab-mode PR is merged later, its guided view's own "take apart" goes with X19's rule.
- **The untracked copies are removed by the owner before X2.**
  - About 50 untracked files named "… 2.ts", "… 2.tsx" and "… 2.css" sit in `src/` and `tests/`, copies made by a sync tool.
  - `tsc` includes both folders, and `npx tsc --noEmit` fails today on them (for example `tests/split-pane.test 2.tsx`). So `npm run check` cannot pass while they exist.
  - Deleting them is the owner's action.
- **No new dependency.** Zod, React, hand-written SVG, `Element.animate` and the existing markdown renderer are enough.
- **Private material stays out.** Tests, fixtures and examples use the public fixtures only. Gate results on private sources are described by structure only.
- **Usage on Claude and OpenAI is the owner's choice** (2026-11-05), within each run's stated cost:
  - Claude runs use the owner's plan;
  - ChatGPT runs go through the gate's budget ledger.
  
  A private source goes to OpenAI only after the owner confirms it for that run, as `--private-to-chatgpt` requires. A private source goes to Claude only as this conversation already does.

## Tasks

### Phase `gate`

**X1. The structure-first request on Claude and OpenAI, until it passes.** Private harness `.local/experiments/exploration/gate/`.
- **Done under v4:**
  - **Run 0** (2026-11-05, [research section 7](../../research/R-20261104-exploration-experience.md#7-the-gate-first-run-2026-11-05-plan-x1)). Claude was 6/6 valid, but criteria 2 and 3 failed. ChatGPT (`gpt-6.1-sol`) was 3/3 valid on the public sources.
  - **R1** (section 8), on both routes and six sources. The forced bond and the runbook's entry were fixed. Still failing: the explainer had too many blocks, and the README had no pipeline nucleus.
  - **The abstraction study** (section 9) on the explainer, Claude only: four principles, all valid. The owner judged the top-down one in E.
- **The routes**, unchanged:
  - **Claude:** fresh agents with no context of the analysis, one per source, each given only the request and returning only the JSON;
  - **OpenAI:** the app's ChatGPT route, through the private runner `gate/chatgpt.mjs`, inside Electron with the app's own session.
- **A1, the abstraction run.** The request is R2's rules plus the top-down principle, MEMBERS, aspects and the whole (`gate/abstraction.mjs`, approach `dall-alto`), with one change: a source with a single concern names no aspects (`[]`).
  - It runs on both routes and all six sources.
  - The answers are checked with `node gate/check.mjs <run> --view` and loaded into prototype E for the owner.
  - **At most one more revision, A2**, which changes the rules, not the sources or the schema's shape. Then the stop.
- **Costs, stated before each run:**
  - Claude: six agents on the owner's plan.
  - ChatGPT: three public requests, plus three private ones. The private sources go to OpenAI only on the owner's confirmation for that run.
  - The ledger has used 6 public and 3 private requests (run 0 and R1). v5 raises its budget to 15 public and 12 private, enough for A1 and A2 with one retry each.
- **Pass criteria:**
  1. every answer is valid;
  2. no bond the owner judges forced;
  3. the README's two nuclei are found, as nuclei of roles or as aspects;
  4. each trace is one the source really walks;
  5. points inside their part ≥ 90%;
  6. the view reads in E: the owner does not judge the aspects, the roles or the layers too fragmented. Roles per aspect and members per role are recorded beside the explainer's top-down result;
  7. aspects only where the source has several concerns, and none the owner judges forced. A short argument (Mill) may have none;
  8. the premise rule finds the source's starting point, or nothing when the source states none. The owner judges it.
  
  The owner judges 2, 4, 6, 7 and 8 by looking in E. A route passes on its own: if only one passes, the plan goes on with that one and the other waits.
- Also recorded:
  - per source, route and run: time, size, the shape metrics;
  - the longest source that passed on each route, which sets the request limit of X7;
  - the comparison with today's extractor: forced joints, coverage, nuclei.
- Evidence: a section of the research per run, by structure only for the private sources.
- **A1 ran on 2026-11-06** ([research section 10](../../research/R-20261104-exploration-experience.md#10-the-gate-run-a1-2026-11-06-plan-v5-x1)).
  - Criterion 1: Claude 6/6 valid. ChatGPT 5/6 at first (the runbook bonded a procedure to a part), then 6/6 after one repair sent as the app does.
  - Criterion 3 is met on both routes. Criterion 5: 91–100%.
  - Criteria 2, 4, 6, 7 and 8 wait for the owner's look in NB.
  - Ledger: 9/15 public, 7/12 private.
  - **The owner's look (2026-11-06):**
    - on the README, ChatGPT mixes the problem with the application's architecture, and Claude is closer, but three bodies are expected: the problem, the application with its components, the project pipeline;
    - the explainer should approach the hand extraction;
    - the other sources were not commented on.
  - **A2 is prepared** (research section 10): the problem apart from what answers it, and a whiteboard grain.
  - **A2 ran on the README only** (owner, 2026-11-06), on both routes.
    - Both answers are valid. On Claude, criterion 5 fails at 79%.
    - The problem became the premise, with product and project process as two aspects. The owner judges it.
    - The other sources follow one at a time.
    - Ledger: 9/15 public, 8/12 private.
  - **The owner's rule on labels:** a joint's label always names a relation, never a bare count. It belongs to X4 (layout) and X15 (labels).
- **Gate.** If A2 still fails on both routes, stop, and revise the plan toward a two-request extraction: the roles with their members first, then the links and traces between the accepted roles.
- **Passed (owner, 2026-11-06).** The owner judged criteria 2, 4, 6, 7 and 8 on A1 and A2 and closed the gate: "vanno bene A2 … ho valutato tutto".
  - Both routes pass.
  - The request X7 ports is A2's.
  - Accepted residual: on the README's A2, Claude kept 79% of points inside their part (criterion 5). "How it was read" shows that measure to the learner.
  - The A2 rules ran on the README only. The other sources are checked again in X20.3 and X20.4, on explorations the app generates.

### Phase `core`

**X2. The structure contract** (`src/core/exploration.ts`).
- `explorationSchema`, `schemaVersion: 1`, holds:
  - `id`, `revision`, `kind` (prepared or generated);
  - `generation` (provider, runtime, model, createdAt, as for disassemblies);
  - `title`, `language`, `whole`;
  - one `source`;
  - `start`;
  - `aspects`: id, name (none, or 2–4);
  - `parts`: id, kind, `on`, `aspect` (an aspect id, or none), name, role, cites, points (text, mark, cites), members (id, name, does, cites);
  - `links`: from, to, class (bond, prerequisite, reference, group), label, basis (declared, interpreted), cites;
  - `traces`: question, steps (text, parts, cites).
  
  Citations are `{ from, to }` line ranges of the source. No quote is stored.
- Limits come from the gate's request:
  - name 48, role 110, point 130, label 28, member "does" 90, whole 160;
  - at most 40 parts, 4 points, 14 members per part, 4 aspects, 3 traces, 8 steps.
- `checkExploration(x)` returns findings with exact paths, for repair. It checks:
  - unique ids, and member ids unique within their part;
  - every cite in range, members' cites included;
  - every annotation on a part;
  - bonds only between parts;
  - prerequisites only from a prerequisite;
  - traces through real parts, never through a member;
  - start is a part;
  - 2–4 points for parts and prerequisites;
  - members only on parts and prerequisites;
  - every part's aspect is one of the aspects; aspects only as none or 2–4.
  
  Points outside their part are reported as a measure, not as an error.
- `docs/product.md`, section "The structure of a source", gains members, aspects, the whole and the derived levels.
- Acceptance (unit tests):
  - each rule has a failing case with its path, on small hand-written cases;
  - a valid hand-written case passes, with and without aspects;
  - a disassembly file is rejected;
  - an exploration file is rejected by `validateDisassembly`.

- **Done (2026-11-06):** `src/core/exploration.ts` (`explorationSchema`, `checkExploration`, `validateExploration`, `pointsInside`, `EXPLORATION_LIMITS`); `tests/exploration.test.ts` with the shared case `tests/explorations.ts`, 14 tests; `docs/product.md` gains "Levels of abstraction". Kinds and classes are stored in English (`prerequisite`, `bond`, `declared`). Automated test only.

**X3. The detector** (`src/core/exploration-shape.ts`).
- `shapeOf(x)` returns:
  - the nuclei (connected components of the bonds between parts), largest with the start first, then in source order;
  - each nucleus's layers;
  - the loose parts, the prerequisites (with the part they open), the annotations (with their part), the pieces aside;
  - each trace's coverage of the main nucleus, and the chosen trace: the one that covers most (ties in source order);
  - the entry with its reason, as a code.
- **Layers** follow the flow: the longest path from the parts nothing enters, when the bonds form no cycle. Otherwise, breadth-first from the start.
- **Entry rule**, with named constants:
  - no nucleus → the source;
  - the chosen trace covering ≥ 0.6 of the main nucleus → the trace;
  - otherwise → the layers.
  
  Two nuclei of similar size (≥ 0.6) are reported in the reason.
- With aspects, a nucleus takes the name of the aspect most of its roles belong to.
- Acceptance (unit tests on small hand-written cases):
  - with three traces, the one covering most is chosen, whatever its position;
  - a cyclic nucleus layers from its start;
  - an acyclic chain layers along its flow;
  - two components give two nuclei;
  - a part with no bond is loose;
  - each entry branch is reached;
  - the result is deterministic.

- **Done (2026-11-06):** `src/core/exploration-shape.ts` (`shapeOf`, `nucleusName`, `ENTRY_RULE`); `tests/exploration-shape.test.ts`, 10 tests. Automated test only.

**X4. The source index and the layout** (`src/core/source-index.ts`, `src/core/exploration-layout.ts`).
- **The index:**
  - read from Markdown headings, ignoring code fences;
  - at most two depths;
  - a lone first-level heading on top is the title;
  - text before the first section becomes an opening section;
  - each section knows its extent and its own lines.
  
  Plain text with no heading gives no index, and the view hides the column.
- **The layout** positions:
  - each open nucleus's layers as rows, with a labelled strip per layer and an optional empty strip for the next layer;
  - closed nuclei as islands;
  - the premise (X5) on a row of its own at the top, in a band of its own, aligned so it never moves between steps (owner, 2026-11-06);
  - prerequisites above the part they open, below the premise, never overlapping;
  - node heights that grow with the members shown inside them.
  
  Spacing is E's, as named constants. The whole has wider gaps than the sub-level.
- **Joint labels**, placed by the same function:
  - each label starts at its joint's midpoint;
  - it tries positions around the midpoint, nearest first, and takes the first that covers no block and no label already placed;
  - otherwise it stays on the midpoint;
  - a label has an offset from its midpoint, so a moved label follows its joint when the layout changes;
  - each label carries the joint's way on screen (→ ← ↓ ↑), from the block that acts to the one acted on;
  - a lit label (X15) is placed first, at its own size, and the others go around it.
- Positions are numbers, so the renderer only draws.
- Acceptance (unit tests):
  - headings inside fences are ignored;
  - the opening section appears only when it has text;
  - no two nodes overlap;
  - every visible part is placed;
  - strips cover their rows;
  - with a premise, every other block lies below the premise's band, and the premise's position is the same at every step;
  - the empty strip counts the parts of the next layer;
  - on the three prepared examples and a crowded hand-written case, no label covers another, and none covers a block where a free position exists;
  - a joint drawn right to left carries ←, one drawn downward ↓.

- **Done (2026-11-06):** `src/core/source-index.ts` (`sourceIndex`, `sectionAt`) and `src/core/exploration-layout.ts` (`layoutOf`, `jointGeometry`, `placeLabels`, `SPACING`); `tests/source-index.test.ts` and `tests/exploration-layout.test.ts`, 14 tests. The opening section has no title in the core: the renderer names it. Automated test only.

**X5. The levels of abstraction** (`src/core/exploration-levels.ts`), pure functions of the stored exploration.
- `aspectLevel(x)`, when `x` names at least two aspects:
  - one block per aspect, in the source order of its first role, whose members are its roles; roles with no aspect go to one "other" block;
  - bonds between roles of different aspects become one bond between the aspects. It keeps each bond (which role does what to which), is declared when any of them is, and keeps their cites. Its label is the first bond's and how many more ("fornisce gli esiti +1"), never a bare count (owner, 2026-11-06);
  - group links are dropped;
  - prerequisites point at the aspect of the part they open, and annotations follow their part to its aspect.
- `subLevel(x, aspect)`:
  - the aspect's roles, their annotations and the links among them;
  - no prerequisite (owner, 2026-11-06): they stay on the whole, where they open the level.
- **Every block is drawn** (`levelShape`): in a sub-level, roles with no bond among them join the first layer. A level with no bond at all is laid out in rows of three, in source order. The aspect level takes the same rule when no bond joins its aspects (the README, A1).
- `premiseOf(x, index)`:
  - the earliest-cited prerequisite, when no part opens in its top section of the source (with no index: when it comes before every part);
  - otherwise none.
  
  It is the guide's first step, alone.
- Acceptance (unit tests on small hand-written cases):
  - two aspects with three cross bonds give one aspect bond holding all three, labelled by the first and "+2", declared when one of them is;
  - aspects with no bond between them are all drawn;
  - a prerequisite of a role points at that role's aspect;
  - fewer than two aspects give no aspect level;
  - a sub-level holds the aspect's roles and annotations and no prerequisite;
  - a sub-level with no bond places every role;
  - a prerequisite in a section that also opens a part is not a premise;
  - the result is deterministic.

- **Done (2026-11-06):** `src/core/exploration-levels.ts` (`aspectLevel`, `subLevel`, `levelShape`, `premiseOf`, `OTHER_ASPECT`); `tests/exploration-levels.test.ts`, 14 tests. A trace's steps are mapped onto aspects at the aspect level and filtered to the aspect's roles in a sub-level, for X13. Automated test only.

**X6. The reading report** (`src/core/reading-report.ts`).
- **A verdict for every counted line.** Counted lines exclude blank lines, headings and code-fence markers. The verdicts:
  - main nucleus;
  - another aspect;
  - prerequisite;
  - annotation;
  - aside;
  - only in the source's question;
  - not extracted.
  
  An annotation outranks its part, and a part outranks a trace. A member's lines take its role's verdict.
- **Groups by top section**, with used and counted lines.
- **The readings**, as codes and numbers (the renderer writes the words):
  - coverage, and the sections left out entirely;
  - shape: nuclei and sizes, aspects, roles and members, prerequisites, annotations, pieces aside;
  - basis: declared and interpreted counts, and the interpreted links;
  - entry, with the trace's coverage;
  - order: the share of dependent pairs whose dependency comes first in the document, and the number of sections the main nucleus spans.
- A section a trace walks counts as read, and is marked with the trace.
- No accuracy score.
- Acceptance (unit tests):
  - the counts add up to the counted lines;
  - a section cited only by a trace is not "not extracted";
  - a line cited only by a member takes its role's verdict;
  - the order agreement is 1 for a chain written in flow order and 0 for the reverse;
  - the interpreted links are listed apart.

- **Done (2026-11-06):** `src/core/reading-report.ts` (`readingReport`, `countedLines`, `VERDICTS`); `tests/reading-report.test.ts`, 9 tests. Automated test only.

### Phase `generation`

**X7. The structure request** (`src/core/exploration-generation.ts`).
- **The request:**
  - the instructions of the request that passed X1 (A1 or A2), ported in their rules;
  - the JSON schema, with members, aspects and the whole;
  - the source in `formatSourceBlock` form.
- `acceptExploration(raw, input)`:
  - parses the answer and maps ranges to `{ from, to }`;
  - runs `checkExploration`;
  - returns findings for one repair request;
  - limits texts with the existing shortening step.
- A source above X1's limit is refused before the request, with a finding that names the limit.
- Acceptance (unit tests):
  - a valid answer becomes a valid exploration, with its members and aspects;
  - a bad member cite yields a repair finding with its path;
  - an over-long source is refused;
  - the instructions and the schema are stable (snapshot).
- **Done (2026-11-06):** `src/core/exploration-generation.ts` (`explorationRequest`, `explorationInstructions`, `explorationJsonSchema`, `acceptExploration`, `fromDraft`, `sourceFindings`, `EXPLORATION_SOURCE_LIMIT`, `generatedExplorationId`); `tests/exploration-generation.test.ts`, 6 tests, with a snapshot of the instructions and the schema.
  - The instructions are A2's, byte for byte in both languages (compared with `gate/abstraction.mjs` before the port). The answer keeps the shape that passed the gate (`prereq`, `cls`, `[from, to]`, `null`); the app maps it to the contract, and a finding on a link's class names `cls`, as the answer does.
  - The limit is 52,000 characters: the explainer (955 lines, 51,125 characters) is the longest source that passed X1 on both routes.
  - A text over a contract limit is worded as a length, so the existing shorten request fixes it after the repair. Automated test only.

**X8. The store and the app's actions** (`src/desktop/`).
- **Storage.** An `ExplorationStore`, one directory per exploration, as the disassembly store does. Invalid files are counted, never shown.
- **The generator** gains `explore(request)`:
  - it runs on the ChatGPT route, with progress and cancel; the local route is refused for exploration with a code, until its own phase;
  - one repair at most;
  - it saves only after the final check.
- **IPC.** Preload and main expose:
  - `explorations:list`;
  - `explorations:find`;
  - `exploration:start`.
- Acceptance (unit tests with a fake completer):
  - an answer is checked, repaired once and saved;
  - a second failure saves nothing and reports the findings;
  - cancel stops the request;
  - the store round-trips;
  - an invalid file is skipped and counted.
- **Done (2026-11-06):** `src/desktop/exploration-store.ts` (`ExplorationStore`); `Generator.explore` in `src/desktop/generator.ts`; IPC `exploration:start`, `explorations:list`, `explorations:find` in `main.ts` and `preload.ts`; `ExplorationRequest`, `ExplorationResult` and the bridge methods in `src/core/provider.ts`; the reasons `exploration-local` and `exploration-too-long`, worded in both languages. `tests/exploration-store.test.ts`, 8 tests with a fake completer.
  - The repair step (`withRepair`) now takes an exploration's findings as well as a disassembly's; cancel uses the existing `generation:cancel`. Automated test only: no request reached ChatGPT.

**X9. Claude writes an exploration** (`src/mcp/`, `src/desktop/incoming.ts`).
- Two tools, beside the disassembly tools:
  - `start_exploration` replies with the instructions, the JSON schema and the numbered source (X7's request);
  - `submit_exploration` hands the answer to the app through the local entry point.
- The app runs `acceptExploration`:
  - findings go back to the assistant for one repair;
  - a valid exploration is saved with `generation.provider: 'assistant'` and opened.
- The tool descriptions steer "take apart" and "explore" to exploration. The disassembly tools stay for now.
- The Claude Desktop extension is rebuilt by its existing script. Publishing it is an external action, outside this approval.
- Acceptance (unit tests, as the existing MCP tests do):
  - start returns the request;
  - a valid submission is saved and opened;
  - an invalid one returns findings with paths;
  - a second invalid one saves nothing;
  - the local entry point stays off unless the learner turns it on.
- **Done (2026-11-06):** `src/mcp/exploration.ts` (`ExplorationWriter`: the request, pages for a long source, two attempts); `start_exploration` and `submit_exploration` in `src/mcp/server.ts`, with `read_source` reading whichever was started last; the entry point's `explore` message in `src/desktop/incoming.ts`, with the findings as data; `exploreFromAssistant` in `src/desktop/assistants.ts`, wired in `main.ts` (saved, then sent to the window as `studio:exploration`).
  - The steering: the open tool, the server's instructions and `start_disassembly` send "take apart" and "explore" to `start_exploration`, and the `break` prompt now uses it. The manifest (`scripts/zip.mjs`) lists the two tools and `read_source`. The existing tests of the tool list and the prompt are updated to this.
  - `tests/mcp-exploration.test.ts`, 7 tests against a real local entry point. `npm run build` rebuilds the extension; it is not published. Automated test only: no Claude client was used.

**X10. Three prepared examples** (`src/fixtures/explorations/`), on the public fixtures `importer-signals`, `mill-harm` and `atlas-release`.
- Hand-written, original, in English and Italian.
- They are the app's first content and the tests' material.
- The importer (code) names aspects and members, so it opens on the aspect level with sub-levels.
- Mill is the argument case: one concern, so no aspects. Its supports are bonds and its limit an annotation, and it opens on the roles.
- Acceptance (unit tests):
  - all six files are valid (X2);
  - their shapes, levels and reading reports are recorded (nuclei, aspects, premise, entry, coverage), so a change in the detector, the levels or the report shows (X3, X5, X6).
- **Done (2026-11-06):** `src/fixtures/explorations/` (six files) and `src/fixtures/explorations.ts` (`loadPreparedExplorations`); `tests/prepared-explorations.test.ts`, 6 tests.
  - The importer: two aspects (the round and its signals, who reads them), seven roles in one nucleus, the premise "silence", gaps as annotations; it enters by the winter night, the trace that walks every role.
  - Mill: no aspects, five roles joined by bonds, the maturity limit as an annotation; no premise, entry by layers.
  - The runbook: two aspects (the chain, the person releasing), the release's identity by digest as the premise, entry by its first trace.
  - The Italian and English files share ids, cites, links and traces (tested). Automated test only; the owner has not looked at them.

### Phase `style`

**X11. Tokens for exploration** (`src/renderer/styles.css`, paper and blueprint; the view's own rules go in a new `src/renderer/exploration.css`, which uses tokens only).
- Role colors:
  - main nucleus;
  - another aspect;
  - prerequisite;
  - annotation;
  - aside;
  - the guide's step.
- Stroke styles: declared links solid, interpreted links dashed.
- The leader line, and the dashed leader of a moved joint label.
- The layer strip in three states: seen, active, next.
- The sub-level: its frame, the beam to its block, the faded whole, the highlighted block.
- Four aspect hues, each a tone and a wash, in paper and blueprint (from the colour study).
- A lit joint: the accent, a flowing dash, a lit label; the joints stepped back.
- Motion: one duration and one easing as tokens, off under "reduce motion".
- Reading typography for the card and the source: body font, measure, line height. Monospace stays for code and member names only.
- No sheet frame around the window.
- Acceptance:
  - `tests/theme.test.ts` gains the new pairs, and both themes reach WCAG AA for every text pair, the faded whole's text excepted (it is not meant to be read until it is back);
  - a role is never told by color alone: each also has a label or a shape, checked in the view tests.
- **Done (2026-11-06):** the tokens in `src/renderer/styles.css`, in both themes: the role inks and grounds (`--x-main`, `--x-other`, `--x-prereq`, `--x-note`, `--x-aside`, `--x-step`), the layer strip, the lit joint, the leader, the four aspect hues with their washes (`--a1`…`--a4`, the colour study's values), and, shared, the dashes, fading, motion and reading type. Under "reduce motion" `--x-dur` and `--x-flow` are `0ms`.
  - `src/renderer/exploration.css` holds the view's rules under the `xp-` classes the view phase will use. It is imported by `main.tsx`; nothing renders it yet.
  - The shapes that repeat each kind are in the stylesheet: dashed prerequisite, flagged annotation, plain aside. The check that no role is told by colour alone stays with the view tests (X12–X16), where the roles are drawn.
  - `tests/theme.test.ts` gains the exploration pairs (WCAG AA in both themes), 3:1 for the strokes and hues as graphics, and a check that `exploration.css` uses tokens only and that motion stops; 5 new tests. Automated test only: nothing is visible until the view.

### Phase `view`

**X12. The view and its shared state** (`src/renderer/exploration/`).
- **State:**
  - the guide (`whole` or `question`) and its position;
  - what is explored, the selected point or link, and the selected section;
  - the open sub-level, the role selected in it, the roles showing their components, and the selected component;
  - the moved labels, and the chosen block whose joints are lit;
  - which panels are folded;
  - whether "how it was read" is open.
- **Panels**, as in prototype NB (`nb.html`): index | structure, guide step, card | source.
  - Each is a card panel with its own header.
  - The index and the source fold to a rail.
  - Below 900 px, one panel at a time is chosen by tabs, and the leader line is hidden.
  - The app bar holds the work's title, with its whole as the subtitle.
- **The structure** draws X4's layout in SVG and HTML:
  - nodes as buttons with their name;
  - a role's or an aspect's members glimpsed on hover;
  - strips;
  - annotations as a badge on their part;
  - islands for closed nuclei.
  
  It opens on the aspect level when the exploration has one (X5), otherwise on the roles. Each aspect's hue (X11) marks its block and its roles: a wash and a stripe on the left.
- **The source** uses `SourceDocument`, with a gutter colored by role.
- **The leader line** joins the selection to its lines, and follows when the source or the structure scrolls.
- A click on a line selects the narrowest part that cites it, or else its section.
- Acceptance (component tests on the prepared examples):
  - the importer opens on its aspects, Mill on its roles;
  - selecting a part highlights exactly its lines;
  - selecting a point highlights exactly the point's lines;
  - a click on a cited line selects its part;
  - folding a panel keeps the state;
  - an aspect's roles carry its hue in the sub-level, and a prerequisite never takes one.
- **Done (2026-11-06):** `src/renderer/exploration/` holds the view:
  - `model.ts`: the level drawn on the whole, the premise, the hues, the guide's steps and what each shows; pure functions;
  - `state.ts`: the one reducer;
  - `Graph.tsx`: one level drawn;
  - `Panels.tsx`: the card, the index and the source;
  - `Report.tsx`;
  - `ExplorationView.tsx`: the bar, the panels, the step strip, the sub-level and the leader line.
  
  Its text is in `src/renderer/i18n/x-it.ts` and `x-en.ts`, reached as `t.x`; its layout rules are in `exploration.css`, still tokens only. Parts set apart (references, procedures, loose roles) sit in a tray under the structure. `tests/exploration-view.test.tsx` runs on the prepared examples, with 31 tests for X12–X17.
  - Seen in the browser preview at 1280×800, in paper and blueprint and at phone width: there were no console errors, and the leader line reached the source.
  - At 800 px high the structure gets about a third of the column, under the step strip and the card. This is for the owner's look in X20.2.

**X13. The guides.**
- **"The whole source":**
  - the premise first, alone, when X5 finds one. It keeps its own band above the rest at every later step, and every other block, prerequisites included, sits below it;
  - then one layer of the main nucleus at a time, then each other nucleus whole. At the aspect level these are the aspect level's own nuclei and layers;
  - a change of aspect announced in a banner, which names the only reference that touches the new nucleus, if any;
  - a prerequisite appears one layer before the part it opens;
  - the new parts are listed as "entering now".
- **"All the layers"** shows the whole level at once, at any point, and returns to the guide's step.
- **"A question of the source":**
  - the chosen trace first. When the source walks several, the others are listed by their question and can be chosen;
  - the question, the step's sentence and its parts lit;
  - at the aspect level, a step lights the aspects that hold its parts; in an open sub-level, it lights its roles;
  - at the end, "now the whole source", with the parts visited outlined.
- **The step strip** sits between the structure and the card: the question or layer, the sentence, round arrows.
- **Exploring off the guide** dims the strip and shows "back to the step", which restores the step and the source's position.
- Keyboard:
  - arrows step;
  - Escape returns.
- Acceptance (component tests):
  - every layer and step is reached, the premise first;
  - "all the layers" shows every part of every nucleus, and returns to the step;
  - the banner appears at a change of nucleus;
  - exploring leaves the guide's position unchanged;
  - "back to the step" restores it;
  - a question's step lights the aspects of its parts;
  - the source view (no nucleus) has no guide.
- **Done (2026-11-06):** the guides are in `model.ts` (`shown`, `guided`, `crossing`) and in the step strip.
  - The aspect level has its own shape, so it picks its own trace. On the importer that is "the morning catalogue has nothing new", not the winter night chosen at the roles level (X10). The other questions are listed under the step.
  - The banner is tested on Mill with one bond removed, since no prepared example has two nuclei.

**X14. The sub-level in place.**
- **Opening.** An aspect's toggle, a click on one of its roles in the card, or "open «X»: n roles" lifts the aspect's sub-level (X5) out under its block.
  - The whole keeps every position and fades.
  - The opened block stays highlighted.
  - A beam joins the block to the sub-level.
- **Motion.** The sub-level grows out of its block's rectangle and plays back into it on closing. It uses FLIP with `Element.animate`, about 0.3 s, as in the lab's stage. Under "reduce motion" nothing moves.
- **Inside.**
  - All the aspect's roles show at once, without prerequisites.
  - A click on a role selects it and shows its components in place.
  - A component has its own card, its cited lines and a leader line.
- **Orientation.**
  - While it is open, the step strip says "inside «X»" and offers "close and return to the step". The guide waits on its step.
  - Touching another aspect moves the sub-level there.
  - A source line of another aspect's role moves it to that role.
  - Changing guide closes it.
- **Closing** returns the selection to what it was before opening, on the same step.
- Keyboard: Escape closes the sub-level before it returns from exploring.
- Acceptance (component tests on the importer):
  - opening and closing leave every position of the whole identical;
  - the step after closing is the step before opening;
  - the sub-level holds the aspect's roles and no prerequisite;
  - touching another aspect moves the sub-level;
  - a line of another aspect's role opens that role;
  - a component lights exactly its lines;
  - with "reduce motion" (a stubbed `matchMedia`) no animation is started.
  
  The motion itself is checked in X20.2, since the test environment has no layout.
- **Done (2026-11-06):** the sub-level is in `ExplorationView.tsx`.
  - It is placed under its block, with the beam, and the whole fades block by block while the opened block stays.
  - The motion is FLIP with `Element.animate`: 320 ms to grow, and 80% of that to play back; no animation under "reduce motion".
  - Tested on the importer. In the preview it opens in place; the motion itself waits for X20.2.

**X15. Joints and their labels.**
- Each joint's label is a short tag placed by X4, above its joint, on the whole and in the sub-level.
- **Who does what** (owner, 2026-11-06):
  - the label holds the verb and an arrow the way the joint runs, drawn in the hue of the block that acts;
  - pointing at a label marks its two blocks, "chi" on the one that acts and "a chi" on the one acted on;
  - the full sentence, who → what → whom, is in the tooltip and in the card.
- **A chosen block lights its joints:**
  - its joints flow in the accent and their labels light;
  - a joint that stands for several bonds lists their verbs, bulleted, each with its arrow;
  - the blocks at their other end are outlined, and every other joint and label steps back;
  - choosing the block again restores the view.
- **Moving.**
  - The reader drags it with the pointer.
  - A focused tag also moves with the arrow keys; while a tag has focus, the arrows move it and do not step the guide.
  - A dashed leader ties it to its joint's midpoint whenever it is away from it.
  - A double click, or Home, puts it back.
- A moved tag keeps its place while the exploration stays open, across steps and sub-levels. It is not stored.
- Moving a tag changes no selection and nothing in the structure.
- Acceptance (component tests):
  - a pointer drag moves the tag and the leader's end;
  - the leader appears only when the tag is away;
  - a double click puts it back;
  - a drag does not change the card;
  - a moved tag keeps its place after a step;
  - the arrow keys move a focused tag and leave the guide's step unchanged;
  - choosing a block lights exactly its joints, and choosing it again lights none;
  - pointing at a label marks its acting block "chi" and the other "a chi";
  - a label's arrow matches its joint's way.
- **Done (2026-11-06):** labels are in `Graph.tsx`.
  - Each is placed by `placeLabels` and moved by pointer or by the arrow keys (8 px a press). A double click or Home puts it back.
  - The way comes from `jointGeometry`, and "chi" and "a chi" show while a label is pointed at or focused.
  - A joint standing for several bonds lists its verbs when lit. Moved labels live in the view state only.

**X16. The card and the index.**
- **The card:**
  - the name and kind, and its aspect in a sub-level;
  - the lead;
  - the points with their marks (→ = ⚠), each selectable;
  - the annotations;
  - folded, with their count (owner, 2026-11-06: the explanation leads): a role's components, or an aspect's roles, each selectable;
  - folded, with its count: "why it is linked", each joint with its basis and its bonds as who → what → whom, selectable;
  - the cited lines, folded.
- **A component's card:** what it does, its role, the other components of the role, its lines.
- **A section no part cites** shows its own card: "not extracted", and its lines.
- **The index:**
  - sections in order;
  - one dot per part, filled once on screen;
  - the sections the guide touches now marked;
  - subsections open under the selected section;
  - "not extracted", and a trace's question where it walks.
  
  On a narrow window it opens on request.
- Acceptance (component tests):
  - the components or roles and "why it is linked" are folded when a card opens;
  - a point, a link and a component light their own lines;
  - a section with no part shows "not extracted";
  - a section a trace walks shows its question;
  - the dots follow the guide.
- **Done (2026-11-06):** the card and the index are in `Panels.tsx`.
  - A role's card says "ruolo" at every level, and an aspect's card says "aspetto".
  - At the aspect level, a link from a prerequisite to a role shows as the joint to that role's aspect.
  - The dots are tested on the bakery, since Mill has no index.

**X17. "How it was read".**
- A button in the bar opens it in place of the three columns, and the same button returns.
- **Content:**
  - who extracted (prepared, or the model and route);
  - the number of lines and the share in the map;
  - the grid, one row per section and one cell per line, where a cell opens its line;
  - the legend with counts;
  - the five readings in words, with the interpreted links listed and selectable.
- Acceptance (component tests):
  - the counts equal X6's;
  - a cell opens its line in the view;
  - an interpreted link opens on the card;
  - the texts exist in both languages.
- **Done (2026-11-06):** `Report.tsx` words X6's `readingReport` and adds the points-inside measure to the order reading. A cell or an interpreted link closes the report and opens its line or link in the view.

**X18. A source opens as an exploration** (`App.tsx`, `Library.tsx`, `Studio.tsx`, `i18n`).
- The library lists explorations and prepared examples beside disassemblies, with what each is.
- A new source's primary action is "explore", with the route and model chosen as today. Generating a disassembly stays as a secondary action.
- Progress, cancel and a failure with its findings follow the existing generation screen.
- Interface text is in English and Italian, out of `src/core`.
- Acceptance:
  - `i18n.test` passes;
  - a component test opens a prepared exploration from the library;
  - a generation with a fake route ends in the view;
  - an old disassembly still opens in its player.
- **Done (2026-11-06):**
  - `App.tsx` loads the prepared explorations and the stored ones, opens an assistant's exploration as it arrives, and shows the view.
  - `Library.tsx` lists the explorations first, each labelled prepared, generated or written by the assistant.
  - In `Studio.tsx`, "Esplora la fonte" is the primary action and the disassembly is secondary. It needs one source, and the local route is refused with its reason.
  - The tests: `tests/exploration-app.test.tsx` and two Studio tests (a fake route ends in the view; a refusal shows its findings). `i18n.test` passes.

**X19. Retire taking a part apart during use.**
- Removed:
  - the "take apart" action from the disassembly player (`TakeApart`, `takeApart`, its progress and its error);
  - `expandPart` from the bridge and the preload;
  - the `disassembly:expand` handler;
  - `expandPart`, `acceptExpansion`, the expansion request and their tests from the core.
- Kept: the `expansions` field of the disassembly contract, so stored disassemblies stay valid and the levels already taken apart still open. Their origin line stays.
- No stored file changes.
- Acceptance:
  - `npm run check` passes with the expansion tests removed;
  - a component test shows a part with no sub-parts and no "take apart" action;
  - a stored disassembly with expansions still loads and opens its levels;
  - no IPC channel named `disassembly:expand` remains (static check in a test).
- **Done (2026-11-06):** the following are removed:
  - from the player and the part card: `TakeApart` and its state;
  - from the bridge and the preload: `expandPart`;
  - from `main.ts`: the `disassembly:expand` handler;
  - from the generator: `Generator.expand`, with its `carry` argument;
  - from the core: the expansion request (`expandPart`, `acceptExpansion`, `buildExpansionInput`, `expansionJsonSchema`, `expansionInstructions`);
  - `ExpansionRequest` and `ExpansionResult`, the reason `part-not-divisible` and its texts;
  - the `--expand` option of `eval/runner.ts`.
  
  What stays:
  - the contract's `expansions`, `isExpansionOf`, `carryOver` and `ProgressStore.carry`, for stored revisions;
  - the eval ledger's old expansion entries, which the budget still reads.
  
  The tests: `tests/disassembly-drafts.ts` gains `takenApart`, which builds a stored revision for the tests; `depth.test` keeps its stored-revision tests and drops the on-demand ones; the player tests check that no action is offered and that an expanded disassembly opens its levels; a static test finds no channel or function left.

### Phase `verify`

**X20. Checked and witnessed.**
1. `npm run check` and `npm run build` on macOS; CI on macOS and Windows after the owner confirms a push.
2. Integration on the built app (`npm start`) with a scratch data folder, at 1280×800, in both themes and both languages, recorded as a witnessed flow:
   - the three prepared examples;
   - both guides, the premise first;
   - opening, moving and closing a sub-level, with its motion, and with "reduce motion";
   - moving a joint label, choosing a block and reading its lit joints;
   - exploring and returning;
   - the index;
   - "how it was read".
3. One generation end to end on a public fixture through each route that passed X1, recorded as integration checks:
   - ChatGPT in the app;
   - Claude through MCP, in Claude Desktop or Claude Code.
4. **The owner's look**, on their device, at explorations of their own sources generated by the app. Their judgement is recorded:
   - Is the way in right, and is the premise the source's starting point?
   - Do the aspects and roles sum the source up, or is anything forced?
   - Does the sub-level keep them oriented?
   - Does "how it was read" tell them how far to trust the map?
- **X20.1 (2026-11-06):**
  - local: `npm run typecheck` passes, `npx vitest run --dir tests` 41 files and 586 tests pass, and `npm run build` passes.
  - `npm run check` fails only on the tests of the private working copy `.local/worktrees/guided-source-object-prototype` (7 files; 0 failures outside it), as the verification strategy expects.
  - CI on macOS and Windows: not run, since it waits for a push the owner confirms.
- **X20.2 (2026-11-06), automated on the built app.** The app is driven over the DevTools protocol, with a scratch data folder and the script in the scratchpad: paper and blueprint, Italian and English, 1280×800, prepared examples only. 80/80 checks pass:
  - the three examples open and the page does not scroll;
  - the whole-source guide starts with the premise alone and reaches every step;
  - a question's guide lights its aspects;
  - the sub-level:
    - grows out of its block with an animation, and none under "reduce motion";
    - leaves every position of the whole identical;
    - comes into view with its head and first role, and opens a component's card;
    - closes back to the same step;
  - exploring pauses the guide and "back to the step" restores it;
  - the index opens a section;
  - "how it was read" has its counts, grid and five readings, and a cell opens its line;
  - a real pointer drag moves a label 60×42 px, with its dashed leader, and a double click puts it back;
  - choosing Mill's principle lights exactly its three joints, and choosing it again lights none;
  - there are no console errors.
- **Found and fixed in X20.2:**
  - in a window that is not in front, Chromium pauses animations, so closing the sub-level waited for a motion that never ended. Closing now also happens after its duration (unit test added);
  - the sub-level opened below the structure's visible edge. It is now scrolled into view, head first, with a level wider than the panel centred on its first block.
- **X20.3, ChatGPT in the app (2026-11-06, run on the owner's go-ahead, "Yes, run it").**
  - The built app was driven through Studio over the DevTools protocol, in the owner's own data folder: the public importer source pasted, no question, "Esplora la fonte" on `gpt-6.1-sol`.
  - **The run:** one request, no repair, about 15,000 characters received in 125 s. The answer passed `acceptExploration`, was saved (`explorations/`, with origin ChatGPT · gpt-6.1-sol) and opened in the view, with no console errors.
  - **The shape:**
    - three aspects, one of them the problem ("Perché il silenzio è ambiguo"), as A2 asks for a problem the source develops;
    - 8 roles, 17 components, one prerequisite as the premise, 5 annotations, 10 links (1 interpreted), one trace (7 steps);
    - "How it was read": 179 lines, 96% in the map, entry by the source's question, the logic follows the chapters.
  - **Found and fixed:**
    - at the aspect level, a prerequisite with components was drawn as an aspect ("1 ruolo") and its toggle tried to open a sub-level. Only an aspect's block opens one now; a prerequisite's components open in place (unit test added);
    - a long generated "whole" widened the window by 3 px, because the view's outer grid column grew to its bar's content. The column is now `minmax(0, 1fr)`.
    
    After both fixes, 80/80 checks pass again.
  - The exploration's title is its source's title ("night-importer.md"): the request asks for no title. The owner can judge whether a title should be asked for.
  - **Still to run:** X20.3 through Claude over MCP, which needs a Claude client connected to this build's MCP server.
- **Left for the owner's look (X20.2 witnessed, X20.4):**
  - at 1280×800 the structure has about 260 px of height under the guide, the step strip and the card;
  - the importer enters, at the aspect level, by its morning-catalogue question.

### Phase `card`

**X21. The card explains the selection** (`Panels.tsx`, `Graph.tsx`, `ExplorationView.tsx`, `state.ts`, `exploration.css`, `x-it.ts`, `x-en.ts`). From the owner's look of 2026-11-09.
- **The rule:** a sentence stays on the card only if removing it loses an explanation, not a copy of something on screen. The name, the kind tag and the position tags ("in:", "su:", "di:") stay.
- **What each card shows:**

  | Selection | Stays | Leaves |
  |---|---|---|
  | Aspect | name, "aspetto", open/close its roles, its annotations | the lead made of its roles' names, the roles fold, the links fold, "no links" |
  | Role, prerequisite, other parts | name, tags, the lead, **all** its points with their marks, its annotations | the components fold, "why it is linked", "no links" |
  | Link (new) | "A → B", "legame", declared or interpreted, its bonds as who → what → whom, a way back to A | the other links of the part |
  | Component | name, "componente", what it does, "di: role" as the way back to the role | "the other components", the separate back button |
  | Section not extracted | unchanged | — |

- **Points are all kept.** A point with no mark is not a copy by itself, and this is the only cut that would remove generated content instead of a repeated surface. It is looked at again on real cases (1 of 13 points in the prepared examples, 3 of 27 in X20.3's generation).
- **The cited lines are a fallback.** They show on the card only while the source column is hidden: folded, or on a narrow window outside the source tab. Otherwise the source column shows them, and the card does not repeat them.
- **Choosing a link.** "Why it is linked" was the only way to choose a link inside the view, so the joint label becomes choosable:
  - a pointer released within **4 px** of where it went down is a click and chooses the link; beyond 4 px it is a drag and moves the label, as today. A move within the threshold is not stored. Without a threshold, a 1 px tremor would make a click a move, and the choice would fail silently;
  - Enter or Space on a focused label chooses it, and the arrow keys and Home keep moving it;
  - the label is a button, pressed while its link is chosen;
  - choosing a label selects its `from` end at the level that draws it (the whole, or the sub-level), then the link, as a link opened from "how it was read" does;
  - Escape with a link chosen returns to its part's card, and leaves the guide alone.
- Acceptance (component tests):
  - an aspect's card (importer) has no lead of role names and no list of roles, and opens its roles;
  - a role's card (Mill `region`) has no folds, and shows every point;
  - a click on a joint label shows the link card with its ends, its basis and its bonds, and lights exactly its lines; Enter does the same; Escape returns to the part's card;
  - a release 3 px from the start chooses the link and leaves the label in place; a release 5 px away moves the label and chooses nothing;
  - a component's card has no "other components", and "di: role" returns to the role;
  - an interpreted link opened from "how it was read" lands on its link card;
  - a static check in `theme.test.ts` finds the fallback rule for the card's lines, since the test environment applies no CSS;
  - the Italian and English catalogs keep equal keys.
- **On the built app,** with the DevTools script of X20.2 extended to the four cards:
  - a real click on a label chooses it and a real drag does not;
  - Tab reaches the labels and Enter opens them, replacing the list of links as the keyboard path;
  - the card's lines show with the source folded, at 1280×800 and on a narrow window;
  - paper and blueprint, Italian and English, no console errors.
  
  Screenshots of the four cards go to the owner's look.
- **Done (2026-11-09):**
  - **The card** (`Panels.tsx`) has one branch per selection. An aspect's card has no lead and no list; a role's card has no folds and keeps every point; a component's "di: role" tag is the button back to the role; the section card is unchanged.
  - **The link card** opens when a link is picked:
    - its head names the ends, with "legame" and its basis;
    - a single bond between the joint's own ends shows only its relation, as the lead, since the head names the ends (found on the built app);
    - a joint that stands for several links lists them as who → what → whom.
  - **Bonds keep their basis.** `LevelBond` in `exploration-levels.ts` now carries each link's basis, so a joint declared by one link marks the interpreted ones. The importer's aspect joint "Il silenzio → Il giro" is declared by two links of three, and its third, opened from "how it was read", is marked "interpretato" on its own bond.
  - **Labels** (`Graph.tsx`): `CLICK_SLOP` = 4 px. A cancelled pointer never chooses. Labels are buttons, pressed while chosen, with the `xp-chosen` ring. Escape lets a chosen link go first, also with a label focused (`state.ts`, `ExplorationView.tsx`).
  - **Removed:** the strings `roles`, `why`, `noLinks`, `otherComponents` and `none`, and the CSS `.xp-fold` and `.xp-rel-ends`. `backToRole` is now the accessible name of the "di:" button.
  - **Tests:** 8 new component tests in the X21 block, the X16 fold test replaced by one on a point's and a component's lines, the report's interpreted link updated, and 2 static CSS checks. `npm run typecheck` passes, `npx vitest run --dir tests` runs 41 files and 596 tests, and `npm run build` passes.
  - **Built app** (`npm run build`, Electron over the DevTools protocol, scratch data folder, script in the scratchpad): 61/61 checks pass in paper and blueprint, Italian and English, at 1280×800, covering:
    - the four cards;
    - a real click on a label choosing its link, and a real 40×24 px drag moving it and choosing nothing;
    - Escape;
    - Tab reaching a label and Enter opening it;
    - a component's card;
    - the card's lines showing with the source folded and on a 760 px window, and hidden otherwise;
    - no sideways scroll and no console errors.
  - **Found and fixed on the built app:** a block's hover peek (`.xp-peek`, above the labels) kept the hover while the pointer moved down onto the block's own joint label, so the click went to the block. The peek no longer takes the pointer (`pointer-events: none`, static check added).
  - **Left for the owner's look:** the 16 screenshots (four cards × two themes × two languages), and the thin aspect card.

### Phase `polish`

From the owner's look at the app on 2026-11-09, after X21. X22–X26 do not depend on one another, except that X25 and X23 both change the structure column's rows, so X23 goes after X25.

**X22. The source's two views** (`Panels.tsx` `SourcePanel`, `ExplorationView.tsx`, `state.ts`, `exploration.css`).
- The source column's head gets the two buttons of the disassembly player's `SourcePane`: "Documento" (rendered, today's view) and "Righe" (the raw text with numbered lines). They reuse its strings (`t.d.viewLabel`, `t.d.views`) and its rule: a source that is not prose (`isProse`, `src/renderer/markdown.ts`) shows only "Righe", and offers no choice.
- The view lives in the view state, and is kept when a panel folds.
- **"Righe" behaves as "Documento" does:**
  - the selection's lines are marked, and the first is scrolled into view inside the column only;
  - the leader line runs from the card to the first marked line;
  - each line's gutter has the colour of the narrowest part that cites it;
  - a click on a line opens its part (`pickLine`).
- Acceptance (component tests):
  - the two buttons switch the view, and the pressed one says which;
  - in "Righe", a chosen part marks exactly its lines, and a click on a line opens its part;
  - a code source shows "Righe" and no buttons;
  - the view survives folding and reopening the column.

**X23. Panes the learner can resize** (`SplitPane.tsx`, `ExplorationView.tsx`, `exploration.css`).
- The player's `Splitter` (role `separator`; the pointer, the arrow keys, and Home or End for the smallest or largest size; a double click restores the initial size) goes in three places:
  - between the structure and the card, horizontal: the card grows upward or shrinks downward;
  - between the index and the structure, and between the structure and the source, vertical.
- `PANES` gains three keys for the exploration (card, index, source), each with its initial, smallest and largest share. The sizes are kept per device in local storage, as the player's are, and anything unreadable falls back to the defaults.
- A folded index or source keeps its rail and hides its separator. On a narrow window there are no separators, as in the player.
- Acceptance (component tests):
  - the arrow keys change a pane's share by the player's step, within its bounds, and `aria-valuenow` says it;
  - Home and End reach the bounds, and a double click restores the initial size;
  - the sizes survive a remount, and an unreadable stored value falls back;
  - folding a column hides its separator.

**X24. The aspect card gives its roles** (`Panels.tsx`, `ExplorationView.tsx`, `exploration.css`).
- The aspect card opens with its roles as a bulleted list, "name — what it does", open and not folded, in the source's order.
- A click on a role opens the sub-level with that role selected (`openSub(aspect, role)`, as a role chosen elsewhere is).
- "Apri «…»" stays under the list, and the annotations stay.
- No lead made of the roles' names: the list replaces it.
- Acceptance (component tests):
  - the importer's "Il giro e i segnali che lascia" card lists its five roles with what each does;
  - a click on one opens the sub-level with that role's card;
  - the list is open, not folded.

**X25. "A parte" at the bottom of the structure column** (`ExplorationView.tsx`, `exploration.css`, `x-it.ts`, `x-en.ts`).
- The tray leaves the drawing and becomes a band at the bottom of the structure column, under the card. It is set off by a dashed top border and the sunk background.
- Its chips take the aside colour (`--x-aside`, `--x-aside-soft`), the same as the aside dots in the index and the aside blocks.
- Its label says what it is: "A parte · fuori dal meccanismo" / "Aside · outside the mechanism".
- A chip still opens its card, and the band shows only when the exploration has pieces aside.
- Acceptance (component tests and a static CSS check):
  - the band is the structure column's last child, and no tray is left inside the stage;
  - a chip opens its card;
  - the chips use the aside tokens.

**X26. A legend for the index** (`Panels.tsx` `IndexPanel`, `exploration.css`, `x-it.ts`, `x-en.ts`).
- At the bottom of the index, built from the open exploration, it shows only the signs that occur in it:
  - each aspect's hue with its name, or the main colour as "mechanism" when there are no aspects;
  - the prerequisite colour;
  - the aside ring;
  - filled for "already shown by the guide", and empty for "not yet";
  - the outline of the selected part;
  - "? question" for a section the source's question walks;
  - the marked section for "touched by the current step";
  - "not extracted".
- It can be folded, as the other folding parts are. The hint at the top keeps only "in its order".
- Acceptance (component tests):
  - Mill's legend has no aspect entries and has the prerequisite entry;
  - the importer's legend names its two aspects with their tones;
  - "? question" appears only when a trace walks a section;
  - the legend folds and opens.

**For the whole phase,** on the built app, with the X21 DevTools script extended (paper and blueprint, Italian and English, 1280×800 and a narrow window, no console errors):
- the two views of the source;
- a real drag on each separator, and the arrow keys on a focused separator;
- the aspect card's roles opening the sub-level;
- the band at the bottom;
- the legend.

Screenshots go to the owner.

- **Done (2026-11-09):**
  - **X22.** `SourcePanel` has two views, chosen in the column's head with the player's buttons and strings. The view is kept in `ViewState.sourceView` and survives folding.
    - "Righe" is `SourceLines`: the player's `source-text` list, where each line carries `data-from` and `data-to`. So the same code marks the selection, colours the gutters, answers a click and anchors the leader line.
    - A source that is not prose shows its lines and no buttons.
  - **X23.** `PANES` gains `xCard` (0.3, 0.15–0.7), `xIndex` (0.2, 0.14–0.34) and `xSource` (0.34, 0.24–0.55), and `Splitter` now takes any arrow as `grows`.
    - The view sets `--xc`, `--xi` and `--xs` on its body. The grid has a 16 px column between panels, holding a separator only while the panel next to it is open.
    - The card's height is its share of the structure column, and the stage's minimum height is 120 px instead of 260.
    - On a narrow window the separators are hidden.
  - **X24.** The aspect card lists its roles, "name — what it does", in source order, each a button that opens the sub-level on that role (`openSub`). Found on the built app: the bullet sat beside the second line of a wrapped role, so it is now drawn in the button, on the first line.
  - **X25.** The tray left the stage. It is now a band, the structure column's last child, with a dashed top border in the aside colour, the sunk background, and chips in `--x-aside` and `--x-aside-soft`. Its label reads "A parte · fuori dal meccanismo" / "Set apart · outside the mechanism". A chip closes an open sub-level before opening its card.
  - **X26.** `IndexLegend`, at the index panel's foot, can be folded and lists only the signs present, drawn with the index's own marks. The top hint keeps "nel suo ordine".
  - **Tests:** 8 component tests (X22 ×2, X23 ×2, X24, X25, X26 ×2) and 2 static CSS checks. The X21 aspect test is replaced by X24's, and `split-pane.test.tsx` has the new defaults. `npm run typecheck` passes, `npx vitest run --dir tests` runs 41 files and 605 tests, and `npm run build` passes.
  - **Built app:** the DevTools script was extended. 117/117 checks pass in paper and blueprint, Italian and English, at 1280×800 and 760 px, with no console errors:
    - the source in "Righe", with the focus in view, the leader line, the coloured gutters and a click on a line;
    - real drags on the three separators (card +80 px, index +60 px, source +60 px), Home, and a double click restoring them;
    - the aspect card's five roles, and one opening the sub-level;
    - the band at the column's foot, and the legend at the index's foot with both aspects;
    - no separators on a narrow window.
  - **Found, outside this phase:** two settings saved within a few milliseconds (theme, then language) make the second `SettingsStore.write` fail on its `rename`, because both use the same `.pending` file, and the renderer logs an unhandled rejection. The script now waits between them. The store is not changed here.

### Phase `clarity`

From the owner's look on 2026-11-09, after X22–X26. X27 and X28 are independent.

**X27. A readable bar** (`exploration.css`, `ExplorationView.tsx`).
- **The title:** a little stronger (weight 500, 21 px), still on one line, with the full title shown on hover.
- **The description:**
  - 14.5 px, in the text's full colour (`--ink`), with the hierarchy kept by size and weight, not by a faded colour;
  - up to two lines, cut only after the second; the full sentence on hover and as the accessible description.
- On a narrow window it stays hidden, as today.
- Acceptance:
  - a static CSS check: the description uses `--ink`, two lines, no `white-space: nowrap`;
  - a component test: the description carries the full `whole` as its title;
  - on the built app: a long generated `whole` shows on two lines at 1280×800, with no sideways scroll, in both themes.

**X28. The strip says where the reader is; the card says what it means** (`ExplorationView.tsx`, `x-it.ts`, `x-en.ts`).
- At the premise step, the strip shows the step's name and count ("Il punto di partenza della fonte · prima di tutto"). It shows the premise's name as a chip, as the other steps show the parts entering, and no longer shows its sentence. The sentence and the points stay on the card.
- "Esplori fuori dalla guida" shows only when the explored part is not the one the step puts forward. Choosing that part selects it, and the guide stays where it is.
- The other strips are unchanged:
  - a question's step keeps its own text (the question's step, not a part's sentence);
  - "all the layers" and the sub-level keep their lines.
- Acceptance (component tests):
  - at the premise step, the strip does not contain the premise's sentence and has a chip with its name; the chip selects the premise, and the card shows its sentence;
  - choosing the step's own part shows no "fuori dalla guida", while choosing another part does;
  - Mill and the importer keep their guide tests.

**For the phase,** on the built app with the DevTools script: the bar at 1280×800 in both themes, the premise step with and without the premise chosen, and no console errors.

- **Done (2026-11-09):**
  - **X27.** The title is 21 px at weight 500, with the full title on hover. The description is a paragraph at 14.5 px in `--ink`, clamped to two lines, with the full `whole` as its title.
  - **X28.** `stepPart` is the part the step puts forward (`guided`), and "away" holds only when the explored part is another one, for the note and for the strip's paused look. The premise step shows "la premessa:" / "the premise:" with a chip; its sentence stays on the card.
  - **Tests:** 2 component tests (X27, X28) and a static CSS check. The X13 guide test now explores an earlier layer's part to leave the guide, and checks that the step's own part does not. `npm run typecheck` passes, `npx vitest run --dir tests` runs 41 files and 608 tests, and `npm run build` passes.
  - **Built app:** the DevTools script of X22–X26 was extended. 125/125 checks pass in paper and blueprint, Italian and English, with no console errors:
    - the importer's description on two lines with its full text on hover, and no sideways scroll;
    - the premise chip opening its card, with a strip that does not repeat the sentence, shows no "away" note and is not paused.
  - **Found and kept as is:** with "Tutti i livelli" on and the whole-source guide, no part is put forward, so the card stays empty until a block is chosen. That was already so, and a script check had assumed a selection; the script now chooses one.

## Verification strategy

- **Runners:** `npm run check` (TypeScript and Vitest) and `npm run build`, from the adapter.
  - On the owner's machine, Vitest also collects the tests of a private working copy, `.local/worktrees/guided-source-object-prototype`. It is ignored by git, absent in CI, and its tests fail.
  - So the local check is `npm run typecheck` plus `npx vitest run --dir tests`.
  - The test configuration is not changed for it.
- **Pure core:** X2–X7 are unit-tested on public fixtures and small hand-written cases.
- **Renderer:** X12–X19 have component tests, as the disassembly player does today. Motion and real layout are not visible in the test environment, so the states are tested there and the motion is witnessed in X20.2.
- **Model:** the gate (X1) is the only evidence of what a model returns. A passing unit test with a fake completer proves the pipeline, not the extraction.
- **Product flow:** proved only by X20.2 and X20.3, and its usefulness only by X20.4.
- **Routes:** each route is claimed only after its own X1 result and its own X20.3 run. The adapter's open question on ChatGPT inference is answered by those runs, or stays open.

## Risks

- **A2's rules ran on one source.** The owner passed the gate on A1 for all six sources and A2 for the README. X20.3 and X20.4 judge A2 on the app's own generations.
- **Forced aspects.** The top-down principle asks for 2–4 aspects, and a short or single-concern source may get invented ones. The request allows none, criterion 7 checks it, and Mill is the public case.
- **Bigger answers.** With members, the explainer's answer holds about a hundred components. Time and size per source are recorded in A1, and the request limit of X7 may come out lower than R1's.
- **Rules can overfit the sources.** "Making ≠ working" comes from one README, and the top-down principle was chosen on one explainer. Each rule is written for any subject, and the public argument (Mill) checks that it does not break an argument.
- **Too little connection.** An extractor allowed not to connect may split one mechanism into loose parts, because citing every link is work. X1 measures it against today's extractor, and "how it was read" shows it to the learner.
- **Prerequisite versus bond** is the model's judgement. Mislabelled, it hides a bond or forces an order, and it decides the premise. The owner's look in X1 and X20.4 is the check.
- **The question guide at the aspect level is not prototyped.** E dropped the trace at the aspect level; X13 lights aspects and sub-level roles for a step. The owner judges it in X20.4, and it can fall back to the roles level if it does not read.
- **The sub-level covers part of the whole.** It opens under its block and hides the faded rows below it. The owner accepted this in E. Positions never change, and closing shows them again.
- **Moved labels are lost when the exploration closes.** Accepted for this version (decision 12).
- **The thresholds are fitted to three sources** (0.6 for traces and for similar nuclei). They are named constants, and the reading report states the numbers behind the choice.
- **One request bounds the source.** Long sources are refused in this version. The limit comes from X1, per route, not from a guess.
- **Hosted models cost per run.** Each run uses six Claude agents and up to six ChatGPT requests. The ledger and a stated cost before each run keep this visible.
- **Private sources leave the device.** On the ChatGPT route this needs the owner's confirmation per run. The app says which route produced each exploration.
- **Two Claude paths differ.** Fresh agents in the gate and the assistant in Claude Desktop are both Claude, but not the same setup. X20.3 runs the real MCP path.
- **Two documents for one source** (a disassembly and an exploration) can confuse the library. X18 labels each, and the exploration is the default.
- **Everything up front costs one long wait before the view.** It replaces many short waits inside it. The generation screen shows progress and can be cancelled; X1 records the time per source.
- **Removing "take apart" leaves disassemblies shallow.** Generated disassemblies have one level unless they were taken apart before. That is accepted: exploration is the default, and the disassembly player is kept for reading what exists.
- **The style drifts toward the prototypes' generic look** if X11 is skipped or done after the view. The phase order puts tokens first.
- **The aspect card becomes thin** (X21): a name, a tag and the button to open its roles. It shows a gap in the data, since an aspect has no idea of its own, and it is not filled with a derived sentence, which would be a copy again. The owner judges it, and an aspect field is a separate decision.
- **Labels carry two gestures** (X21): click and drag. The 4 px threshold separates them, and both are tested in jsdom and with a real pointer.
- **The keyboard loses a compact list of links** (X21): links are reached by Tab through the labels instead. X21's run on the built app checks that path.
- **Two views of the source double the line logic** (X22). The marking, the gutter colour, the click and the leader line must work on both. Both are tested on the same cases, and the leader line is checked on the built app.
- **More separators, less drawing** (X23, X25). The band and a taller card take height from the drawing. The separator gives it back, and the initial shares keep today's layout at 1280×800.
- **The aspect card can grow long** (X24). An aspect has at most 14 roles (the contract's limit), each with its sentence. The card scrolls, as it does today.
- **A two-line description takes height** from the bar (X27). The bar grows by one line at most, and the panels below shrink by that much.
- **The premise step shows less text** (X28). A reader who does not choose the premise sees only its name. The chip is the way to the sentence, and the guide's first step still lights the premise in the drawing.
- **Leader lines across the structure** cross other nodes, as in the prototype. The line is drawn above the nodes, thin, and only for the current selection.

## Approval

Record:
- **Approver:** Simone Riggi (owner), in chat: "Approve P-20261105-exploration v9".
- **Timestamp:** 2026-11-09T17:13:12Z.
- **Approved version:** 9.
- **Plan digest:** SHA-256 `0f87623f5525ab18281c43215e669678b8f9dfc4c153960169b79b5e3dacf483` of this file before this record was added.
- **Authorized scope:** as listed below under "v9 authorizes".

History:
- v2 was approved on 2026-11-05T16:56:08Z; void after v3.
- v3 was approved on 2026-11-05T17:00:57Z (SHA-256 `db6e4967…0a18`). Its X1 ran once and stopped at the gate. Void after v4.
- v4 was approved on 2026-11-05T17:45:12Z (SHA-256 `874755f4…d997d6`). Its X1 ran R1 and the abstraction study. Void after v5.
- v5 was approved on 2026-11-06T11:21:02Z by Simone Riggi ("Approve P-20261105-exploration v5"), SHA-256 `47da2401756a7cc3ce8bfe840a2b1b328d0021c501c3a607db7a490c23dc5c5c`. Its X1 ran A1 and A2 and passed. Void since v6's approval: v6 changes X4, X5, X11, X12, X15 and X16.
- v6 was approved on 2026-11-06T15:04:33Z by Simone Riggi ("Approve P-20261105-exploration v6"), SHA-256 `3d0b158fb993099e100b2a673ed0f82acce449fda20574ca01b1857c850fad1c`. It authorized X2–X20 and the branch `feature/exploration`. X2–X19 and X20.1–X20.3 (ChatGPT) are done under it. Void since v7's approval: v7 adds X21 and supersedes part of X16.
- v7 was approved on 2026-11-09T16:16:35Z by Simone Riggi ("Approve P-20261105-exploration v7"), SHA-256 `c3e741ea36bd354cc64e526d01ec80fa74353ef2342ce2b21202cc5443d7cb16`. It authorized X21 and what was left of X20. X21 is done under it (commit 1ad37b5). Void since v8's approval: v8 adds X22–X26 and supersedes X21 on the aspect card.
- v8 was approved on 2026-11-09T16:51:32Z by Simone Riggi ("Approve P-20261105-exploration v8"), SHA-256 `ce8ca03b55c568db28a4f78010de97766e20420cc1b52260f7458e19164d3d60`. It authorized X22–X26 and what was left of X20. X22–X26 are done under it (not yet committed). Void since v9's approval: v9 adds X27–X28.

Review:
- v7: the cuts were drafted from the owner's feedback of 2026-11-09 and read again in chat. Dropping the points with no mark was given up, and the 4 px threshold was added.
- v8: each task comes from the owner's own look and words on 2026-11-09. The places to reuse were checked in the code, and the owner chose the band's placement.
- v9: both tasks come from the owner's look on 2026-11-09. The causes were found in the code (the bar's CSS, the strip's premise text and its "away" condition). The popover the owner asked about was weighed and not adopted, for the reasons in "What changes from v8"; the owner then asked for v9 as proposed.

v9 authorizes:
- committing X22–X26 as they stand;
- X27–X28, in phase `clarity`, on `feature/exploration`, and adding them to PR 47 when the owner asks for a push;
- what is left of X20, as v6 wrote it.

v9 does not authorize:
- merge;
- publishing the Claude Desktop extension;
- sending a private source to OpenAI;
- changing the exploration contract or its request;
- any new dependency.

Each needs its own confirmation when reached.

Approve with exactly:

```text
Approve P-20261105-exploration v9
```

Approval records approval only. Implementation starts with a later, separate command: `implement P-20261105-exploration v9 --phase clarity`.
