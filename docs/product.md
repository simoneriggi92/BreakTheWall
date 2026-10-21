# Product definition

Status: owner goals captured; first-alpha scope and implementation approach approved in plan v1 on 2026-10-21. Implementation has not started.

## Purpose

BreakTheWall helps people understand complex subjects by transforming source material into an interactive learning journey. It supports relationships, concrete examples, and active reconstruction while keeping explanations short and close to what they describe.

The goal is broader than understanding repositories. A code walkthrough, a physical process, and a historical sequence should share a player and learning model while using appropriate representations. Do not classify people into fixed learning styles.

## Owner requirements

- Desktop application, intended to be open source.
- General subjects, using material uploaded by the learner or information retrieved with AI assistance.
- Deliberately paced pages, with a coherent map of the whole and one branch explored at a time.
- Variety: maps, sequences, comparisons, worked examples, concept lenses, and meaningful activities.
- A pleasant, clean interface with consistent icons and colors. Progressive disclosure should reduce simultaneous detail.
- Strong links between explanations and their source. For code, retain exact excerpts and the lines relevant to each frame.
- Learner responses, feedback, notes, and iteration from both owner and user feedback.
- The user's ChatGPT account is the preferred AI access direction where supported; unlimited access is not assumed.

The owner reported that the prototype helped them understand a repository. Use this as evidence of personal usefulness. General effectiveness, repeated adoption, and willingness to pay remain hypotheses.

## The learning loop

1. **Choose a goal and sources.** State what the learner wants to explain or do; show which material the lesson will use.
2. **Get oriented.** Show a small map with named relationships and the proposed route.
3. **Explore a page.** Introduce one main idea through a suitable representation, a short explanation, and accessible evidence.
4. **Respond when useful.** Predict an outcome, arrange a sequence, match elements, or explain a relationship. Do not turn every page into a quiz.
5. **Get feedback and continue.** Explain the precise missing connection, offer a hint or worked example, and preserve progress.

Exploration mode allows navigation without mandatory answers. Guided mode can require an activity response at selected checkpoints. Page visits, activity completion, and demonstrated understanding are separate concepts.

## Sources and explanation

| Input mode | Product behavior | First-alpha boundary |
|---|---|---|
| User supplies material | Preview selected content and retain its provenance. | Pasted text and UTF-8 `.txt` / `.md` files. |
| User asks a question and AI finds material | Discover and retrieve sources, then make them inspectable before relying on them. | Planned next slice; never substitute invented links for retrieval. |
| Rich documents or repository | Preserve suitable source locators such as pages or code lines. | Adapters after the first text-based loop. |

“Connect to the source” is the general interaction. “Connect to the code” specializes it for programming. Generated explanations, illustrative examples, and model inferences must be distinguishable from quoted source content.

## Experience rules

- Keep the logo, clear header, left lesson navigation, contextual minimap, and progressively introduced atlas from the prototype direction.
- Keep minimap and atlas in one switchable context area. On smaller windows, use a compact panel rather than compressing the lesson.
- Give icons stable meanings. Use labels and shape as well as color to communicate state.
- Put source evidence beside or immediately after the concept it supports. Changing a code frame must update its highlighted lines.
- Use short concept lenses when needed: what it is, why it matters here, how it works, and its main limitation.
- Match variety to content. A sequence should reveal changes over time; a comparison should expose a meaningful difference.
- A simulated scenario must identify its initial state, the action, and the result. Label illustrative data and relevant simplifications.
- Explain activity feedback. Free-text reflection can be compared with a reference; do not present it as AI-graded if no model evaluated it.

## First alpha and later work

The proposed alpha delivers one complete text-source learning loop in a macOS desktop app. A shared set of visual blocks must handle a code example and a non-code example without topic-specific UI code. Prepared fixtures support development; at least one real generation per domain is required to verify the alpha.

Later slices include AI-assisted web discovery, additional input adapters, contextual regeneration, and richer feedback. These are part of the direction, not completed features. Whole-repository analysis, arbitrary executable simulations, collaboration, synchronization, billing, and automatic mastery scoring are outside the first alpha.

## Learn from use

Record feedback against the relevant page or block: useful explanation, excessive density, missing step, incorrect relationship, unsupported claim, or poor representation. Keep topic-specific requests distinct from reusable product problems.

With a small group, observe whether learners can reconstruct a relationship, apply it to a new case, and find the evidence. Also observe whether they return for another problem. Early observations are qualitative; completion alone does not establish learning efficacy.
