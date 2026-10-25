# Product definition

Status: identity fixed by the owner on 2026-10-24, before the lab prototype. First-alpha scope approved in plan v1 on 2026-10-21; the shipped player still uses the earlier "lesson" vocabulary (see [From lesson to disassembly](#from-lesson-to-disassembly)).

## Identity

> **Break the Wall takes apart whatever you want to understand (a source, a repository, a topic) into its parts, and shows you how they work together. You have understood it when you can put it back together.**

The idea comes from reverse engineering: tools such as [REA](https://github.com/morluto/rea) take software apart, with evidence for each finding, so that you can understand and rebuild it. Break the Wall applies the same principle to knowledge. The name already says it: the wall of text becomes **bricks**, and each brick is a part tied to its source.

```
     DISASSEMBLE                  RUN                       REASSEMBLE
  wall → parts            make the mechanism move        put the parts back
  (parts, relations,      (press, predict, watch what    (the proof you understood,
   each with its source)   changes and why)               when and if you want it)
            └──────────── every part goes to the ────────────┘
                        PARTS STORE (the learner's atlas)
```

- **Disassemble.** The AI breaks the material into 3–7 main parts and the relations between them. Every part keeps a link to the lines it comes from.
- **Run.** The learner puts a joint under load: changes an input and watches what moves, removes a premise and checks whether the conclusion still holds, or applies a part to a new case. It is always an action by the learner that tests a connection, never more text from the AI.
- **Reassemble.** The learner puts the parts back in place. It is optional, and it is the real test.
- **Parts store.** Every part understood goes into a personal atlas that grows across disassemblies. The learner decides whether and when to come back to it.

**⚠ Where the metaphor stops.** Taking software apart has an objective answer: the binary is what it is. Taking a topic apart involves interpretation, and the model can be wrong. This is why every part stays attached to its source and why model inferences must stay distinguishable from quoted content. Evidence is this product's equivalent of reverse engineering's proof.

### One disassembly, three kinds of joint

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

### Signature: the exploded view

Engineering manuals use the exploded-view drawing: the assembly with its parts pulled apart, leader lines to each one, the order of assembly. It is the product's visual signature:
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

- **The learner's question decides what opens.** Relevant parts are taken apart in depth; the others stay closed sub-assemblies, visible with their function and source, openable on demand.
- **Nothing disappears silently: the bill of materials.** Every section of the source is either assigned to a part or listed as **not taken apart**, with a reason (outside the question, repetition, context). The host checks it as it checks citations: a line range neither assigned nor excluded is a finding.

| Approach | What happens to what is left out |
|---|---|
| Summary | it disappears, and the learner does not know |
| Bill of materials | it is visible: "these 40 lines were not taken apart, because…" |

⚠ The bill of materials guarantees that nothing vanishes, not that the choice of what to open is right. That still needs claim review and the coverage metrics measured by `npm run eval`.

Generation follows the same shape: a first request produces the bill of materials (parts, sub-assemblies, assigned and excluded line ranges); the host validates it; then each part is written separately. This is the two-phase pipeline of plan P-20261022-generation-quality (Q3), and the path to sources larger than one request.

### Visual direction: the technical drawing

Status: **adopted** by the owner on 2026-10-24, after the [lab prototype](workflow/research/R-20261024-lab-prototype.md). The app must support both themes; blueprint is the dark theme. The style must favor clarity, reading and focus, and suit every subject.

- **Technical drawing.** Light paper, ink lines, leader lines from each part to its source, generous white space. It is the language of the exploded view itself, and it fits an argument as well as a machine.
- **Blueprint** as the dark theme: light lines on blue, a variant with its own character rather than an inverted palette.
- **One color per kind of joint** (mechanism, argument, story), always paired with shape and label.
- **Icons:** lucide for the interface, which the app already uses; a dedicated set only for kinds of joint and part, the product's own visual language.

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

## The disassembly loop

1. **Choose what to take apart.** The learner's question is the goal ("how does the frontend deploy from TeamCity?"); the app shows which material will be used.
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

Next: [plan P-20261024-disassembly](workflow/plans/P-20261024-disassembly/plan.md). It builds, in order:
- the contract;
- the player;
- two-phase generation;
- then, as gated phases, repositories and PDF documents as sources.

Later, after the alpha core:
- **Dependency map for repositories.** It shows where a part lives (solution, project, namespace, file) and who references, registers or resolves it, one level at a time. The app computes it from the code, not the model; with dependency injection, the container's registration and resolution are edges too.
- **Simulated reassembly.** After each placed part, the mechanism runs with the current assembly. The learner sees what breaks when a part is in the wrong place, and why: a part placed before its input arrives is missing what its incoming joint carries.
- The cross-disassembly parts store, AI-assisted web discovery, further document formats, contextual regeneration, and richer feedback.

These are direction, not completed features. Analysis of a whole repository without a question, arbitrary executable simulations, collaboration, synchronization, billing, and automatic mastery scoring are outside the first alpha.

## Learn from use

Record feedback against the relevant part or block: useful explanation, excessive density, missing step, incorrect relationship, unsupported claim, or poor representation. Keep topic-specific requests distinct from reusable product problems.

With a small group, observe whether learners can reassemble a relationship, apply it to a new case, and find the evidence. Also observe whether they come back to take apart another problem. Early observations are qualitative; completion alone does not establish learning efficacy.
