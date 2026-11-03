# Research: guided reading as the core, with an object to take apart and three axes of navigation

Date: 2026-11-02. Question: the owner wants to focus on **consuming the source**, the core of the product, and to experiment with something other products would not do. Two ideas frame it:
- **The object metaphor.** Most concepts and sources map onto a mechanical object and its disassembly, and a recognisable object may help the learner fix concepts and components.
- **Navigation on three axes.** x consumes the source from start to end; y descends into the details of a component; z deepens concepts the source reports that are not strictly connected to other components.

Run and Reassemble may later fold into the same experience, but that is not decided. This research asks four things:
- what Codex's two prototypes do;
- how x, y and z map onto the data the app already has;
- what the object metaphor can and cannot carry;
- which experiments would show whether it helps.

## Evidence

- **Codex's guided-reading branch**, `origin/codex/guided-source-reading` (2 commits on `main` at `c9bcd56`). It adds `src/core/source-reading.ts`, `GuidedReading.tsx` and a self-authorised plan, `P-20261030-guided-reading`, marked completed outside this workflow.
- **Codex's object prototype**, branch `codex/guided-source-object-prototype` in the worktree `.local/worktrees/guided-source-object-prototype`, uncommitted. It is served at `http://127.0.0.1:5188/` and is built on the owner's private document. This research describes its behaviour only; the examples below come from this repository's public fixture `importer-signals`.
- **The owner's report** of 2026-11-01, in `.local/reports/2026-11-01-lettura-guidata/REPORT.md`. It is private; this research cites its ideas, not its content.
- **The contract and player**: `src/core/disassembly.ts`, `src/core/disassembly-generation.ts` (expansion, lines 505–540), `src/renderer/disassembly/DisassemblyPlayer.tsx`, and [`docs/product.md`](../../product.md) (identity, the exploded view, sub-assemblies).
- **Four whole-source generations** recorded in [P-20261029-source-limits](../plans/P-20261029-source-limits/plan.md) S4.3–S4.4.

## What the two prototypes do

**Guided reading (Codex, on a branch).**
- `sourceReadingRoute` cuts each source into passages. A passage ends at a heading, or past a soft size of 1,800 characters, and never inside a list, table or code block.
- `readingContext` gives each passage the part, at any depth, whose citations overlap it most.
- The player shows the passage with its part.
- It does not classify what a passage does to the structure, and it shows at most one joint.
- Against `main`, it conflicts in `DisassemblyPlayer.tsx` and its test only.

**The object (Codex, prototype on 5188).** The screen has three columns over one band:
- on the left, a route of four prepared steps;
- in the centre, a 2.5D isometric drawing, the "diagnostic unit": a shell, a cartridge holding shared state, an input module and two readers;
- on the right, the explanation and a button that opens the selected piece;
- below, the source, always in view, as either the current passage or the whole document.

Opening the cartridge explodes it into three registers. The last step runs a small simulation: active, paused or stuck, with time advancing 30 s per click, while two readers report what they see.

How it is built:
- The model is hand-written. Five reusable drawing recipes (shell, cartridge, register, input, reader) are separate from four part instances.
- Each instance has a 3D position, an explode vector and a reveal order.
- Three edges carry a role, and the code states that only source-backed relations are edges; leader lines are only visual.
- The citations in the model are placeholders (`[1,1]`).
- Nothing is generated: the prototype shows the experience, not the pipeline.

## The three axes, on data the app already has

Every axis can be computed from the current contract. None needs a new field to be tried.

```
x  reading order        passages of the source (sourceReadingRoute)
│                       each passage classified by what its lines already belong to
├─ y  depth             Part.parts (sub-assemblies), Part.joints, Part.excluded;
│                       a closed part opens on demand through the existing expansion request
└─ z  margin            lines excluded with a reason and a note (context, detail, repetition),
                        and passages whose lines belong only to the whole
```

### x: what a passage does to the drawing

The report's central rule is that a paragraph adds a part, deepens one, introduces a relation, or gives context. The citations already decide which, once two more cases are added: the frame of the whole, and lines no part takes apart.

| The passage's lines are… | The passage | The drawing on this step |
|---|---|---|
| cited by the whole only | **frames** the whole | the outline of the object |
| cited by a part seen for the first time | **adds** that part | the part appears in place |
| cited by a part already seen | **deepens** it | the part lights up; its new lines join it |
| cited by a joint | **relates** two parts | the joint is drawn, with its label |
| excluded with a reason | goes to the **margin** (z) | nothing changes in the object |

