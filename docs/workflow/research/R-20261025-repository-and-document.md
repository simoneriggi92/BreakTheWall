# Repository and document sources in the lab

Date: 2026-10-25. Scope: research with the [lab prototype](../../../prototypes/lab/README.md), before approving [plan P-20261024-disassembly](../plans/P-20261024-disassembly/plan.md). No app source, contract, test or dependency is changed.

## Why this research

The owner wants the tool to analyze **code repositories** and **documents**, not only short text sources: "il tool dovrà supportare l'analisi di repo e di documenti". Plan P-20261024-disassembly v1 has repositories only as a gated last phase (D11), and excludes PDF adapters. Before approving it, two real cases were disassembled by hand in the lab to see what these sources demand.

Both cases are private and live only in the ignored `.local/` folder:

| Case | Source | Question |
|---|---|---|
| Repository | The owner's private .NET repository: a connector that polls a public disclosure API, deduplicates, and downloads documents through background jobs | How does the connector's workflow run, and which components take part? |
| Document | One chapter (22 pages) of a commercial programming book, as a PDF | What are threads, what do they cost, and when should you create your own? |

Neither the code nor the book text appears in this note or in the repository. The disassemblies paraphrase the sources; they never copy them.

## What was built

Engine extensions in `prototypes/lab/lab.js`, all generic:
- **Private index.** The public index lists an optional private index under `.local/`, so private disassemblies load without being named in committed files.
- **Many sources.** More than three sources get a file picker. Citations name the file when there are several.
- **Page locators.** A source can carry a page map (page → first line). Citations then read "p. 689 · r. 748–759", and the source pane marks page breaks.
- **Scope.** A disassembly states what was looked at: a repository snapshot, or a document's pages.
- **File-level bill of materials.** `bom.excludedFiles` lists whole files or groups left out, each with a reason. Two new reasons: `secrets` and `generated`.
- **Three-way load test.** Verdicts are `falls`, `weakens` or `holds`.
- **Interchangeable slots.** A reassembly slot can accept a set of parts.
- **Layout check.** Besides overlapping labels and plates, the browser check now flags a joint line that crosses a plate.

Source preparation, done by hand as an adapter would do it:
- **Repository.** A snapshot of 16 files was copied to `.local/`, without the BOM byte. A content scan confirmed that no secret was copied.
- **Document.** The chapter was extracted page by page with macOS PDFKit, and a page map was recorded.

## Checks run

| Check | Level | Result |
|---|---|---|
| Host check on both new disassemblies | automated in the page | 0 forgotten lines. Repository: 16 files, 1,753 lines in parts, 238 excluded, 369 blank. Chapter: 627 in parts, 135 excluded, 21 blank |
| Layout on every sheet of all five disassemblies: labels, plates, text overflow, joints crossing plates | browser script | 23 sheets, 0 findings after one fix (finding 13) |
| No stray text on any part card | browser script | all cards clean |
| Runs | browser script | Repository scenario: 5 steps, with instruments for cursor, deduplication, S3 and job queue. Chapter scenario: 5 steps. Load test verdicts: falls, weakens, weakens, holds. Both cases pass |
| Reassembly | browser script | a misplaced part is named with its hint; three interchangeable supports are accepted in any order; no item numbers are visible |
| Paper and blueprint themes | screenshots | readable |
| Owner's use | witnessed flow | **not done yet** |

## Findings

### Repository

1. **The question scopes the repository.** 16 of the 143 files in the relevant area were read. The other files went into the bill of materials at file level, each with a reason:
   - secrets;
   - generated output;
   - details (DTOs, small records, options);
   - outside the question (another connector, tests, tools).

   Without file-level exclusion, a repository bill of materials would be either unbounded or silent.
2. **Secrets were found by content, not by name.** A configuration file tracked by git contained API keys and a database password. An adapter that only skips `.env`-style names would have sent them. Secret detection must scan contents: known key formats, connection strings, high-entropy strings. It must exclude the file before preview, with the reason shown. The owner was told separately.
3. **Boilerplate dominates line-level accounting.** Most excluded ranges in code were `using`/namespace headers and closing lines. An adapter should exclude these by language automatically, with reason `context`, so that the model and the reviewer spend attention on behaviour.
4. **The bill of materials finds dead code.** Forcing every line into a part or an exclusion surfaced two download methods that nothing calls. For code, the bill of materials is an analysis tool in its own right, not only a guarantee.
5. **A snapshot needs an identity.** The working copy had uncommitted changes in three files, including the polling loop. The disassembly describes the working copy, and its scope says so: commit plus modified files. Generated disassemblies must record this, or a later reader cannot tell what was analyzed.
6. **Sub-assemblies follow responsibilities, not directories.** The workflow spans three projects: the connector, shared connector code, and shared infrastructure. Grouping by directory would have split the scheduling mechanism across two folders. Plan D11 says "directories and modules"; it should say responsibilities, with file paths in citations.
7. **Many files need navigation.** With 16 sources, a picker and file names in citations were necessary.

