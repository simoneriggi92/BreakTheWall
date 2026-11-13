# Research: a representation encoder, a scene proposed by the model and checked by the app

Date: 2026-11-03. The owner's feedback on the lab (plan [P-20261103-lab-mode](../plans/P-20261103-lab-mode/plan.md), `verification_pending`):
- the graphic representation is where the lab falls short;
- a static mockup made for one of the owner's documents "made the concept easier to grasp";
- the lab lacks that immediacy;
- the app should not be bound to a fixed library: an "encoder" should ask the AI for the representation that suits each source, and build it on demand.

This research asks four questions:
1. What makes the mockup immediate, and what the lab lacks.
2. Can a scene proposed by a model be checked so that it invents nothing?
3. Does a scene drawn from primitives read better than today's lab?
4. Where would the encoder sit in the app's flows, and what a plan must decide first?

## Evidence

- **The owner's mockup.** A static image of the guided view for a private README describing a small web service. Only its behaviour is described here:
  - the source is an atlas of four areas, read in order;
  - one area, the mechanism, is drawn as an object of three everyday containers (a tray of standing cards, a box with a clear lid, a holder with a sheet);
  - each container carries the source's own nouns on its faces (the input fields, the outputs);
  - two arrows carry verb labels;
  - the card lists each container with what it does;
  - a note says that the other areas stay in the atlas because they are not pieces of this mechanism;
  - the mockup labels itself "static mockup · interpretation of the README · implementation not verified".
- **Research [R-20261103-lab-mode](R-20261103-lab-mode.md)**, "The open problem: who composes the whole", option B: an object spec from the model, from closed lists, validated by the app, falling back to the rules (option A). The plan built option A and left B out (its Risks: "an object spec from the model … is the way to close [the gap], outside this plan").
- **The app on `feature/lab-mode`** (`967458d`):
  - `src/core/representation.ts`: `chooseRepresentation` maps each part by its `icon` to one of 23 bench components and each joint by its type. One failure means an atlas.
  - `src/renderer/lab/`: the bench, the atlas and opened levels. `cabinet.tsx` holds the projection and the primitives (`Box`, `Plateau`, `cable`, `Label`, `Pills`).
- **Generation, where a new request would sit.** `src/desktop/generator.ts:100–210` (`Generator.generate`):
  - the structure first;
  - then each top-level part's content, in a pool;
  - then the runs.

  Each phase has a strict JSON schema (`src/core/disassembly-generation.ts`, `structureJsonSchema` and the others), is checked in core, and may be repaired once (`withRepair`, `buildRepairRequest`).
- **The assistant route.** `src/mcp/server.ts:112–142`: `start_disassembly`, `read_source`, `submit_structure`, `submit_part`, `submit_runs`. The assistant writes, the app checks.
- **Per-part analogies already exist.** `metaphor: { text, limit }` is an optional field of each part (`src/core/disassembly.ts:47`). The content request asks for "an everyday analogy and where it stops working, or null" (`CONTENT_INSTRUCTIONS`, `disassembly-generation.ts:136`).
  - In the public fixtures these analogies are isolated: "a night guard's patrol" for the importer's round, "a delivery note on a parcel" for the release's start, "the foundation of the building" for Mill's utility.
  - None composes with the others into one scene.
- **The contract.** `disassemblySchema` is a strict object at `schemaVersion: 1` (`src/core/disassembly.ts:93`). A new field is a contract change; data stored beside the disassembly is not.
- **Measures in this research** (private, under the ignored `.local/`, never committed):
  - `.local/research/encoder/validate.mjs`: a draft scene spec and its checker;
  - `.local/research/encoder/scenes/`: scenes for the public fixtures;
  - `.local/harness/encoder.tsx`: a renderer of scenes from primitives, beside the lab's drawings, served by the web build.

## 1. What makes the mockup immediate

| | The mockup | The lab today |
|---|---|---|
| How many objects | 3, one area only | 6–7, the whole source |
| What the objects are | everyday containers whose use is known (cards in a tray, a box, a sheet in a holder) | modules picked by icon from 23 components; most draw as a box with an icon |
| What is written on them | the source's own nouns (the input fields, the outputs) | a face only when the part's lines have a structure (a table, a list, numbered steps) |
| Arrows | two, with a verb | 6–8 cables, with the joint's label |

Three things carry the immediacy:
- **few objects**, from a chosen area;
- **silhouettes that say what they do**;
- **the source's words on the objects**.

The fixed library limits the second. The lab's rule "one representation for the whole source" limits the first.

## 2. Can a proposed scene be checked?

**The draft spec.** It covers one level: the whole, or one part's sub-parts.