Computed on `importer-signals` (258 lines, 16 heading sections), with one row per section. Several categories in a row are all present in that section:

| Lines | Section | What it does |
|---|---|---|
| 1–8 | title and header | margin (context) |
| 9–46 | what it does; why silence is the hard failure | frames the whole |
| 47–69 | one round, step by step | adds *the round*; relates round → heartbeat, round → last finished |
| 70–101 | heartbeat stamp; last-finished time | adds *heartbeat*, then *last finished* |
| 102–135 | what happened to each record | adds *outcomes*, deepens it twice; relates round → outcomes |
| 136–174 | pause switch; restart rule | adds *pause*, *restart*; relates round → pause, heartbeat → restart |
| 175–209 | the night board; reading it | adds *board*; relates three signals → board; deepens it |
| 210–249 | one night; what it does not catch | deepens *board*, *pause*, *restart*, *outcomes*; margin |
| 250–258 | glossary | margin (repetition) |

The sequence builds the object as the text does, and it needs no model call: the drawing grows from the outline, to the round, to the signals, to the board. Sections 11 and 12 return to parts already built, which is the case the report singles out: one component explained in distant passages.

### y: descending into a part

- **Already there:**
  - sub-assemblies (`Part.parts`), with their own joints and exclusions;
  - "One level of the exploded view opens at a time" ([product](../../product.md));
  - a part with no sub-assembly can be taken apart later, through the expansion request (`buildExpansionInput`, `expandPart` in the player).
- **⚠ The gap.** None of the four whole-source generations, on sources of 90,000 and 49,000 characters, produced a sub-assembly. On generated disassemblies the y axis is empty unless the learner asks to take a part apart, and that costs a generation. A y axis that works on demand is consistent with the product ("a group can stay closed"). Generation should still be checked for why depth never appears on long sources.

### z: the margin

- **What the owner described:** concepts the source reports that are not strictly connected to other components.
- **What the data already holds:**
  - lines excluded with a reason (`context`, `detail`, `repetition`) and an optional note, in the bill of materials or inside a part;
  - passages that belong only to the whole.
- **Proposed behaviour.** z is a layer beside the object: the margin of a technical drawing. It shows these notes on the current x step, and it never draws a line into the object.
- **⚠ Where it breaks.** Some margin concepts are definitions the reader needs to understand a part, for example a term in a glossary. Showing them is z; connecting them to a part is a relation, and a relation must come from a joint. If learners need definitions attached to parts, that is a contract change, a "term" with citations, decided later and not assumed here.

## The object metaphor: what it can carry

The owner's argument is that a recognisable object fixes concepts and components. The product already holds half of this: the exploded view is its signature. What the object adds is **identity and place**:
- each part has a shape that says its function;
- the part keeps a position in a whole that looks like something.

| Hypothesis | Support | Where it can fail |
|---|---|---|
| A stable shape and place help the learner find and recall a part across distant passages | spatial memory and dual coding (Paivio); the report's own criterion: "identity" | when the shape is arbitrary, it is one more thing to memorise |
| Starting concrete and moving to the abstract helps transfer | concreteness fading (Fyfe et al., 2014) | when the concrete object never fades back to the source's own terms |
| An attractive object makes the learner want to read on | the owner's goal: "fluid, attractive, memorable" | decorative detail that carries no meaning lowers learning (seductive details; Mayer's coherence principle) |
| A mechanism makes a relation testable | the prototype's pause/stuck simulation; the product's Run | a machine suggests necessity: an argument's support is not a gear (the report's own philosophical test) |

The literature is named from general knowledge and was not reviewed for this research (see Assumptions). It points one way: **form must carry meaning and only meaning**. That matches the prototype's rule, in which only source-backed relations are edges.

### Three levels of feasibility

1. **A prepared object for one source.** This is done in the prototype, with hand-written recipes and positions.
2. **Objects composed from a vocabulary of functional shapes.**
   - Each part gets a shape from a closed list, the way it gets an `icon` today, and the app checks the choice.
   - Positions come from the existing layout (`layoutLevel`), drawn in 2.5D with the prototype's isometric projection.
   - Joints come from the contract.
   - Feasible with the current pipeline: the model chooses from a list, and it does not draw.
