# The lab chooses: object or atlas

A variant of [lab-argument](../lab-argument/), on the public fixture `mill-harm`. **Not part of the product.** It tests the owner's idea of 2026-11-03: the app decides how to draw a source, instead of one fixed representation. The 2026-11-01 report already separated the **representation** (an object or a nested atlas) from the **reading behaviour** (progressive building, opening and return, which serve both). It left the criterion open.

## Open it

From the repository root:

```sh
python3 -m http.server 4321 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4321/prototypes/lab-atlas/`. It reuses `../guided-reading/data.js`.

## How the app chooses

[`choose.js`](choose.js) reads only the disassembly:
- the types of the top-level joints;
- which parts take part in a flow (`sends-to`, `causes`);
- the parts' kinds;
- whether their cited lines hold tables or code.

| If… | View |
|---|---|
| at least half of the joints are logical or narrative | **atlas** |
| at least three quarters of the parts are in a flow | **object** |
| a core is in a flow and the rest only depends on it | **hybrid**: the object for the core, the atlas around it (not drawn here) |

The thresholds are a first guess. The page says why it chose, and the learner can switch views at any time: parts, joints, citations, the path and the load test are the same in both.

Results on the public fixtures:

| Fixture | Choice | Signal |
|---|---|---|
| `mill-harm` | atlas | 5 of 5 joints are logical; no part is in a flow |
| `importer-signals` | object | 6 of 7 parts are in a flow |
| `atlas-release` | object | 7 of 7 parts are in a flow |

## The atlas

Composed by rules, like the frame:
- one region per part;
- sub-parts are regions inside its perimeter, so the perimeter means "contains";
- relations are arrows between perimeters.

The most joined part is the centre. The others take the side given by their relation to it:
- what supports it stands in front;
- what follows from it stands behind;
- limits are on the left and attacks on the right;
- a part with no relation lies apart, marked "nessun legame esplicito".

Distance and size mean nothing.

In the load test, the atlas states only the run's verdict ("perde il sostegno", "si indebolisce", "regge"). It does not stage a collapse.
