# Guided reading: the object prototype

An experiment for [research R-20261102-guided-reading](../../docs/workflow/research/R-20261102-guided-reading.md) and plan [P-20261102-guided-reading](../../docs/workflow/plans/P-20261102-guided-reading/plan.md), task G7. **Not part of the product:** the app's guided view draws plain plates. This page asks whether a source read passage by passage is easier to follow when the whole is drawn as an object made of functional shapes.

It runs on two public fixtures:
- `importer-signals`, a mechanism;
- `mill-harm`, an argument.

Use the switch in the header to change between them, and the second switch to compare the object with plain tiles.

## Open it

The page has no dependencies. It needs a static server, because `data.js` is loaded as a script:

```sh
node prototypes/guided-reading/build-data.mjs   # after a fixture changes
python3 -m http.server 4321 --bind 127.0.0.1    # from the repository root
```

Then open `http://127.0.0.1:4321/prototypes/guided-reading/` (add `#mill` for the argument).

| Key | Axis | What it does |
|---|---|---|
| ← → | x | previous or next passage |
| ↓ or double click | y | open the selected part's sub-assembly in place |
| ↑ or Escape | y | back to the whole |
| Z | z | the margin: what the passage leaves out, with its reason |

## What is computed and what is drawn by hand

**Computed from the disassembly, as in the app (`readingRoles`):**
- the passages, cut at headings, or for a source with almost no headings (Mill) at blank lines past about 1,500 characters;
- what each passage does to the drawing: frames the whole, adds a part, returns to a part, relates two parts through a joint;
- the margin;
- when each part and each joint appears;
- the lines highlighted in the source.

**Drawn by hand, for these two fixtures only (`CONFIG` in `index.html`):**
- where each part stands on the board;
- which functional shape it takes.

In the product, both would have to come from the layout and from a closed list the model chooses from. That is a later plan, and only if this experiment helps.

| Family | Shapes | Joints drawn as |
|---|---|---|
| Mechanism (importer) | cycle, register, tape, switch, comparator, gauge | arrow (sends to), dotted arrow (depends on) |
| Argument (Mill) | beam (claim), pillar (premise), foundation (ground), clamp (limit), wedge (objection), field (consequence), crossed block (set aside) | strut (supports), red wedge (attacks), bar (limits) |

**Every line between two parts is a joint of the fixture.** Lines inside a shape, such as a lever, a needle or a reel, belong to that shape. `window.__check()` in the browser console lists the lines drawn at the current level and any that are not joints of the fixture.

## The argument test: suspending a premise

On Mill, a part that supports another, such as the sovereignty premise or the utility ground, can be suspended as a test:
- Its struts break, and their label becomes "sostegno sospeso".
- The claim stays in place. It is marked "non derivata qui" only when every support it has is suspended, and "sostegno ridotto" when some are.
- A suspended premise does not make the claim false. Nothing is removed.

**The contract does not say whether two supports hold jointly or one at a time.** That is why the prototype does not let the claim fall when one support of two is suspended. If this test proves useful, the contract would need to say it.

## Limits

- **Positions and shapes are hand-made for two sources.** The prototype shows the experience, not a generator.
- **Italian interface, English sources.** These are the fixtures' own sources.
- **No accessibility work beyond keys and buttons.** The drawing is not described to a screen reader.
- **The result to look for is not preference.** A test with people should ask them to find a part, explain a relation, and predict what a suspended support changes.