3. **A new, unique and faithful object generated for any source.** This is a research problem. It fails exactly where the report's own test failed: a line in the drawing that suggests an inference the text does not make.

The recommended direction is level 2. The vocabulary follows the joint family, as the product already allows ("only the kind of joint changes"):

| Family | Shapes | Connection drawn as |
|---|---|---|
| mechanism | store/register, valve/filter, transformer, switch/regulator, comparator, reader/gauge, cycle | pipe or wire (`sends-to`), linkage (`causes`), mounting (`depends-on`) |
| argument | premise block, conclusion block, ground, objection, limit, in a load-bearing frame | strut (`supports`), wedge (`attacks`), brace (`limits`) |
| story | event, actor, on a track | track segment (`leads-to`), cause marker (`because`) |

The argument row keeps the report's correction. When a premise is suspended, the conclusion stays in place, marked "not derived here", and is never removed.

Cast on `importer-signals`:

| Part | Shape |
|---|---|
| the round | a cycle with five stations |
| heartbeat stamp, last-finished time | two registers |
| outcome log | a tape |
| pause switch | a switch |
| restart rule | a comparator |
| night board | a gauge reader |

That is the same family of shapes as the prototype's unit, on a public text.

## How the three axes and the object meet

```
reading  x ─────────────────────────────────────────────▶ (source order)
   │ frame → add → add → relate → deepen …   each step changes the object
   ▼
object (2.5D, functional shapes, joints only from the contract)
   │ y: open a part → its sub-assembly explodes in place; Escape returns
   │ z: the margin beside the object, never wired into it
   ▼
source band, always in view, highlighting the passage
```

- **x builds the object as the text builds it.** "Progressive construction" is no longer a separate mode: the categories decide what each step reveals.
- **The source stays the anchor.** The band below shows the passage, and the object never replaces it, as in both prototypes.
- **Run and Reassemble can be tried later at the same place.** A "relate" step is where a joint can be put under load, and the end of x is where the object can be rebuilt. This is noted as an option, not proposed now.

## Recommendation

Planning is justified, in two steps. The first touches the product; the second is an experiment, to keep the risk where it belongs.

1. **Guided reading on the x axis, in the player.**
   - Start from Codex's branch, rebased on `main`.
   - Add the five computed categories and the "frames the whole" case, with the source band always in view.
   - z appears as a margin list on each step; y uses the sub-assemblies and the expansion that exist.
   - It works on the prepared examples and on every generated disassembly, with no generation cost.
2. **The object, as a prototype under `prototypes/`, on public fixtures.**
   - Hand-assign the functional shapes on `importer-signals` and on one argument fixture.
   - Drive the 2.5D drawing from the same x categories.
   - Compare it with today's exploded view on the same reading route.
   - Only if it helps, a later plan adds `shape` to the contract as a closed list and to generation, measured on the evaluation set.
3. **Then the test with people.** Three to five people read the same source with the two drawings. They are asked to find a part, explain a relation, and predict what changes under load. Neither preference nor polish counts as the result.

The depth gap (no sub-assemblies on long generated sources) is a separate finding for generation, not part of this plan.

## Assumptions

- **The literature in the table is cited from general knowledge** and was not reviewed for this research: Paivio's dual coding, concreteness fading (Fyfe, McNeil, Son & Goldstone, 2014), seductive details and Mayer's coherence principle. It frames hypotheses and proves nothing about this product.
- The categories table was computed by a script on `importer-signals-en.json`, with sections split at headings rather than at Codex's 1,800-character passages; Codex's passages would give more, smaller steps.
- The object prototype was observed in the browser on 2026-11-02 at 1440×900; its code was read in the worktree, uncommitted.

## Risks

- **A convincing object makes a wrong relation convincing.** Every visible connection must be a joint with citations; position and adjacency must not imply one. A check can enforce this for drawn lines, not for how shapes are perceived.
- **Shapes become decoration.** If a learner cannot say what a shape means, it is a seductive detail. The test with people must ask for it.
- **Codex's branch is outside the workflow.** Its plan authorises itself. Using its code requires a plan of our own, approved with the exact command; its commits can be kept, rebased.
- **The Codex worktree inside `.local`** makes a plain `npx vitest run` collect its failing tests. It should move outside the project folder.
- **Private material.** Both prototypes run on the owner's document. Nothing from it enters the repository: the experiments use public fixtures.
