# The lab on an argument, composed by rules

A variant of [object-lab](../object-lab/), on the public fixture `mill-harm` (Mill, *On Liberty*, ch. I). **Not part of the product.** It tests the lab on an argument with a prose source. Unlike the console in object-lab, **the whole object is not drawn by hand**: a grammar written once for arguments composes it from the kinds of the parts and the types of their joints.

## Open it

From the repository root:

```sh
python3 -m http.server 4321 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4321/prototypes/lab-argument/`. It reuses `../guided-reading/data.js`.

## The grammar

| Rule | Becomes |
|---|---|
| a part that **supports** another | stands under it, joined by a coral load pin: a ground is a slab, a premise a column on its own plinth |
| a part that is supported | the beam |
| what the beam supports | a deck on the beam, one room per sub-part |
| a part that **limits** | a steel clamp on the end of what it limits, one tab per sub-part |
| a part that **attacks** | an amber wedge on the edge of what it attacks |
| rejected, or with no joint | a tray to the side |

## Hand-made, from the data, interactive

| | |
|---|---|
| **The library (per kind, not per source)** | the shapes and materials; the "in the object" and "where the analogy ends" texts |
| **From the disassembly** | every place in the object; names, roles, points, metaphors, citations; the joints and their labels; the load test and its verdicts; the path (one step per paragraph, because the source has one heading) |
| **Interactive** | selecting and opening (the part lifts out of the whole); going back to the reading point; "Esplori" when the explored part lies outside the passage being read; the load test (take a brick out, predict, then see the claim fall, bend or hold); progressive building; the source formatted or as written |

## What it shows

See [research R-20261103-lab-mode](../../docs/workflow/research/R-20261103-lab-mode.md), "Measure 1, first case". In short:
- the grammar places every part;
- the faces rule finds nothing in prose;
- the contract cannot say whether two supports are needed together or each suffices;
- a falling beam overstates a verdict that the fixture marks as an interpretation.