### Document

8. **The extractor matters.** `pdftotext` silently dropped the "f" ligatures of this book's font ("o" instead of "of", "perorm"). PDFKit extracted the same pages correctly. A document adapter must check extraction quality, for example the share of dictionary words, and try another extractor before accepting the text.
9. **Pages are the natural locator.** The page map turned line citations into page-and-line citations at no cost to the contract: one optional field per source.
10. **Running headers and footers are noise.** Every page carries a page number and a chapter title. Most fell inside the parts' line ranges. One fell between two parts, and the bill-of-materials check caught it as a forgotten line. The adapter should strip running headers and footers during extraction.
11. **Figures are invisible.** Three screenshots exist only as captions. They are excluded with a reason. Image understanding is out of scope, but the exclusion must stay visible.

### Contract and interaction

12. **Arguments with independent supports weaken; they do not fall.** In the chapter, removing one cost (time, or the observed waste) leaves the thesis standing, but weaker. A two-way verdict mislabels this, so the contract needs `falls | weakens | holds`.
13. **Hand layout produced a joint through a plate.** In one sub-assembly, a joint between the first and third plates crossed the second. The label check did not see it; the new line check did. D2's acceptance should include line-plate crossings.
14. **Interchangeable parts need slot sets.** Three independent supports can go in any of three "support" slots. A one-part-per-slot contract would mark a correct answer wrong.
15. **Copyrighted and private sources stay local.** The book text and the code exist only in `.local/`. For the app this means:
    - user documents are stored on the device;
    - the request preview shows which excerpts go to a hosted model;
    - nothing from a user's source enters prepared examples or evaluation fixtures without a suitable license.

## Implications for plan P-20261024-disassembly v1

The plan is awaiting approval. These findings change it enough to warrant a **v2** before approval:

| Area | v1 | Proposed v2 |
|---|---|---|
| D1 contract | two-way load verdict; one part per slot | `falls/weakens/holds`; slot `accepts` as a set; `scope` with snapshot identity or page range; `pages` on sources; `excludedFiles` with `secrets` and `generated` |
| D2 layout | no overlapping plates or labels | also no joint crossing a plate |
| Documents | PDF adapters not included | a **document phase**, as a gated phase like repositories: extraction with a quality check and a fallback, page map, header/footer removal, figures listed as excluded |
| D11 repository | sub-assemblies by directory; secrets by file name | sub-assemblies by responsibility; secrets by content; automatic boilerplate exclusion; snapshot identity (commit and modified files); file-level bill of materials |
| Ordering | repository last, gated on D9 | unchanged gate: both adapters depend on two-phase generation (D9), because neither source fits one request |

## Owner verdict

Given by the owner on 2026-10-25, after using both disassemblies:

| ? | Verdict | Owner's words, in short |
|---|---|---|
| Overall | ✅ a solid starting point | "mi sembra un punto di partenza solido": consolidate the core of the alpha first |
| Repository disassembly | ✅ a good start | Wants a dependency tree, to see where a class sits in the solution and who instantiates or references it |
| Run panel ("Fai girare") | ⚠ readability | The area under the drawing, with the run tabs and the bricks, feels cluttered. "Si può migliorare la UI dopo, ciò che conta è il prodotto" |
| Reassembly | idea for later | After each placed part, simulate what happens, so the learner sees the effect of a wrong place and why |
| Chapter disassembly, page citations, file-level exclusions | not stated | — |

### Where each point goes

- **Run panel readability.** D6 of the plan rebuilds this panel in the app, rather than porting the prototype's. Its layout is designed there: one run at a time, the run's controls next to the drawing, and the feedback separated from the controls. No plan change is needed.
- **Dependency map for repositories.** Later work, after D11, recorded in the [product definition](../../product.md#first-alpha-and-later-work). Builder notes for whoever plans it:
  - it is a different representation from the exploded view: the exploded view shows how a mechanism *works*, the dependency map shows where a part *lives* and what holds it. It fits as a "where it lives and who uses it" view of a part, one level at a time, not as a separate mode, so it respects the 3–7 rule;
  - it must be computed by the app from the code (a compiler or syntax analysis per language), not written by the model, because it is a checkable fact;
  - with dependency injection, "who instantiates" is often the container, not a class. In the repository case nobody calls the download job's constructor: the job runner and the container create it. The map must show registration and resolution as edges, or it will mislead.
- **Simulated reassembly.** Later work, recorded in the product definition. Builder note: for mechanisms, the app can derive the consequence of a misplacement from the joints, without the model. If a part needs what another part sends (for example the deploy needs `release.json` from the image step), placing it earlier means its input is missing, and the joint's label names what is missing. For arguments, placing a premise in the claim's slot reverses the support. The model would only add the "why" in words.
