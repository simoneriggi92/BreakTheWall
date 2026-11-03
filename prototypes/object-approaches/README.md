# The object: three approaches

An experiment that follows the owner's question after plan [P-20261102-guided-reading](../../docs/workflow/plans/P-20261102-guided-reading/plan.md) v4: someone who opens the plates asks "but what is it?". **Not part of the product.** The page draws the same two public fixtures three ways, so the approaches can be compared side by side:
- `importer-signals`, a mechanism;
- `mill-harm`, an argument.

## Open it

The page has no dependencies and reuses `../guided-reading/data.js`. From the repository root:

```sh
python3 -m http.server 4321 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4321/prototypes/object-approaches/`. The hash picks a fixture and an approach, for example `#mill/A`.

## The approaches

| | Idea | Computed from the disassembly | Drawn or decided by hand |
|---|---|---|---|
| **A · Modules in a body** | Each part becomes an illustrated component from a fixed library, mounted in a body that names the whole: a case for a mechanism, a load-bearing frame for an argument. | the component (from `icon` and `kind`); the layout (from the joints); wires and their labels; one lamp per incoming joint; the display values (from the run's variables); the run's effects; in the frame, each part's place from its kind | each component's drawing, once for every source; the body's name, which the model would choose from a closed list |
| **B · The round's line** | The mechanism is time: the round travels a track through its steps and leaves marks in the registers. The learner runs it: pause, a hanging feed, a refusing feed. | the stations (the round's sub-parts, in joint order); which register hangs from which station, when the joint and the station cite the same lines | the simulation's rules, from the cited lines 51–68, 75, 89–93, 141–144, 156–162 and 180–208 (the contract does not hold them); where the outcome log hangs (no cite ties it to a step) |
| **C · A scene from the metaphor** | The disassembly already has metaphors. The scene draws them, so something familiar answers "what is it?". | which parts have a metaphor, and its limit; what is left out | the whole scene; which clause of the metaphor is which step |

B does not apply to Mill: an argument has no time that flows, and a line would say that one premise produces the next.

In C, **"Extend the metaphor"** shows what would have to be invented to cover every part. Each invented element is hatched in orange and listed under the scene.

## What each shows, before anyone tries it

- **A** answers "what is it?" with a body and recognisable components, and it is the only one composed entirely from existing fields. In the frame, the support joints become steel struts, and a premise stands on its own plinth so that it does not seem to rest on the ground. The drawing can still suggest necessity: "remove a brick" makes the beam crack, as the fixture's run says, but the frame cannot show that the sovereignty verdict is an interpretation, except as a label.
- **B** makes the difference between a pause and a hang visible as movement. It needs rules the contract does not have, and it does not apply to arguments.
- **C** is the most recognisable, and the most fragile. The importer's metaphor covers 4 of the round's 5 steps and none of the other 6 parts; Mill's metaphors cover 2 of 7. Extending them means inventing, and in one case the invention contradicts the source: the supervisor "phones" the guard, while the source says the rule restarts the importer.

## The 10-second test

**"Prova dei 10 secondi"** shows the drawing alone for ten seconds, with one part highlighted. It then asks two questions:
- what the object is;
- what the highlighted part does.

Answers stay in this browser's `localStorage` (`btw:object-test:v1`) and are listed in the panel. This is the recognition criterion the guided-reading plan lacked: it is meant to be run with people who do not know the source.

## Limits

- Hand-made: the component drawings, both scenes, the simulation's rules, the matching of metaphor clauses to steps, and the body names. They are written for these two fixtures.
- Two fixtures only, both prepared. A generated disassembly may have no metaphors, other icons, or joints that make a layout this clean impossible.
- No accessibility work beyond clickable parts and reduced motion.
