# Product definition

Status: identity fixed by the owner on 2026-10-24, before the lab prototype, and revised on 2026-11-05: **exploring a source is the core**; run and reassemble come later ([research R-20261104](workflow/research/R-20261104-exploration-experience.md), [plan P-20261105-exploration](workflow/plans/P-20261105-exploration/plan.md)). First-alpha scope approved in plan v1 on 2026-10-21; the shipped player still uses the earlier "lesson" vocabulary (see [From lesson to disassembly](#from-lesson-to-disassembly)).

## Identity

> **Break the Wall takes apart whatever you want to understand (a source, a repository, a topic) and shows you how it holds together, with every piece tied to the lines it comes from.**

The idea comes from reverse engineering: tools such as [REA](https://github.com/morluto/rea) take software apart, with evidence for each finding, so that you can understand and rebuild it. Break the Wall applies the same principle to knowledge. The name already says it: the wall of text becomes **bricks**, and each brick is a part tied to its source.

```
        OPEN AND EXPLORE  (the core, 2026-11-05)                  LATER
  source → its structure → one view, three roles         RUN · REASSEMBLE
  (parts, links with      (guide · structure · source,   (put a link under load;
   their basis, the        one shared state)              put the parts back,
   source's own questions)                                if and when wanted)
```

- **Explore.** The moment a learner opens a source is the product. The app reads the source's structure, decides how to enter it and guides the learner through it, with every part, point and link tied to its lines. The learner never has to choose a representation.
- **Run** and **reassemble** stay in the direction of the product, but they are set aside until they are designed again on top of exploration (owner, 2026-11-04). The [earlier definitions](#run-and-reassemble-later) are kept below.
- **Parts store.** Every part understood can go into a personal atlas across sources. Also later.

**No question needed** (owner, 2026-10-29). Wanting to understand a source is reason enough. By default the learner gives the source and the app takes the whole of it apart: what it is for, how it holds together, and where to start. The learner does not have to know what to ask first; finding that out is part of what the app supports. A question stays available, before generation, as an optional focus.

**⚠ Where the metaphor stops.** Taking software apart has an objective answer: the binary is what it is. Taking a topic apart involves interpretation, and the model can be wrong. This is why every part stays attached to its source and why model inferences must stay distinguishable from quoted content. Evidence is this product's equivalent of reverse engineering's proof.

**First readers** (owner, 2026-11-10). The product is built first for developers who read technical text written or explained by AI: design documents, runbooks, release notes, the long answer to "how does X work". The pain is there: AI writes this text faster than anyone reads it, and a wrong reading has a cost. The first readers decide which examples come first and what the demos show. They never add a mode, a prompt or a view for a subject, and the identity above is unchanged: one loop for every subject.

### The structure of a source

Owner, 2026-11-05, after [research R-20261104](workflow/research/R-20261104-exploration-experience.md). The earlier extractor asked for 3–7 parts and a joint for every part. That forced a source with two bodies of logic into one mechanism, and turned catalogues, findings and paths into parts joined by joints that carried no load. The structure is now read before it is drawn, and nothing is connected that the source does not connect.

```
  SOURCE ──contains──▶ parts ──joined by──▶ links ──each cites──▶ lines
     │                   │ kinds: part · prerequisite · annotation · reference · procedure
     │                   └ each part: a lead and 2–4 points, every point citing its own lines
     └──walks──▶ traces: questions the source itself takes the reader through, step by step
```

| Element | Meaning | Test |
|---|---|---|
| **part** | a piece that does or means something | it cites the lines that define it |
| **link · bond** | A acts on B: sends to, reads, causes, supports, limits, leads to | remove A and B breaks |
| **link · prerequisite** | A must be understood or done before B | remove A and B still holds, only harder to read or do |
| **link · reference** | A points to B without acting on it | none: it orients |
| **link · group** | A classifies B | none |
| **annotation** | a limit, a finding or a warning on one part | shown with its part |
| **reference / procedure** | a catalogue, a file table, a how-to | kept aside, still reachable |
| **trace** | a question the source itself walks | each step names its parts and cites its lines |

- **Basis.** Every link says whether the source **declares** it or the extractor **interprets** it. Interpreted links are counted and shown apart, never mixed in.
- **The app computes the shape, not the model.** Nuclei are the groups the bonds connect. A source can hold several, plus pieces connected to nothing; separate is not secondary, and unconnected is not last. The detector picks the way in from that shape alone, never from a genre.
- **No count of parts and no connectivity rule.** A piece with no link is a correct answer.

**Levels of abstraction (owner, 2026-11-06).** The structure sums the source up; it does not reproduce its inventory.
- **Roles, not named components.** A part is named by the role it plays in the whole, at a grain a colleague would draw on a whiteboard. A role that does nothing new for the whole merges with another.
- **Members.** The components the source names (classes, services, settings, files) are each role's members. They are already extracted with what they do and their lines, shown inside the role on request, and never drawn as parts.
- **Aspects.** The source's large concerns: none, or two to four. Each role names its aspect. A source with a single concern has none.
- **The whole.** One sentence on what the source is about.
- **The problem and what answers it.** A problem only stated to motivate the rest is the premise. A problem the source develops is an aspect of its own. A process around the answer stays a third body.
- **The app derives the levels, never stores them.**
  - The aspect level: one block per aspect, whose joints keep the bonds they stand for.
  - Each aspect's sub-level of roles, with no prerequisites.
  - The premise: the earliest prerequisite when no part opens in its section, read first and alone.
  
  One stored document serves every level.

The three kinds of joint below survive as the vocabulary of a bond's label (sends to, supports, leads to). They no longer change the loop.

### One disassembly, three kinds of joint

Status: the model of the first alpha. Exploration uses the structure above; these kinds return with [run](#run-and-reassemble-later).

The app does not change with the subject. What changes is **what holds the parts together**: the joints. The loop, the exploded view, the source links and the activities stay the same; the vocabulary of joints and the form of "run" follow the material.

```
                  DISASSEMBLY (always the same)
   parts with sources → named joints → exploded view → run → reassemble
                              │
              the kind of joint depends on the material
        ┌─────────────────────┼─────────────────────┐
    MECHANISM             ARGUMENT                STORY
  "sends to", "causes"  "supports", "objects"  "leads to", "because"
```

| Kind | Examples | Parts | Joints | Run = put a joint under load | Reassemble |
|---|---|---|---|---|---|
| **Mechanism** | a deploy, code, anatomy, a physiological process | components | sends to, causes, depends on | change an input and watch what moves | reconnect the flow |
| **Argument** | philosophy, law, essays, design rationale | premises, conclusion, objections | supports, attacks | remove a premise: does the conclusion hold? Find the counterexample | rebuild the argument map |
| **Story** | history, narrative, a sequence of decisions | events, actors, motives | leads to, because | follow the causal chain; apply a motive to a new case | put causes and effects back in order |

An argument is a structure too: premises are load-bearing walls and the conclusion is the roof. Example, Descartes' cogito: (1) I can doubt everything; (2) doubting is thinking; (3) to think one must exist; → I exist. *Which brick, if removed, brings the roof down?* (2) and (3) bear the load; (1) motivates the argument but does not hold it up.

One source can mix kinds: an operational runbook is a mechanism ("the build sends the artifact to…") with arguments inside it ("we deploy X first because Y"). Joints are typed per relation, not per lesson.

Metaphors and transfer scenarios are not a separate mode: a metaphor is a representation of a part, like a concept lens, with its limit stated; a scenario that applies a part to a new case is a form of run.

⚠ **Counterfactuals.** "What if this event had not happened" is speculation in a story. If offered, it is labelled as a model inference, never as content from the source.

### What it is not

| Not… | Because… |
|---|---|
| a chatbot | it does not answer with more text |
| a course or a study app | it has no curriculum; it works on *your* material, when you need it |
| a summarizer | a summary is a shorter wall; here the wall is taken apart |
| gamified | no points or streaks: the reward is seeing the mechanism work and being able to rebuild it |
| a memorization tool | material without structure (a vocabulary list, a list of dates, a poem to experience) has nothing to take apart; the app says so instead of forcing it |

**Scope:** Break the Wall works on anything with a structure: mechanisms, arguments and stories.

### Learning science under the hood

Research on learning shapes how disassembly works; it is the engine, not the product's label. The app does not present itself as a study method.

| Principle | Inside Break the Wall it becomes… | It does not become… |
|---|---|---|
| Retrieval practice | **reassembling** a part, the natural action after taking it apart | quizzes, flashcards |
| Generation and construction | rebuilding the exploded view, deciding where a part goes | homework |
| Spacing | "reassemble again", when the learner chooses | reminders, streaks, guilt |
| Interleaving | recognizing a part already met in another disassembly | a study schedule |
| Managing load | one part opened at a time, from the outside in | long lessons |

Not everything taken apart today needs to be reviewed in 55 days. Review is a door in the parts store, opened by the learner; it is never the core loop.

### Signature: one view, three roles

Owner, 2026-11-04: "the perfect view", in which the benefits of every earlier view come back. One shared state (who guides, where the guide is, what is selected) is read by three roles:
- **the guide** moves it: the whole source by layers, or one of the source's own questions;
- **the structure** shows it: nuclei, prerequisites above what they open, annotations on their part, layers as labelled strips;
- **the source** proves it, in its own order, with a leader line from the selection to its lines; clicking a line selects what cites it.

The source's own index stays beside them, and "how it was read" gives every line a verdict. Exploring off the guide is a pause, with a way back to the step.

### Signature before 2026-11-05: the exploded view

Engineering manuals use the exploded-view drawing: the assembly with its parts pulled apart, leader lines to each one, the order of assembly. It was the product's visual signature, and its leader lines carry over to the view above:
- **parts** detached from the whole, each with a stable icon and a line to its source lines;
- **run** sets the exploded view in motion: packets flow, states change;
- **reassemble** brings the parts back together, and the learner places them.

One level of the exploded view opens at a time, so the map never overwhelms.

### Large sources: sub-assemblies and the bill of materials

The 3–7 parts rule applies **per level**, not per disassembly. Each screen stays manageable; depth grows with the size of the source. Engineers handle complexity the same way, with sub-assemblies: an engine has five groups, each group has its parts, and a group can stay closed.

```
  Frontend deploy (disassembly)
   ├─ Build            ← open sub-assembly (the learner's question goes through it)
   │   ├─ install
   │   ├─ test
   │   └─ artifact
   ├─ Publication      ← open
   ├─ Configuration    ← CLOSED: a black box with its function and its source
   └─ Rollback         ← open
```

- ⚠ **Superseded on 2026-11-05:** no level is taken apart on demand any more. Everything is read before the view opens, and the "take this part apart" action is retired.
- **What opens.** Without a question, the whole source is taken apart and no sub-assembly is closed; deeper levels open on request. When the learner gives a question, it decides what opens: relevant parts are taken apart in depth, and the others stay closed sub-assemblies, visible with their function and source, openable on demand (the example above).
- **Nothing disappears silently: the bill of materials.** Every section of the source is either assigned to a part or listed as **not taken apart**, with a reason (repetition, context, or outside the question when the learner gave one). The host checks it as it checks citations: a line range neither assigned nor excluded is a finding.

| Approach | What happens to what is left out |
|---|---|
| Summary | it disappears, and the learner does not know |
| Bill of materials | it is visible: "these 40 lines were not taken apart, because…" |

⚠ The bill of materials guarantees that nothing vanishes, not that the choice of what to open is right. That still needs claim review and the coverage metrics measured by `npm run eval`.

Generation follows the same shape: a first request produces the bill of materials (parts, sub-assemblies, assigned and excluded line ranges); the host validates it; then each part is written separately. This is the two-phase pipeline of plan P-20261022-generation-quality (Q3), and the path to sources larger than one request.

### Visual direction: the technical drawing

Status: **adopted** by the owner on 2026-10-24, after the [lab prototype](workflow/research/R-20261024-lab-prototype.md), and **kept for exploration** on 2026-11-05, with the revisions below. The app must support both themes; blueprint is the dark theme. The style must favor clarity, reading and focus, and suit every subject.

- **Technical drawing.** Light paper, ink lines, leader lines from each part to its source, generous white space. It fits an argument as well as a machine.
- **The drawing shows, the text reads** (2026-11-05). The drawing's language belongs to the structure and the leader lines. The card and the source stay on paper with reading typography, not drawing conventions: monospace and frames everywhere tire on long text. No sheet frame around the whole window: the view is a workbench of three columns, not one drawing.
- **Conventions with a meaning:**

  | Drawing convention | In exploration |
  |---|---|
  | leader line | from a part or a point to its lines |
  | solid / dashed line | a link the source declares / one the extractor interprets |
  | separate views on one sheet | separate nuclei, with an explicit change of aspect |
  | position numbers | the steps of a guide, the labelled layers |
  | title block | "how it was read": who extracted, coverage, basis |

- **Color carries the role** (2026-11-05): main nucleus, another aspect, prerequisite, annotation, aside. Basis is carried by the stroke, never by color. Color is always paired with shape and label.
- **Blueprint** as the dark theme: light lines on blue, a variant with its own character rather than an inverted palette.
- **Icons:** lucide for the interface, which the app already uses; a dedicated set only for kinds of part, the product's own visual language.
- ⚠ **Fixed as tokens before building views.** Prototypes drift toward a generic look (rounded cards, pills); the style is set in tokens first and the views are built on them.

Order of work: write the principles, express them as tokens in code, test them on the real content of the prototype, and use Figma only to explore variants. Rejected: an electronic-circuit theme, which reads as "for technicians only", contradicts the any-subject scope and tires the eye on long text.

## Purpose

The goal is broader than understanding repositories. A code path, a physical process, an operational runbook and a historical sequence share one player and one disassembly model, each with the representations that suit it. Do not classify people into fixed learning styles.

The test for every feature: would the owner, the first user, use it on a real problem every day?

## Owner requirements

- Desktop application, intended to be open source.
- General subjects, using material uploaded by the learner or information retrieved with AI assistance.
- Deliberately paced: a coherent exploded view of the whole, and one part opened at a time.
- Variety: maps, sequences, comparisons, worked examples, concept lenses, scenarios and meaningful activities. Simulations, animations and games are optional and never forced on the learner.
- A pleasant, clean interface with consistent icons and colors. Progressive disclosure should reduce simultaneous detail.
- Two interface languages, English and Italian (owner, 2026-10-25). The default follows the system and the learner can change it. The interface language is independent of a disassembly's content: each disassembly is written in one language and says which, and the app never translates sources or content.
- Strong links between every part and its source. For code, retain exact excerpts and the lines relevant to each frame.
- A sense of progression without pressure: no streaks, no mandatory review.
- Learner responses, feedback, notes, and iteration from both owner and user feedback.
- The user's ChatGPT account is the preferred AI access direction where supported; unlimited access is not assumed.
- The learner can instead generate with a model already running on their own Mac, chosen in the app. The source then stays on the device. Local models are slower and less reliable than hosted ones, and the app says which route produced each disassembly.

The owner reported that the prototype helped them understand a repository. Use this as evidence of personal usefulness. General effectiveness, repeated adoption, and willingness to pay remain hypotheses.

## The exploration

1. **Give a source.** Pasted text or a file; the whole of it is read. No question is needed.
2. **The app reads its structure** (one request, before the view opens) and checks it: every citation in range, every annotation on a part, every bond between parts, every trace through real parts.
3. **The app chooses the way in** from the shape: a source's own question when it walks most of the main nucleus, otherwise the whole source by layers; a source with no connected body opens on the source itself.
4. **The learner explores.** The guide moves one step or layer at a time; anything can be selected off the guide and the guide waits. A point lights exactly its lines. A change of nucleus is announced.
5. **Nothing waits inside the view** (owner, 2026-11-05). Every part, layer and nucleus is read before the source opens; no part is taken apart on demand.
6. **How it was read** is one click away: every line's verdict, coverage, shape, basis, why this way in, and whether the logic follows the chapters.

## Run and reassemble (later)

The loop of the first alpha, kept as direction. It returns once it is designed on top of exploration.

- **Run.** The learner puts a joint under load: changes an input and watches what moves, removes a premise and checks whether the conclusion still holds, or applies a part to a new case. It is always an action by the learner that tests a connection, never more text from the AI. An interpreted link is a natural place to start: "the source does not say it: does A really break B?"
- **Reassemble.** The learner puts the parts back in place. It is optional, and it is the real test.

## The disassembly loop

1. **Choose what to take apart.** The learner gives the source; by default the whole of it is taken apart. A question is an optional focus ("how does the frontend deploy from TeamCity?"); the app shows which material will be used.
2. **See the exploded view.** The whole, what it does and why it matters, then its 3–7 parts with named joints of the right kind ("sends to", "supports", "leads to").
3. **Open a part.** One main idea, a suitable representation (including a metaphor with its limit), and the source lines beside it. The explanation is 2–4 short points, not prose. A point may carry a meaning mark: → a step or consequence, = what stays unchanged, ⚠ a warning. There are no decorative icons per point, because those would not work for narrative or argumentative material.
4. **Run.** Put a joint under load: predict what happens, step through a sequence or scenario, remove a premise, apply the part to a new case. Not every part needs an activity.
5. **Reassemble.** Put the parts or steps back in place; feedback names the precise missing connection, with a hint or worked example. Progress is preserved.

Exploration mode allows navigation without answers. Guided mode can require a response at selected checkpoints. Opening a part, completing an activity and demonstrated understanding are separate concepts.

## From lesson to disassembly

The first alpha shipped before the identity was fixed. The mapping below guides the next plans; none of the new names or behaviors is implemented yet.

| Today (shipped) | Direction | UI term (Italian) | UI term (English) |
|---|---|---|---|
| lesson / percorso | disassembly | smontaggio | disassembly |
| opening map | exploded view | esploso | exploded view |
| page | part | pezzo | part |
| map relations (free labels) | joints typed as mechanism, argument or story | giunti | joints |
| prediction, sequence | run: put a joint under load | fai girare / metti sotto carico | run / put under load |
| reconstruction | reassemble | rimonta | reassemble |
| — | bill of materials | distinta base | bill of materials |
| atlas of concepts | parts store across disassemblies | magazzino dei pezzi | parts store |

Not yet built: typed joints, sub-assemblies and the verified bill of materials, the technical-drawing style, scenarios (a declarative state machine whose rules cite source lines, rendered as 2D SVG, generated as data and never as executable UI), load tests for arguments (remove a premise, find a counterexample), parts recognized across disassemblies, opt-in review from the parts store, and telling the learner when material has no structure to take apart.

## Sources and explanation

| Input mode | Product behavior | First-alpha boundary |
|---|---|---|
| User supplies material | Preview selected content and retain its provenance. | Pasted text and UTF-8 `.txt` / `.md` files. |
| User asks a question and AI finds material | Discover and retrieve sources, then make them inspectable before relying on them. | Planned next slice; never substitute invented links for retrieval. |
| Rich documents or repository | Preserve suitable source locators such as pages or code lines. | Adapters after the first text-based loop. |

“Connect to the source” is the general interaction. “Connect to the code” specializes it for programming. Generated explanations, illustrative examples, and model inferences must be distinguishable from quoted source content.

## Experience rules

- Keep the logo, clear header, left navigation, contextual minimap, and progressively introduced parts store from the prototype direction.
- Keep minimap and parts store in one switchable context area. On smaller windows, use a compact panel rather than compressing the content.
- Give icons stable meanings. Use labels and shape as well as color to communicate state.
- Put source evidence beside or immediately after the part it supports. Changing a code frame must update its highlighted lines.
- Use short concept lenses when needed: what it is, why it matters here, how it works, and its main limitation.
- Match variety to content. A sequence should reveal changes over time; a comparison should expose a meaningful difference.
- A simulated scenario must identify its initial state, the action, and the result. Label illustrative data and relevant simplifications.
- Explain activity feedback. Free-text reflection can be compared with a reference; do not present it as AI-graded if no model evaluated it.

## First alpha and later work

The alpha delivers one complete text-source loop in a macOS desktop app. A shared set of visual blocks must handle a code example and a non-code example without topic-specific UI code. Prepared fixtures support development; at least one real generation per domain is required to verify the alpha.

Done: a hand-made [lab prototype](../prototypes/lab/README.md), in the technical-drawing style. It holds mechanisms, an argument, a code repository and a PDF chapter, all with one engine. The owner's verdict is recorded in research [R-20261024](workflow/research/R-20261024-lab-prototype.md) and [R-20261025](workflow/research/R-20261025-repository-and-document.md): a solid starting point; consolidate the core of the alpha first.

Next: [plan P-20261105-exploration](workflow/plans/P-20261105-exploration/plan.md). It builds, in order:
- a gate on a real model with the structure-first request;
- the structure contract, the detector, the source index and the reading report, in `src/core`;
- generation of a structure through the existing routes;
- the style tokens;
- the view with three roles, as the way a source opens.

Earlier: [plan P-20261024-disassembly](workflow/plans/P-20261024-disassembly/plan.md) built the disassembly contract, its player and two-phase generation; disassemblies made so far stay readable in that player.

Later, after the alpha core:
- **Dependency map for repositories.** It shows where a part lives (solution, project, namespace, file) and who references, registers or resolves it, one level at a time. The app computes it from the code, not the model; with dependency injection, the container's registration and resolution are edges too.
- **Simulated reassembly.** After each placed part, the mechanism runs with the current assembly. The learner sees what breaks when a part is in the wrong place, and why: a part placed before its input arrives is missing what its incoming joint carries.
- The cross-disassembly parts store, AI-assisted web discovery, further document formats, contextual regeneration, and richer feedback.

These are direction, not completed features. Analysis of a whole repository without a question (a text or a document is taken apart whole by default; a repository is larger than one request), arbitrary executable simulations, collaboration, synchronization, billing, and automatic mastery scoring are outside the first alpha.

## Learn from use

Record feedback against the relevant part or block: useful explanation, excessive density, missing step, incorrect relationship, unsupported claim, or poor representation. Keep topic-specific requests distinct from reusable product problems.

With a small group, observe whether learners can reassemble a relationship, apply it to a new case, and find the evidence. Also observe whether they come back to take apart another problem. Early observations are qualitative; completion alone does not establish learning efficacy.
