# The adaptive lab

A prototype that **adapts the representation to the source**. **Not part of the product.** It loads any disassembly, chooses one of three views from the disassembly alone, says why, and composes the chosen view by rules, with no position written by hand. It builds on [lab-atlas](../lab-atlas/) and its chooser, and on the frame of [lab-argument](../lab-argument/).

## Open it

From the repository root:

```sh
python3 -m http.server 4321 --bind 127.0.0.1
```

Then open one of:
- `http://127.0.0.1:4321/prototypes/lab-adaptive/?key=mill`;
- `?key=importer`;
- `?key=release`.

[`fixtures.js`](fixtures.js) is generated from the public fixtures in `src/fixtures/disassemblies`.

A local disassembly opens with `?src=<script>&var=<global>`, where the script sets that global to the disassembly. Private data stays in the ignored `.local/`.

## The three views

| View | Chosen when | Composed as |
|---|---|---|
| **Atlas** | at least half of the joints are logical or narrative | a region per part, sub-parts inside its perimeter, relations as arrows; the most joined part at the centre |
| **Object** | at least three quarters of the parts are in a flow (`sends-to`, `causes`) | an argument becomes a load-bearing frame; a mechanism becomes a **bench** of modules in columns by the order of its flows, each carrying its sub-parts on its lid, joined by cables |
| **Hybrid** | a core is in a flow, the rest is not | the core on the bench; the frame around it as regions. Behind the bench: what the core rests on (the core depends on it). In front: what rests on the core (it depends on the core). The frame is joined by arrows, not cables, because nothing flows along those joints |

**Opening follows the part's nature.**
- A bench module opens into components, with faces taken from its own lines.
- A region opens into sub-regions. When there are more than three, they stand in two rows.

## Checked

At 1280×800, with no console errors:
- the three public fixtures;
- 14 disassemblies in all, counting the owner's 11 generated ones loaded locally;
- every view, and every opened level, of each.

See [research R-20261103-lab-mode](../../docs/workflow/research/R-20261103-lab-mode.md), "Measure 1, third case".
