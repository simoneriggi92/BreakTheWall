# The lab: the importer as a console

A variant of the object prototypes, beside [object-approaches](../object-approaches/) and [guided-reading](../guided-reading/), which stay as they were. **Not part of the product.** It draws one public fixture, `importer-signals`, as a designed object: a night console with a cam programmer. It shows two states of the same object:
- the whole, with a part selected;
- the round opened, as a level stacked under the whole: the whole stays above, transparent and pressable, and the round's five cams are spread along their shaft below.

**Progressive construction** is on by default and can be switched off from the bar. A part appears in the section that first cites it; before that it is a dashed footprint on the bench. A cable appears from the first section that cites its joint, once both of its parts are there.

## Open it

From the repository root:

```sh
python3 -m http.server 4321 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4321/prototypes/object-lab/`. It reuses `../guided-reading/data.js`.

## The screen

- left: the path through the source, one step per section;
- centre: the object, with a breadcrumb and "Torna all'insieme";
- right: a miniature of the whole marking where you are, then the selected part;
- bottom: the original source, always visible, resizable by its top edge, with adjustable text size.

"Come è costruito" opens a note with:
- the three objects considered;
- the component table: what each part is in the object, its passages, and where the analogy ends;
- the split between what is hand-made, what comes from the data, and what is interactive.

## Hand-made, from the data, interactive

| | |
|---|---|
| **Hand-made** | the choice of object; each part's shape, place and material; where cables attach; the "in the object" and "where the analogy ends" texts |
| **From the disassembly** | names, roles, points and citations; the round's five steps and their joints; every relation and its label (no cable without a joint); one board lamp per incoming joint; the display values (the run's variables); the printer's rows (the register's role); the path and what each section does (from the citations); which step writes the stamp and the finish time (the step and the joint cite the same lines) |
| **Interactive** | hover (name, what a press does, the lines previewed in the source); selecting a part or a relation; opening the round (a second press, double click, Enter or ↓); going back (the button, the miniature, Escape or ↑), which restores the step, the selection and the source's scroll; ← → through the steps; the resizable source |

The drawing is hand-written SVG. No image generation is available in this environment.