```text
scene:
  level:       null (the whole) | a part id (its sub-parts)
  title:       the analogy's name, ≤ 48 characters
  objects:     one per part of the level →
                 part, shape (a primitive), face (≤ 6 items, ≤ 24 characters each), look (≤ 130), limit (≤ 130)
  annotations: parts of kind limit, drawn as notes, not objects
  links:       one per joint of the level → from, to, label
```

**The primitives.**
- Seven are neutral, holding things: `tray`, `box`, `holder`, `panel`, `sign`, `stack`, `drawer`.
- Four claim a behaviour: `turntable` (repeats), `switch` (opens or closes), `dial` (measures), `belt` (carries).
- None is structural: there is no beam and no column, so no shape can say that something "falls".

**The checker's rules.** A scene is accepted only if:
- R1: every part of the level appears once, as an object or, for a limit, as an annotation;
- R2: every shape is a primitive, and a behavioural one appears only in a mechanism;
- R3: there is one link per joint between drawn parts, with the joint's own label, and no other link;
- R4: every face item appears in the lines its part cites (its sub-parts' included), or is the name of one of its sub-parts;
- R5: `look` and `limit` are present and short.

**The measure.** I wrote the scenes as the model would: a first draft without looking the lines up, then one repair from the checker's findings, as `buildRepairRequest` does today.

| Scene | First draft | After one repair |
|---|---|---|
| Release › image (3 objects) | 1 finding: a face item too long | accepted |
| Release, whole (6) | 3: two face items not in the part's lines, one paraphrased label ("on failure" for "failed test") | accepted |
| Importer, whole (7) | 6: four face items not in the lines ("imported", "30 minutes" for "thirty minutes"…), and one dependency drawn in the flow's direction | accepted |
| Mill, whole (7, one annotation) | 3: a measuring dial for the claim, a face item not in the lines, an invented link from the rejected part | accepted |
| Release › image, invented on purpose | 3 out of 3 caught: a face item not in the source, a paraphrased label, a link with no joint | not repaired |

Findings:
- **The check is mechanical and cheap.** It catches the inventions the owner fears: a relation with no joint, writing that is not in the source, a reworded joint, a shape whose behaviour the source does not state.
- **Not everything can be checked.** `title`, `look` and `limit` are analogy texts by nature. They stand where `part.metaphor` stands today: shown as an analogy, always with where it ends.
- **One rule of the spec must change.** A link must name its joint as stated. The renderer chooses the arrow's direction, as `flowOf` does today. My one "invented link" in the importer was a dependency written in the direction of the flow.
- ⚠ **Bias.** The same author wrote the checker and the scenes. This measures the checker's coverage, not a model's ability to produce scenes. A real model on a real route has not been tried (see question 4).

## 3. Does a scene read better?

Each scene was drawn from the primitives with the lab's projection, at the lifted canvas size (764×460), beside today's drawing of the same level.

| Level | Scene | The lab today |
|---|---|---|
| Release › image, 3 parts | **Reads at once:** two stacked crates (the two-stage build, with "non-root user", "port 8080" on them), a belt (the push), a holder with a sheet listing "commit, image, tag, digest, built_at". Three silhouettes, three uses. | Three identical boxes with an icon and a name. |
| Release, whole, 6 | Crowded: two rows, labels over objects, the way back hard to follow. | Crowded the same way. |
| Importer, whole, 7 | Crowded: names covered, eight arrows crossing. | Crowded the same way. |
| Mill, whole, 7 | "A notice on the town hall door" passes the check, but reads no better than the atlas: the containers say nothing about reasons. | The atlas: regions and arrows. |

Findings:
- **The number of objects decides first.** At three objects, shapes and faces from the source make the level immediate. At six or seven, no vocabulary saves the composition. This is also why the mockup draws one area only.
- **Neutral primitives let an argument pass as an object** without inventing a physics: there is no bench-style failure, since nothing claims to hold weight. But they do not make it clearer. For arguments, the atlas stays the better default.
- **The vocabulary is cheap to extend.** Each primitive in the harness is 3–8 lines over the lab's `Box`, `onFront` and `onTop`. What costs is composition: places, rows and crossings.

## 4. Where the encoder would sit

```text
structure → content → runs                                   (today)
                         ↓
                      scene (per level, ≤ 5 parts) → checked in core → stored → drawn
                         ↓ rejected after one repair, or no route
                      today's lab (bench or atlas)
```

**The request.**
- Its input is the level's parts, joints and cited lines: a few thousand characters.
- Its output is one scene.
- On the ChatGPT and local routes it would be a fourth phase, with its schema, check and one repair, like the others.
- On the assistant route it would be a fifth tool (`submit_scene`).

**When to ask.**
- *At generation*, for every level that qualifies: no wait while reading, but one more request per level, for levels the learner may never open.
- *On opening a level*: requests only for what is read, but a wait and a provider at reading time. This is impossible offline and for prepared fixtures.

**Where to store it.**
- *Beside the disassembly*, as presentation: no contract change, and it can be regenerated.
- *In the contract*, as an optional field: it travels with the disassembly through the assistant route and between devices.

The previous research left the same choice open. A scene is tied to a revision: when a part is taken apart further (`isExpansionOf`), its level's scene is stale.

**Prepared fixtures.** They have no route. Their scenes would be written by hand, like their texts, and checked by the same rules.

## The decision this needs from the owner

**One representation per level, not per source.** The mockup is the mixed composition excluded so far: an atlas of the whole, with one area drawn as an object.

Measure 3 suggests a form of it that keeps the lab's rule inside every drawing:
- the representation is chosen per level;
- the whole of a large source can be an atlas;
- an opened level of up to about five parts can be an object, from a checked scene.

No drawing mixes the two: opening a region of the atlas lifts out an object, as L9 already lifts a level. The decision is the owner's: it changes the requirement "for each source the app chooses one overall representation".

**Decided by the owner (2026-11-03): "Yes, per level".** The representation is chosen per level. The requirement of 2026-11-03 morning ("one overall representation per source, no mixed composition") now reads: one representation per drawn level, never two in one drawing. A plan built on this research takes it as given.

## Assumptions

- A model given a level's parts, joints and lines can write scenes that pass the check after at most one repair. Untested on a real model.
- Immediacy at three objects comes from silhouettes and the source's words, not from the mockup's photographic rendering. The harness draws in the lab's flat style; the owner judges whether that is enough.
- Levels of five parts or fewer are common enough to matter. In the English public fixtures, all six sub-assemblies have 3–5 parts (release: 4, 3, 5; importer: 5; Mill: 3, 3). The owner's generated disassemblies seldom have sub-parts (R-20261102-depth-in-advance), so for them the first object level may be the whole, with 5–7 parts.

## Risks

- **Seven parts at the top.** Generated disassemblies often have 5–7 top-level parts and few sub-parts, so the scene would most often meet the case where it reads worst. Choosing an area, as the mockup does, needs either depth or a grouping of top-level parts. Grouping is a structure question, not a drawing one.
- **Analogies that mislead.** `look` and `limit` cannot be checked against the source. A confident wrong analogy teaches something false. They must always be shown as an analogy, with their limit, as `part.metaphor` is now.
- **Cost and routes.**
  - One more request per qualifying level.
  - Local models may not follow a strict schema well.
  - ChatGPT inference is still not witnessed on this account (adapter, open questions).
  - Without a route, the app falls back to today's lab, so generated disassemblies opened offline get no scene.
- **Two vocabularies to maintain.** The bench's components and the scene's primitives would overlap. One engine with one set of primitives, where the bench becomes the rule-made scene, is the tidy end state. It means revisiting L5–L7.
- **Privacy.** On the ChatGPT route the request sends the level's lines to OpenAI again. The generation already sends them, and the consent already covers it; the stored origin must still say so.

## Recommendation

**Planning is justified, after one decision and with one gate.**

1. **The owner has decided** (2026-11-03): the representation is chosen per level, an atlas of the whole with an object for an opened level.
2. **The plan's first task is a gate:** the scene request on a real route (the local route, verified in an earlier plan), on the public fixtures and on the owner's generated disassemblies. Recorded per level:
   - accepted at once, after one repair, or rejected;
   - the checker's findings;
   - the owner's look at the drawn scenes.

   If the model rarely passes, the plan stops there, with the checker and the primitives as its only output.
3. **Then the smallest slice:**
   - the scene schema and checker in `src/core`, pure and tested;
   - the primitives in `src/renderer/lab`;
   - scenes for opened levels of up to five parts only;
   - storage beside the disassembly;
   - asking at generation;
   - the current lab as the fallback everywhere.

**Not first:** scenes for whole sources of 6–7 parts, scenes for arguments, generated images (the earlier research's option C: parts cannot be pressed and labels are unreliable).

## Open questions

- ~~May the representation be chosen per level?~~ Yes, decided by the owner on 2026-11-03.
- At generation or on opening a level?
- Beside the disassembly, or in the contract?
- Should a large top level be grouped into areas, as the mockup does? That would be a structure change for generation, with its own plan.
- Does the flat style of the primitives reach the immediacy the owner wants, or does the owner expect the mockup's rendering?
