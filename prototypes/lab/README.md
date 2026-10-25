# Lab prototype

A hand-made prototype of the [product identity](../../docs/product.md#identity): disassemble → run → reassemble, with a bill of materials and the technical-drawing style. It runs outside the app and changes no contract. Its findings are recorded in [research R-20261024-lab-prototype](../../docs/workflow/research/R-20261024-lab-prototype.md).

## Run it

From the repository root:

```bash
python3 -m http.server 4321 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4321/prototypes/lab/>. The page fetches its data, so it needs a server; opening `index.html` directly does not work. Icons come from lucide 0.460.0 on unpkg.

## What it contains

| File | Role |
|---|---|
| `index.html`, `lab.css`, `lab.js` | One engine for every disassembly: exploded view, run, reassemble, bill of materials, paper and blueprint themes |
| `data/atlas-release.json` | A mechanism, with an argument inside its rollback: the public runbook from `eval/cases` |
| `data/mill-harm.json` | An argument: Mill's harm principle |
| `sources/mill-harm-principle.md` | Public-domain excerpt of *On Liberty* (1859), chapter I |
| `data/index.json` | The list of public disassemblies, plus an optional private index at `.local/prototypes/lab/index.json` for the owner's own sources (ignored by git) |

Each data file is a candidate contract, `btw-disassembly/0.1`:
- `whole`: what the subject does and why it matters, with citations.
- `parts`: 3–7 per level. Each part has a kind, a role, citations, and an explanation. Top-level parts use `points`: 2–4 short statements, each optionally marked `step` (→), `keeps` (=) or `caveat` (⚠). Sub-parts use a one-sentence `explain`. A part can also carry a metaphor with its limit, a lens, a critique, and its own `parts` and `joints` (a sub-assembly).
- `joints`: typed relations, grouped in families. Mechanism: `sends-to`, `causes`, `depends-on`. Argument: `supports`, `attacks`, `limits`. Story: `leads-to`, `because`.
- `bom.excluded`: source ranges deliberately not taken apart, each with a reason. `bom.excludedFiles` does the same for whole files or groups, for repositories and documents.
- `scope` (optional): what was looked at, a repository snapshot or a document's page range. A source can carry `pages`, a map of page to first line, so citations show pages.
- `runs`: one of three types:
  - `scenario`: states, variables and steps with predictions;
  - `load`: remove a brick, and see whether the claim falls, weakens or holds;
  - `case`: apply a part to a new case.
- `reassemble`: slots, each accepting one part or a set of interchangeable parts, with a hint per part.

Positions (`at`) are placed by hand on a grid. Generated disassemblies would need automatic layout.

The page also runs the host checks the app would run:
- citations stay inside their source;
- every level has 3–7 parts;
- joints connect parts on the same level;
- every non-blank source line is either in a part or excluded with a reason.
