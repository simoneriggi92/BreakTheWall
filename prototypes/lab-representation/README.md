# The lab: one representation per source

The owner's requirement of 2026-11-03, after the hybrid experiment. **Not part of the product.** Adaptation happens **between sources**: for each source the app chooses one whole representation, either a disassemblable object or an atlas. There is no mixed composition here. The hybrid stays as a separate experiment in [lab-adaptive](../lab-adaptive/).

## Open it

From the repository root:

```sh
python3 -m http.server 4321 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4321/prototypes/lab-representation/?key=importer` (object) or `?key=mill` (atlas). The two sources are also switched from the header.

## The metaphor test

[`metaphor.js`](metaphor.js) chooses from **concrete correspondences**, not from the subject or from shares of joint types. It tries each metaphor in the library: the **bench** for mechanisms, the **frame** for arguments.

| Check | Fails when |
|---|---|
| every part has a component that does what the part does | no component matches (the bench maps by icon, the frame by kind) |
| every joint has a physical connection of its type | the metaphor has no connection for that type |
| the connection asserts no more than the source | it implies a cause or a dependency the source does not state. A load pin says that taking it away makes what it holds fall; this holds only if the source's own load test says "falls" for that brick, not as an inference |

**Context, limits and clarifications need no component.**
- A limit part becomes an annotation.
- Points marked ⚠ are pinned to their component.
- Lines excluded as context are listed under "Annotazioni", linked to the source.

If one metaphor passes every check, the source is drawn as that object. Otherwise it is drawn as an atlas. "Perché questa rappresentazione" shows every correspondence, and for each component where the analogy ends.

## The two sources

| Source | Representation | Why |
|---|---|---|
| `importer-signals` | **object** (bench) | All 7 parts have a component: a round track with its five stations, two clock registers, a tape printer, a key switch, a relay with a dial, a panel with one light per incoming joint. All 8 joints are cables or read cables that say no more than the joint. The frame would break in 15 places. |
| `mill-harm` | **atlas** | Among the available metaphors, none represents this source without forcing. The frame comes closest, but its load pins invent twice. Without "Su se stesso, l'individuo è sovrano" the beam would fall, while the source gives that collapse as an interpretation. And without the claim, "La regione della libertà" would fall, which the source never says. The bench would break in 9 places. |

**The run in the atlas.** Mill's load test speaks of supports, not weight, so that question, action, drawing and explanation say the same thing:
- the learner suspends a part and picks which justifications of the claim stay explicit in the excerpt;
- the answer comes from the `supports` joints and their lines;
- the drawing outlines the suspended region and marks the claim "Perde un sostegno", "Nessun sostegno esplicito" or "Sostegni intatti";
- the disassembly's own explanation follows apart, without its opening verdict word, with an inference marked as one;
- a last line says the test concerns explicit justifications, not the claim's truth.

**Same reading in both.** Both keep the lab's visual language, the source below the drawing, the guided path, opened levels and the return to the reading point.
