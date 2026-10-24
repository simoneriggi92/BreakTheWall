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
- **Run.** The learner makes a mechanism move: a sequence, a scenario, a prediction about what happens next.
- **Reassemble.** The learner puts the parts back in place. It is optional, and it is the real test.
- **Parts store.** Every part understood goes into a personal atlas that grows across disassemblies. The learner decides whether and when to come back to it.

**⚠ Where the metaphor stops.** Taking software apart has an objective answer: the binary is what it is. Taking a topic apart involves interpretation, and the model can be wrong. This is why every part stays attached to its source and why model inferences must stay distinguishable from quoted content. Evidence is this product's equivalent of reverse engineering's proof.

### What it is not

| Not… | Because… |
|---|---|
| a chatbot | it does not answer with more text |
| a course or a study app | it has no curriculum; it works on *your* material, when you need it |
| a summarizer | a summary is a shorter wall; here the wall is taken apart |
| gamified | no points or streaks: the reward is seeing the mechanism work and being able to rebuild it |

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

## Purpose

The goal is broader than understanding repositories. A code path, a physical process, an operational runbook and a historical sequence share one player and one disassembly model, each with the representations that suit it. Do not classify people into fixed learning styles.

The test for every feature: would the owner, the first user, use it on a real problem every day?

## Owner requirements

- Desktop application, intended to be open source.
- General subjects, using material uploaded by the learner or information retrieved with AI assistance.
- Deliberately paced: a coherent exploded view of the whole, and one part opened at a time.
- Variety: maps, sequences, comparisons, worked examples, concept lenses, scenarios and meaningful activities. Simulations, animations and games are optional and never forced on the learner.
- A pleasant, clean interface with consistent icons and colors. Progressive disclosure should reduce simultaneous detail.
- Strong links between every part and its source. For code, retain exact excerpts and the lines relevant to each frame.
- A sense of progression without pressure: no streaks, no mandatory review.
- Learner responses, feedback, notes, and iteration from both owner and user feedback.
- The user's ChatGPT account is the preferred AI access direction where supported; unlimited access is not assumed.
- The learner can instead generate with a model already running on their own Mac, chosen in the app. The source then stays on the device. Local models are slower and less reliable than hosted ones, and the app says which route produced each disassembly.

The owner reported that the prototype helped them understand a repository. Use this as evidence of personal usefulness. General effectiveness, repeated adoption, and willingness to pay remain hypotheses.

## The disassembly loop

1. **Choose what to take apart.** The learner's question is the goal ("how does the frontend deploy from TeamCity?"); the app shows which material will be used.
2. **See the exploded view.** The whole, what it does and why it matters, then its 3–7 parts with named relations ("depends on", "sends to", "causes").
3. **Open a part.** One main idea, a suitable representation, a short explanation, and the source lines beside it.
4. **Run the mechanism.** Predict what happens, step through a sequence or scenario, watch what changes. Not every part needs an activity.
5. **Reassemble.** Put the parts or steps back in place; feedback names the precise missing connection, with a hint or worked example. Progress is preserved.

Exploration mode allows navigation without answers. Guided mode can require a response at selected checkpoints. Opening a part, completing an activity and demonstrated understanding are separate concepts.

## From lesson to disassembly

The first alpha shipped before the identity was fixed. The mapping below guides the next plans; none of the new names or behaviors is implemented yet.

| Today (shipped) | Direction | UI term (Italian) |
|---|---|---|
| lesson / percorso | disassembly | smontaggio |
| opening map | exploded view | esploso |
| page | part | pezzo |
| prediction, sequence | run the mechanism | fai girare |
| reconstruction | reassemble | rimonta |
| atlas of concepts | parts store across disassemblies | magazzino dei pezzi |

Not yet built: scenarios (a declarative state machine whose rules cite source lines, rendered as 2D SVG, generated as data and never as executable UI), parts recognized across disassemblies, and opt-in review from the parts store.

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

Next: a hand-made lab prototype of one disassembly (the owner's TeamCity frontend deploy) to test the exploded view, one runnable mechanism and reassembly before changing contracts. Later slices include scenarios, the cross-disassembly parts store, AI-assisted web discovery, additional input adapters, contextual regeneration, and richer feedback. These are direction, not completed features. Whole-repository analysis, arbitrary executable simulations, collaboration, synchronization, billing, and automatic mastery scoring are outside the first alpha.

## Learn from use

Record feedback against the relevant part or block: useful explanation, excessive density, missing step, incorrect relationship, unsupported claim, or poor representation. Keep topic-specific requests distinct from reusable product problems.

With a small group, observe whether learners can reassemble a relationship, apply it to a new case, and find the evidence. Also observe whether they come back to take apart another problem. Early observations are qualitative; completion alone does not establish learning efficacy.
