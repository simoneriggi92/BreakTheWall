# Research: the first minute with a source, and the extractor it needs

Date: 2026-11-04. The owner's direction after reviewing the lab ([P-20261103-lab-mode](../plans/P-20261103-lab-mode/plan.md), `verification_pending`) and the encoder research ([R-20261103-representation-encoder](R-20261103-representation-encoder.md)):
- **Focus.** The core of the product is the moment a learner opens a source and explores it. Run and reassemble come later. They may be folded into the guided reading rather than kept as separate sections, and they are not a priority now.
- **Structure before shape.** A source may hold one or more connected bodies of logic ("nuclei"), plus pieces that are not connected to anything. Today the app forces every piece into one mechanism.
- **The app decides.** A first analysis of the source picks how to approach it. The learner is never asked to choose a representation.
- **Not bound to the object or the atlas.** Both are earlier experiments; the direction should come from the experience.
- **Order.** Where one nucleus is needed to understand another, follow that order.

This research asks four questions:
1. What does today's extractor do to the structure of a source?
2. What would a structure-first extractor return?
3. Can the app choose the way in from the shape of that structure alone?
4. Which first minute should be tried?

## Evidence

- **The generation prompt.** `src/core/disassembly-generation.ts:110` asks for "3-7 top-level parts joined by typed joints". Line 114 requires: "Every top-level part takes part in at least one joint."
- **The contract.** A joint's citations are optional (`src/core/disassembly.ts:42`, `cites: cites.optional()`). The checker validates the shape and the line coverage, not whether the source supports a joint (`checkLevel`, `disassembly.ts:311`).
- **Two real outputs of today's extractor**, stored by the app for the owner's private sources. Only their structure is described here.
  - *A product README of about 200 lines* (a small web app):
    - 6 top-level parts and 5 joints; the parts cite 40% of the non-blank lines.
    - 2 of the 5 joints tie the interface to the project's own build process and to its scope, which do not make it work. A third says the interface "causes" the input flow, which inverts it.
    - The README holds a second body of logic (the project's phases, the folders that mirror them, their status) that the app folded in as one part.
  - *A long technical explainer of about 950 lines* (a backend subsystem):
    - 7 top-level parts and 9 joints.
    - One part covers 240 lines and merges five different things: a reference catalogue, a list of findings, a diagnostic tree, a checklist and a file table. Two joints feed into it, and neither does any work: the tree is a path through the other parts, not a part.
- **A third private source, added by the owner:** *a release runbook of about 340 lines* (build, publish, deploy, verify and roll back an application). The app has no stored disassembly of it yet, so it has no "today" side in the comparison.
- **Outside reference.** A video and screenshots of a document-extraction product, where each extracted field is linked to its region on the page. That product also has a verdict per field, including "unclear" and "policy question", kept out of the score. Its pipeline splits a packet into documents before extracting, and calls an agent only on exceptions. The owner's notebook sketch: a connected mass, unconnected bits, and layers that each add something.
- **A second analysis by the owner with Codex** (a chat, not in the repository). It converges on the same points:
  - provenance visible for every relation;
  - three separate things: the document's order, the structure of its relations, and the path proposed to the reader;
  - "no link supported by the source" ≠ "no relation".
  
  It adds a correction: an isolated warning or definition can be needed early, so unconnected ≠ last.

## 1. Today's extractor forces one mechanism

The two rules, a fixed number of parts and a joint for every part, are enough to explain both outputs:
- what the source holds as two nuclei becomes one;
- reference material, findings and paths become parts, joined by joints that carry no load.

The lab then draws this structure faithfully. No representation can repair a structure that is forced before it is drawn.

## 2. A structure-first extractor

The hand-written extractions in the prototype follow these rules. They are a proposal, not a contract.

| Element | Meaning | Test |
|---|---|---|
| **part** | a piece that does or means something | it cites the lines that define it |
| **link · bond** | A acts on B: sends to, reads, writes, causes, supports, limits | remove A and B breaks (the existing meaning of "run") |
| **link · prerequisite** | A must be understood before B | remove A and B still holds, it is only harder to read |
| **link · reference** | A points to B: where it lives, a table that lists it | none: it orients the map, it bears no load |
| **link · group** | A classifies B: layer, category | none |
| **prerequisite** (kind) | a definition or framing needed to read a nucleus | shown before the layer that needs it |
| **annotation** (kind) | a limit, a finding or a caveat attached to one part | shown with its part |
| **reference / procedure** (kind) | catalogue, file table, how-to | kept aside, still reachable |
| **trace** | a question the source itself walks through, step by step | each step names its parts and cites its own lines |

Every link cites its lines and says whether the source **declares** it or the extractor **interprets** it. There is no limit on the number of parts and no rule that everything connects.

Applied to the three sources, this produces:

| Source | Nuclei | Prerequisites | Annotations | Aside | Lines cited |
|---|---|---|---|---|---|
| README | 2 (6 + 4 parts), joined only by a reference | 1 | 3 | 6 | 72% (today: 40%) |
| Explainer | 1 (10 parts) | 4 | 7 | 5 | 90% (today: 95%) |
| Runbook | 1 (8 parts) | 3 | 9 | 3 | 91% (not generated yet) |

On the runbook, the table that says what a failure at each stage means becomes one annotation per stage. The backend and frontend chapters are two passes through the same chain: the first is the trace, and the second is kept aside as a procedure.

On the explainer, the findings are no longer a list inside one part: each becomes an annotation on the part it concerns. The diagnostic tree becomes a trace.

## 3. The app can choose the way in from the shape

The detector computes, from the links:
- the nuclei (connected components of the bonds);
- their sizes;
- the prerequisites;
- the pieces aside;
- how much of the main nucleus the source's own trace covers.

It needs no genre label ("a README", "philosophy"). This keeps the adapter's rule of one loop and no subject-specific modes. The rule tried in the prototype:

| Shape | Way in |
|---|---|
| no nucleus | the source as the canvas: a collection to explore |
| a trace that covers ≥ 60% of the main nucleus | follow the trace |
| two nuclei of similar size (≥ 0.6) | the map of islands first |
| otherwise | the main nucleus, layer by layer |

The rule gives different results on the three sources:
- **README:** follow the trace, which covers 100% of the main nucleus.
- **Runbook:** follow the trace (100%).
- **Explainer:** layer by layer, because the trace covers only 50%.

⚠ The thresholds are arbitrary; three sources cannot calibrate them.

**Layers follow the direction of the bonds.** At first the layers grew outward from a chosen start, as in the owner's sketch. On the runbook this broke the chain: the first step landed at the bottom and the rollback in the middle. Bonds have a direction, so when they form no cycle, the layers now follow the flow, by the longest path from the parts nothing enters. Only a cyclic nucleus grows from its start.

All three sources are acyclic. The explainer then begins with the parts that write and define, not with its central idea (one state, read by two). Whether that is a loss is for the owner's look to say.

## 4. Three first minutes, in a private prototype

The prototype is outside the repository, because it carries the private sources. It shows the three sources through four views:
- **0 · Extractor.** Today's stored output, with the forced joints marked, next to the structure-first extraction. Each joint explains why it was judged forced.
- **A · Nucleus by layers.**
  - An overview: the nuclei as closed islands, plus counts of prerequisites and of pieces aside.
  - Then the main nucleus grows layer by layer, along its flow. Each step lists what changes, which relation ties the new part to what is already shown, and the cited lines.
  - A prerequisite appears one step before the part it opens. Other nuclei open after the first, and the pieces aside open last.
- **B · Follow a trace.** The source's own question at the top. The whole nucleus stays dimmed, and each step lights its parts, its annotations and its own lines.
- **C · The source as the canvas.**
  - The source keeps its own order, with a gutter coloured by what cites each line.
  - Selecting a part highlights its lines and draws a wire to them.
  - "Why is it linked?" lists each relation with its cited lines and a declared or interpreted badge.

## The owner's look (2026-11-04)

The owner went through all three sources in all three views:
- **All three views are useful and complementary.** Each answers a different question: how the source is organised (A), how to follow one of its threads (B), where each element comes from (C).
- **README:** B and C worked very well. A worked well *after* B.
- **Explainer:** A and C worked well. B felt incomplete: its trace covers half the nucleus.
  - That does not show the source is incomplete. The chosen path may be partial: the diagnostic tree is one of the questions the source answers, not all of them. Or the extraction may have missed steps or parts.
  - The detector must tell these cases apart before it ranks a trace. Two checks: does the source hold other traces, and are the uncovered parts cited inside the lines the trace itself spans?
- **What helped most:** the prerequisites set apart, the unconnected pieces kept aside, and the new parts of each layer highlighted. Together they made the progression and its order clear.
- **To change:** the card in A is still a wall of text above the cited lines. It needs a short list of points first, summarising the source below. Today's contract already gives top-level parts 2–4 marked points (`disassembly.ts:56`, prompt line 135), but the points cite nothing.
- **Open, to evaluate:** can the three views become one view, or a combination, for a more fluid experience?

## 5. One view, three roles (prototype D)

After the owner's look, a fourth view tries the combination. Its premise is that the three views are not alternatives: they are three readers of one shared state. That state holds who drives, how far the driver has got, and what is selected. Kept as separate tabs, each view would hold its own state and they would disagree: B on step 3, A on layer 5, C on another line.

- **The route (B's role)** is a bar at the top with one driver at a time, chosen by the detector: the trace, or the layers.
  - At the end of a trace, "see the whole structure" hands over to the layers, with the parts the trace visited outlined. This is the owner's README experience, B then A, made automatic.
  - In layer mode, the bar lists the new parts of the layer.
- **The structure (A's role)** is the graph. It is lit by the trace, or grown by the layers with the new parts highlighted.
- **The source (C's role)** keeps its own order, with the coloured gutter.
  - It shows the lines of whatever is selected: a part, one of its points, or one of its links. A wire joins the selection to those lines.
  - It also works the other way: clicking a line selects the narrowest part that cites it.
- **The card** puts the points first: 2–4 marked points, each citing its own lines (step →, keeps =, caveat ⚠). Then come the part's annotations and its links with their declared or interpreted badge. The cited lines are folded away, since the source beside the card already shows them.
- **Exploring is a pause.** Selecting anything outside the route marks "Exploring: …" with a way back. The driver's position does not move (the same distinction as L10's explored ≠ reading position).

⚠ **Where it strains:**
- Space: at 1280×800 the map needs both horizontal and vertical scrolling.
- The wire from a node crosses other nodes on its way to the source.

**Revisions after a second look** (the owner's, with Codex):
- **One context does not mean showing everything at once.** The state stays shared, but a "space" control gives the room to the structure, the explanation or the source in turn. A layout is not a separate view: changing it changes no state.
- **The cited points work.** Selecting a point lights exactly its lines, for example a two-line range in the explainer. This is where the summary becomes verifiable.
- **A change of nucleus is announced.**
  - The end of a trace now hands over to the whole main nucleus, not to the next nucleus.
  - Moving on is a separate step, "move to another aspect", with a banner. It says the new nucleus is another theme of the same source, not bonded to the first, and names the only reference that touches it, if any.
  - While it is open, the first nucleus stays visible but quiet.

## Decided by the owner (2026-11-04)

After trying D on the three sources: "the perfect view", in which all the benefits of A, B and C come back. In the owner's words, "il core del prodotto è questo".
- **The direction is D.** It is the core experience of the product, and the owner may want A, B and C kept in the app beside it.
- **Run and reassemble are set aside for now.** They will be introduced later, if at all, and designed properly then.

## Third look and decisions (2026-11-05)

The owner compared D with a second prototype built with Codex on a public document (an architecture description with Mermaid diagrams), then asked for changes to D:
- **The second prototype** has a deterministic extractor: Markdown sections and the edges of Mermaid diagrams, nothing from free text. Two of its ideas were taken into D:
  - an **index in the source's own order**, as a column beside the structure;
  - **layers as labelled strips**, with the layers already seen kept above and the next one shown as an empty strip.
  
  Its card had nothing to explain (a component "named in the diagram"), which is why it lacked D's immediacy. ⚠ Part of D's immediacy therefore comes from content written by hand, which only the gate can confirm.
- **The index** is read from the source's headings by the app, with no model. Each section shows one dot per part, filled once the part is on screen. A section no part cites is marked "not extracted", which makes it a check on the extractor; a section a trace walks is marked with the trace's question.
- **Two guides, named by intent:** "the whole source" (by layers) and "a question of the source" (the trace). A third guide, "the source's order", was tried and removed: the owner found it redundant with the layers, and the index already gives the source's order at a glance. Whether the two orders agree is measured instead (below).
- **The guide's step sits between the structure and the card**, highlighted: the question, the step's sentence and round arrows. Exploring off the guide dims it, with "back to the step".
- **Where traces come from.** The owner asked whether the question came from the generation screen or from several AI paths. It is a path the source itself walks (the explainer's diagnostic tree, the runbook's procedure), not a question asked by the learner. Each source has at most one in the prototype; the contract allows up to three.
- **"How it was read"**, after an extraction-quality screen the owner showed as a reference (one verdict per field, the formula under the number, uncertain cases counted apart):
  - every counted line gets one verdict: main nucleus, another aspect, prerequisite, annotation, aside, only in the source's question, not extracted;
  - a grid with one row per section and one cell per line; a cell opens its line;
  - five readings in words: coverage, shape, basis (interpreted links listed apart), why this way in, and whether the logic follows the chapters.
  
  No accuracy score: a learner's source has no ground truth. Accuracy belongs to the gate, where hand extractions are the reference.

  | Source | In the map | Shape | Declared / interpreted | Way in | Order |
  |---|---|---|---|---|---|
  | Explainer | 90% | 1 nucleus of 10 | 13 / 3 | layers (the trace walks 5 of 10) | follows the chapters in part (60%) |
  | README | 75% | 2 aspects | 9 / 1 | the trace | jumps between chapters |
  | Runbook | 95% | 1 nucleus of 8 | 12 / 2 | the trace | follows the chapters |

- **Style.** The technical drawing is kept, revised: the drawing shows and the text reads; color carries the role and the stroke carries the basis; the title block is "how it was read"; tokens come before views ([product definition](../../product.md#visual-direction-the-technical-drawing)).
- **Decision.** "Adesso direi che abbiamo un prodotto da costruire": exploration is the core, the product definition and the adapter are revised, and a plan follows with the gate as its first phase.

## 6. The gate, prepared (not yet run)

A private harness next to the prototype holds four files:
- **The structure-first request.** It uses the app's own source formatting (numbered lines, as in `formatSourceBlock`) and a JSON schema. The rules are the ones in section 2:
  - five part kinds and four link classes;
  - every link cites its lines and says whether it is declared or interpreted;
  - 2–4 points per part, each citing its lines;
  - at most three traces, only where the source walks one;
  - no count of parts and no connectivity rule.
- **Six sources.** The three public fixtures, whose "today" is the prepared disassembly in the repository, and the three private ones, whose "today" is the app's stored output (none yet for the runbook).
- **A runner** for the two local runtimes the app supports (llama.cpp `/completion` with `json_schema`, Ollama `/api/chat` with `format`). It can also write each request to a file, to hand to another model.
- **A checker.** It validates an answer: ids, kinds, cites in range, annotations attached, bonds only between parts, prerequisites only from prerequisites, traces naming real parts. Then it measures it:
  - parts, nuclei, loose pieces, prerequisites, annotations and pieces aside;
  - bonds and the declared share of links;
  - traces and how much of the main nucleus the first one covers;
  - the entry the detector would choose;
  - the share of the source cited;
  - the share of points whose lines lie inside their part.
  
  Valid answers can be loaded into prototype D.

Dry run on the hand extractions: all three are valid. Results, with the share of points that lie inside their part:

| Source | Shape | Entry | Lines cited | Points inside their part |
|---|---|---|---|---|
| README | nuclei 6 + 4 | B | 72% | 100% |
| Explainer | one nucleus of 10 | A | 90% | 98% |
| Runbook | one nucleus of 8 | B | 91% | 91% |

Pass criteria to fix before the run:
- every answer is valid;
- no bond the owner judges forced;
- the README's two nuclei are found;
- each trace is one the source really walks;
- points inside their part ≥ 90%.

The owner judges the first two by looking at the answers in D.

## 7. The gate, first run (2026-11-05, plan X1)

The request in section 6, unchanged, on two routes:
- **Claude:** six fresh agents (Claude Opus 5.5) with no context of the analysis, each given only the request and returning only the JSON.
- **OpenAI:** the app's ChatGPT route with `gpt-6.1-sol`, the evaluation's strong model, through a private runner started inside Electron as `npm run eval` is. The three public sources only: 3 requests, counted in the gate's ledger. The private sources wait for the owner's confirmation before they go to OpenAI.

| Source | Route | Valid | Shape | Entry | Lines cited | Points inside their part |
|---|---|---|---|---|---|---|
| release (public) | Claude | ✓ | nuclei 9 + 3 | layers | 97% | 98% |
| | ChatGPT | ✓ | one nucleus of 9, 1 loose | the trace (78%) | 99% | 100% |
| mill (public, argument) | Claude | ✓ | nuclei 13 + 2 | the trace (62%) | 98% | 100% |
| | ChatGPT | ✓ | nuclei 8 + 2 + 2 + 2 | the trace (75%) | 98% | 100% |
| importer (public) | Claude | ✓ | one nucleus of 10 | layers | 87% | 100% |
| | ChatGPT | ✓ | nuclei 10 + 3 | layers | 90% | 100% |
| README (private) | Claude | ✓ | **one nucleus of 8** | the trace (63%) | 69% | 97% |
| explainer (private) | Claude | ✓ | one nucleus of 29, 39 bonds | layers (7) | 82% | 96% |
| runbook (private) | Claude | ✓ | one nucleus of 18 | layers (8), trace 44% | 99% | 100% |

ChatGPT took 92–131 s per public source (meta files beside the answers). Claude agents took 1.3–3.8 minutes each, reading included.

**Against the pass criteria:**
1. Every answer is valid: ✓ on both routes.
2. No forced bond: for the owner, in D. A candidate: on the README, Claude links the project's build pipeline to the app with a declared bond (a project phase "builds" the app). That is the pattern the diagnosis called forced.
3. The README's two nuclei: ✗ on Claude. The project's phases became one part, bonded to the app, with its folders and status as references. ChatGPT not yet run on the README.
4. Each trace is one the source walks: for the owner, in D.
5. Points inside their part ≥ 90%: ✓ everywhere (96–100%).

**Findings the criteria did not anticipate:**
- **Finer than by hand.** The models return two to three times the parts (explainer 29 against 10; runbook 18 against 8) and cite more of the source. The guide gets deeper: 7–8 layers.
- **Several traces split the entry.** Both routes find 2–3 traces per source where the hand extraction had one. The detector measures only the first: Claude's runbook goes to layers because its first trace covers 44% of the nucleus. This is the open question "choosing among several traces", now with evidence.
- **"Declared" is used generously.** ChatGPT marks 100% of Mill's links as declared, an argument where several supports are the reader's reconstruction.

**The owner's look (2026-11-05), Claude's answers:**
- README: the bond from the project's pipeline to the app is forced. "Meglio nel prototipo, lì era perfetto." Criterion 2 fails.
- Runbook and explainer: "troppo incasinato, meglio nel prototipo". The finer extraction and its 7–8 layers make the view worse, not better.
- ChatGPT's three public answers are not judged yet, and its private sources were not sent.

**Verdict on the first run:** the Claude route fails criteria 2 and 3, and the owner prefers the hand extraction on the other two sources. The ChatGPT route is incomplete. Both routes received the same request, so the failures point at the request's rules more than at a model:
- **No grain.** With no count of parts, the models split as finely as the text allows. The hand extraction kept one part per thing the reader must hold as one idea.
- **Making ≠ working.** "Precedes in a flow" in the bond definition lets a process that produced something (a build pipeline) bond to what it produced.
- **"Declared" without a test.** Nothing asks that the cited lines state the relation in words.
- **One trace measured.** The detector reads only the first trace (a detector rule, not the request).

## 8. The gate, revision R1 (2026-11-05, plan v4 X1)

The request gains three rules: grain (one part per idea the reader holds; details become points), making ≠ working (a process that produced something is its own body), and a test for "declared". The prototype's detector now picks the trace that covers most of the main nucleus.

Routes:
- **Claude:** six fresh agents.
- **ChatGPT:** `gpt-6.1-sol` on all six sources, the private ones included on the owner's confirmation. This was 6 requests, 9 in the ledger so far; each took 78–227 s.

Parts of kind "part" and layers of the main nucleus ("c" marks a cyclic nucleus, layered from its start):

| Source | By hand | Claude run 0 | Claude R1 | ChatGPT run 0 | ChatGPT R1 |
|---|---|---|---|---|---|
| explainer (private) | 10 · 4 | 29 · 7 | 24 · 5 | – | 23 · 5 |
| README (private) | 10 · 5 (nuclei 6 + 4) | 9 · 5 | 4 · 3 | – | 7 · 5 |
| runbook (private) | 8 · 8 | 18 · 8c | 11 · 10 | – | 7 · 4c |
| importer | – | 10 · 5 | 12 · 5 | 13 · 5c | 10 · 4 |
| mill | – | 15 · 4 | 6 · 4 | 14 · 3 | 10 · 4 |
| release | – | 12 · 3 | 8 · 4c | 10 · 7c | 8 · 5c |

**Against the criteria, before the owner's look:**
1. Valid: Claude 6/6; ChatGPT 5/6. The runbook links a procedure to a part with a bond, a finding the app's single repair would return.
3. The README's two nuclei: still ✗ on both routes, but differently than in run 0. The project's phases are no longer bonded to the app: they are now a piece aside, linked by a reference (a folder "contains" the app's code). The forced bond is gone; the second nucleus is not found.
5. Points inside their part: ✓, except Claude's README (78%).
- **Entry:** with the best trace, the runbook enters by its procedure on both routes (82% and 100%), as in the hand extraction.
- **Grain:** R1 brings release, mill and the runbook close to the hand extraction. The explainer stays at 23–24 parts, two to three times the hand's 10.

⚠ Criterion 3 is the researcher's hypothesis that the README holds a second body of connected logic. If the owner finds the README readable with the project's phases as a piece aside, the criterion was wrong, not the extraction.

**The owner's look at R1 (2026-11-06):**
- **Explainer:** too many blocks on both routes. The hand extraction summarises: its first layer has three blocks, each a role of the whole, and the reader opens the source for the detail. "Non dobbiamo rappresentare a schermo tutto, altrimenti l'utente non sa più come navigare ed è inondato di informazioni." Criterion 6 fails.
- **README:** neither route reaches the hand extraction, because the project's pipeline is missing as a node of its own. Criterion 3 stands; it was not the researcher's mistake.
- **Runbook:** good on both routes.
- **Mill:** the two routes differ, and both are a good result.
- **No fixed number of blocks.** "Non possiamo nemmeno dire limitiamo il primo livello a n blocchi": the app, through the model, must find the best way to draw the source. The hand extraction is the reference because it summarises without listing every technical component.

**What the comparison shows.** On the explainer the hand parts are roles, named by what each does for the whole. The models' parts are the components the source names, one per class. The defect is the level of abstraction, not the count.

**R2 (prepared, not run):**
- **Roles, not named components.** Each part is named by its role in the whole. The components the source names are details of a role, in its points or left in the source. The structure summarises and does not reproduce the inventory. The parts nothing acts on are the first view: few enough to read at a glance. This is not a number.
- **A process around the thing is a nucleus.** It gets its own parts and bonds, step to step, joined to the thing only by what the source says. It is not one piece aside.

## 9. Abstraction, on the explainer only (2026-11-06)

The owner set R2 aside: "concentriamoci sull'astrazione". The task is one source, the most complex one (the explainer), and several ways to abstract it, compared in D. The owner set one condition: no hand-made abstraction. "Devi riutilizzare la stessa metodologia che userebbe l'applicazione": every result comes from a request the app could send, and from functions the app would run.

**The request** is R2's rules plus three fields:
- **members:** each role holds the components the source names (classes, services, settings), already extracted, each with what it does and its cites;
- **aspects:** the large concerns of the source;
- **whole:** one sentence on what the source is about.

**Four abstraction principles**, one fresh Claude agent each:

| Approach | Principle | Roles | Members | Aspects named |
|---|---|---|---|---|
| by role | what each piece does for the whole | 16 | 97 | 4 |
| from the top | the whole, then 2–4 aspects, then roles inside each | 21 | 115 | 4 |
| life cycle | the stages in the life of the main thing (a signal) | 18 | 102 | 4 |
| reader's questions | each role answers one newcomer's question | 15 | 121 | 4 |

(By hand: 10 parts, no members.) All four are valid, cite 90–93% of the source, and keep 99–100% of points inside their part.

**What changed.** The roles now have role names, by what they do for the whole, and the classes moved into members. But 15–21 roles are still more than the hand's 10.

**The aspect level.** All four approaches named four aspects, even where the principle did not ask for them. The prototype now computes a third level from them, with a function the app would run (`aspectsOf`). Each aspect becomes one block whose members are its roles. Bonds between roles of different aspects become one bond between aspects, and prerequisites point at the aspect of the part they open. The same detector, layout and view draw it.

The view gains:
- a "Detail" control with three levels: aspects, roles, roles with components;
- members glimpsed on hover, opened in place, each selectable with its own card and leader line;
- generous spacing.

The owner compares the four approaches at the three levels.

**The owner's look at the aspect level (2026-11-06):**
- **The source's premise comes first, as a level of its own.** The problem the source opens with should come first: the assumption the source starts from is not one prerequisite among others.
- **Aspects and roles in one interface**, as in the lab. A level goes faded and the opened one is highlighted, so the reader never loses where they are. The "roles and components" mix is more confusing and is set aside.

**Prototype E, "levels of abstraction":**
- **The premise**, by a rule, not by hand. It is the earliest-cited prerequisite, when no part opens in its top section of the source (with no index: before every part). It opens the reading alone: "the starting point of the source". On the explainer, all four approaches yield the problem section ("the typical failure: silence").
- **Three levels on one screen:** the source's aspects → an aspect's roles → a role's components. Each level is view D on a level the app derives from the model's output (`aspectsOf`, `rolesOf`, `componentsOf`), with the same guide, card, source, index and leader lines.
  - The levels above stay as a faded strip with the opened block highlighted. A click on any block of the strip moves there.
  - A card offers "open «X»: n roles / components".
- **Every block is drawn.** Inside an aspect, roles with no bond among them join the first layer. A level with no bond at all is laid out in rows of three, in source order.

**The owner's look at prototype E (2026-11-06), on the top-down approach:** going to a separate roles page loses the reader and is destabilising. The whole drawn so far must stay exactly where it is, only fainter. The opened block's roles appear in place, on a sub-level, with a transition like the lab's. Inside it, a role shows its components, each linked to the source. Closing the sub-level returns to the same graph and the same step, and the reading goes on.

**Prototype E, revised (one page):**
- **The sub-level.** An aspect's toggle, a click on one of its roles, or "open «X»" on the card lifts the aspect's roles out under the block. The whole keeps every position and fades; the opened block stays highlighted; a dashed beam joins it to the sub-level.
- **The motion.** The sub-level grows out of its block and plays back into it on closing (FLIP, as in the lab's stage, about 0.3 s; nothing moves under "reduce motion").
- **Inside the sub-level.** All the aspect's roles show at once, with the prerequisites that open them. A click on a role selects it and shows its components in place; a component has its own card, cited lines and leader line.
- **Orientation.** While the sub-level is open, the guide strip says "Inside «X»" and offers "close and return to the step". Touching another aspect moves the sub-level there. A source line of another aspect's role moves it to that role.
- **Checked** on the four approaches: positions of the whole are identical before, during and after; the step after closing is the one before opening; no console errors.
- **Only the level's own blocks (owner, 2026-11-06).** A first version repeated, inside the sub-level, the prerequisites that open its roles. The owner judged them noise: they read as blocks of the level below, when they are propedeutic. The sub-level now holds only the aspect's roles, with their annotations; the prerequisites stay on the whole, where they open the level.

**The owner's look (2026-11-06): "adesso ci siamo".** The one remaining issue was the joints: their labels were confusing when crowded. The change:
- **More space** in E: wider gaps between blocks and between layers, on the whole and in the sub-level.
- **Movable labels.** A joint's label is a tag the reader can drag. A dashed leader ties it to the joint's midpoint whenever it is away from it. A double click puts it back. A moved label keeps its place across steps and sub-levels.
- **Placement.** A label is first placed where it covers no block and no other label, trying positions around the joint's midpoint. On the top-down approach, no two of 18 labels overlap at the aspect level, nor any labels in the three sub-levels with joints.
- The app would keep the same rule: placement is computed, and moving a label is a reader's choice that changes nothing in the structure.

**How the interface would look: prototype NB (2026-11-06).** The owner asked to see the product-level UI. The request: view E, keeping the technical sheet's character, with a notebook-style research app (Gemini Notebook, formerly NotebookLM) as the visual reference for typography, spacing, layout, buttons, borders, colours and responsive behaviour, without its content, assets or branding.
- **Studied from the public page:**
  - a humanist sans with light weights (400–500), large titles and 18/28 body text;
  - white or pale surfaces, radii of 24–36 px, very soft shadows;
  - pill buttons, the primary one filled near-black, one blue accent;
  - wide white space, and a single column on a phone.
  
  The owner's notebook link needed a Google sign-in, so the app itself was not seen. Its panel layout is taken from the product's known structure: sources, chat and studio as card panels, panels that fold, tabs on a phone.
- **What NB takes:**
  - an app bar with the work's title and its one-sentence whole as subtitle;
  - three soft card panels with headers (index, structure, source), 20 px radius, 16 px gaps;
  - the index and the source fold to a rail;
  - pills and segmented controls, circular icon buttons;
  - display type at weight 400–500;
  - on a phone, one panel at a time chosen by tabs.
- **What NB keeps from Break the Wall:**
  - the app's own paper and blueprint tokens (`styles.css`), system fonts only, the brand mark;
  - the structure as a technical sheet: a faint grid with major lines, monospace layer labels and counts, role colours, dashed strokes for the interpreted;
  - "how it was read" as the drawing's title block.
- **No new logic:** `nb.html` with `nb.js` and `nb.css` reuses `one.js` and `app.js` unchanged; only the frame changes.
- **Checked** at 1440×900, 1024×768 and 375×812, in paper and blueprint:
  - the sub-level, components and the leader line work;
  - folding and tabs work, with no horizontal scroll on a phone;
  - no console errors.
- **Limits:**
  - the drawing gets little height on a 768–900 px screen, because the guide's step and the card share the panel;
  - on a phone the leader line is hidden, since the source is on another tab.
- Codex built a parallel prototype (port 4334) that leans further into the sheet: numbered panels, monospace labels, square corners. The two are there to compare.

**The owner's look at NB (2026-11-06): "il tuo prototipo è perfetto",** with one change. The premise must stand apart from the rest of the structure: every later block sits below it, the prerequisites included.
- The layout now gives the premise a row of its own at the top, in a band labelled "Premessa" in the prerequisite's colour. It is active on the premise step and quiet after.
- The prerequisites start on the row below, and the levels below them.
- The premise is aligned left, so it keeps its place at every step and when a sub-level opens or closes.
- The same layout serves D, E and NB. Checked on five extractions, with no console errors.
- For plan v5, this belongs to the layout (X4) and the guide's premise step (X13).

## 10. The gate, run A1 (2026-11-06, plan v5 X1)

**The request** (`gate/abstraction.mjs --a1`) combines:
- R2's rules;
- the top-down principle: the whole, then 2–4 aspects, then the roles inside each;
- MEMBERS;
- one new rule: a source with a single concern names no aspects.

**The routes:**
- **Claude:** six fresh agents (Claude Opus 5.5), each given only its request file and writing only the JSON.
- **ChatGPT** (`gpt-6.1-sol`): the app's route, through the gate's runner. The three private sources went to OpenAI on the owner's confirmation for this run.
- **The ledger:** 9 public requests of 15 and 7 private of 12 used, one of them the runbook's repair.

**The checker** now also checks the aspects (none, or 2–4, each part's aspect known) and members (only on parts and prerequisites, unique ids, "does" ≤ 90). It records aspects, roles per aspect, members and roles per 100 lines.

| Source | Claude: roles · aspects (roles each) · members · entry | ChatGPT: roles · aspects (roles each) · members · entry · time |
|---|---|---|
| release (public) | 7 · 3 (4/2/1) · 20 · question | 7 · none · 24 · question · 117 s |
| mill (public) | 6 · none · 0 · question | 9 in two nuclei 5+4 · 2 (4/5) · 0 · layers · 78 s |
| importer (public) | 8 · 2 (6/2) · 18 · question | 9 · 2 (6/3) · 20 · question (100%) · 227 s |
| README (private) | 9 in **two nuclei 5+4** · 2 (4/5) · 32 · layers | 13 in **two nuclei 9+4** · 3 (4/9/0) · 33 · layers · 137 s |
| explainer (private) | 18 · 3 (6/7/5) · 109 · layers | 19 in nuclei 15+3 · 4 (9/4/4/2) · 51 · layers · 260 s |
| runbook (private) | 7 · 2 (6/1) · 37 · question | 5 · none · 24 · question · 107 s · invalid, **valid after one repair** (106 s) |

**Measured criteria:**
1. **Valid answers.**
   - Claude: 6/6.
   - ChatGPT: 5/6 at first. The runbook answer bonded a procedure to a part, which the contract allows only between parts.
   - On the owner's go-ahead, the gate sent the app's one repair, as `src/desktop/generator.ts` does: the first request, the previous answer, and the finding located by path (`links[2]`).
   - The repaired answer is valid. The model changed only that link (bond → reference); parts and links are otherwise identical. ChatGPT: 6/6 with one repair.
3. **The README's two nuclei**, which R1 had missed, are found on both routes: the product and the project process around it.
5. **Points inside their part:** 91–100% on every answer.

**Shape, recorded:**
- **Roles per 100 lines:** 1.9–4.6 on Claude and 1.5–6.9 on ChatGPT. On the explainer: 18 and 19 roles, against 21 in the abstraction study and 10 by hand.
- **Source cited:** 67–98% on Claude and 71–98% on ChatGPT. The README is the lowest on both.
- **The premise rule** finds a starting point:
  - on Claude: in the README, the explainer, the importer and the runbook;
  - on ChatGPT: in all four, and also in release, where it picks a prerequisite about the release's identity.
  
  Neither route finds one in Mill.

**For the owner to judge in NB (criteria 2, 4, 6, 7, 8):**
- **Forced aspects:**
  - Claude gives release and the runbook an aspect with a single role;
  - ChatGPT gives the README an aspect with no role at all (the view draws only aspects that hold roles);
  - ChatGPT splits Mill into two aspects, where Claude finds one concern.
- **Release:** whether its premise on ChatGPT is the source's starting point.
- **The explainer:** whether the aspects read as the top-down study did (prototype E, "adesso ci siamo"), on either route.

**The prototype, fixed by this run:** when no bond joins the aspects (the README on Claude), the aspect level drew nothing after the premise. Now every aspect is drawn, by the sub-level's rule. In the plan this belongs to X5's `levelShape`.

**The owner's look at A1 (2026-11-06):**
- **Only the chosen approach.** The by-role, life-cycle and reader's-questions studies are set aside. NB now lists the top-down study and the gate's runs only.
- **The README.**
  - ChatGPT mixes the problem the product solves with the description of the application's architecture.
  - Claude does better, but the owner sees three bodies: the problem the product sets out to solve, the application with its components, and the project pipeline.
- **The explainer** should come close to the hand extraction: 10 roles, one nucleus, the gaps as annotations, a first view of three blocks. The owner may refine the abstraction later. Extracting a technical source well stays the model's judgement, using every tool the app has: roles, components (members) and nuclei.
- **Joints:** a click on a block lights the joints that touch it, with their labels, animated, so they stand apart from the others. Deselecting restores the view.
  - Prototype: the block's joints flow (an animated dash) in the accent colour, their labels light up, and the blocks at their other end are outlined. Every other joint and label steps back.
  - A second click on the block, or "back to the step", restores the view. The sub-level behaves the same.
  - Under "reduce motion" nothing moves.
- **Not commented on:** release, Mill, importer and the runbook. The criteria they bear on stay open.

**A2, the last revision the plan allows**, adds two rules to A1's request (`gate/abstraction.mjs --a2`), each written for any source:
- **The problem and what answers it.** A problem only stated to motivate the rest is the opening prerequisite. A problem the source develops with parts of its own is an aspect of its own. The answer's parts never stand in for it. A process around the answer stays a third body.
- **A whiteboard grain.** Roles are what a colleague would draw on a whiteboard. A role that does nothing new for the whole is merged, its difference kept as members or points. Detail is carried by members, by annotations (findings, gaps, bugs, risks, never roles of their own) and by nuclei and aspects. No fixed number.

**A2 on the README only (2026-11-06, the owner's choice: A2 on the README only, the other sources validated one at a time later).** It ran on both routes, and the private source went to OpenAI on the owner's confirmation. The Claude agent stopped at the plan's five-hour usage limit and was resumed after the reset.

| Route | Roles · nuclei | Aspects (roles each) | Members | The problem | Points inside | Cited | Time |
|---|---|---|---|---|---|---|---|
| Claude | 7 · 4+3 | 2 (3/4): the product, the project process | 23 | the opening prerequisite (the premise) | **79%** | 75% | — |
| ChatGPT | 8 · 4+4 | 2 (4/4): the product, the project's execution | 28 | the premise; the product's aspect is still named after the problem too | 96% | 70% | 128 s |

- **Both valid.** On Claude, criterion 5 fails at 79%, against 97% in A1.
- **Read against the owner's three bodies:**
  - both routes treat the problem as "stated to motivate", so it is the premise level, with the product and the project process as two aspects below it;
  - on Claude these are three levels kept apart;
  - ChatGPT keeps the problem in the product aspect's name.
  
  Neither makes the problem an aspect with roles of its own. The owner judges whether the premise level is the body the owner meant.
- **Grain:** 7–8 roles against 9–13 in A1.
- **Ledger:** 9/15 public, 8/12 private.

**Labels that say nothing (the owner, 2026-11-06: "«5 legami» non significa nulla e sembra rumore").** A joint between two aspects stands for several bonds between their roles, and was labelled with their count. The rule now: a label always says a relation.
- At rest, a joint names its first bond and how many more ("fornisce gli esiti +1").
- Lit, it lists every bond. Its tooltip and the card list them all.
- The same rule applies to annotation badges: the first annotation's name and how many more, not "7 annotazioni".

**The owner's next look (2026-11-06):**
- a lit label did not say who does what;
- several phrases ran together;
- the card (explanation, roles, why it is linked) lost the focus on the explanation.

The prototype now does three things:
- **A lit label says who does what to whom:** "role A → hands its outcomes to → role B". Several bonds are a bulleted list.
- **Lit labels are placed first, at their own size**, and the others go around them. On the explainer's aspect level, two lit labels overlap in one case out of four blocks.
- **The card leads with the explanation:** the lead and its points. The roles or components and "why it is linked" are folded sections with their count. Each joint there lists its bonds the same way.

**Then (2026-11-06): "le label adesso hanno troppo testo".** Short labels, as before, but the direction must be visible. The owner's example: a verb alone in the middle of a joint ("enqueues the job") does not say which block acts. The prototype now:
- **Keeps the label short, with an arrow inside it** that points the way the joint runs on screen, from the block that acts to the one it acts on: "verb →", "← verb", "verb ↓".
- **Pointing at a label marks its two blocks:** a solid ring and a "chi" badge on the one that acts, a dashed ring and an "a chi" badge on the one it acts on.
- **Lit, a joint that stands for several bonds** lists only their verbs, bulleted, each with the arrow.
- **Who does what in words** stays in the tooltip and in the card's folded "why it is linked".

**A colour study (`.local/prototypes/nb-color-study/`, 2026-11-06), judged better by the owner on labels and block colours.** It layers a script over NB and gives each aspect a hue: blue, teal, terracotta, violet, each with a paper and a blueprint value. The hue goes on:
- the block, as a wash with a stripe on its left;
- its sub-level and the guide's step while the sub-level is open;
- the card's title and the index dots.

Its labels are NB's short pills, from before the arrows. NB now takes the same hues natively:
- the hue is set from the extraction's aspects by view E (`TONE`), not by a script after rendering;
- it appears at every level: an aspect's block, its roles inside the sub-level, the sub-level, the step, the card, the index;
- prerequisites keep their own colour, since the model also assigns them an aspect;
- labels stay short. Each keeps its arrow, now drawn in the hue of the block that acts, which ties the label to its block.

Checked in paper and blueprint, with no console errors.

## The decision this needs from the owner

The product definition and the adapter make "disassemble → run → reassemble" the identity of the product. The owner's direction makes exploration the core and run and reassemble later additions.

If that holds, a plan must first update [docs/product.md](../../product.md#identity) and the adapter's product-identity constraint. It must not drift away from them unnoticed.

## Assumptions

- The three private sources are typical of what the owner takes apart. Neither is an argument or a story: an argumentative and a narrative public fixture are still needed.
- A source's own trace (a diagnostic tree, a user flow) can be found by an extractor as reliably as its parts.

## Risks

- **The structure-first extractions were written by hand, by Claude, after the analysis.** They show what such an extractor could return; they do not show that a model will. This is the main gap.
- An extractor allowed not to connect may connect too little. It may split one mechanism into loose parts because citing every link is more work. The coverage and the share of declared links should be measured against today's extractor.
- Prerequisite versus bond is a judgment the model has to make. Mislabelled, it either hides a real bond from a later run or forces an order that does not exist.
- The detector's thresholds and the "60% of the nucleus" rule are fitted to three sources.

## Recommendation

1. **The owner's look first.** Go through the three first minutes on the three sources and say which one gives the moment of "now I see how it holds together", or what is still missing. Usefulness is the owner's judgment.
2. **Then a gate on a real model.** Write the structure-first prompt and run it through the verified local route on the three public fixtures and the three private sources. Generate the runbook with today's extractor first, so it too has a baseline. Compare it with today's output: forced joints, coverage, declared share, nuclei found. Nothing is implemented in the app before this.
3. **Then a plan.** It would cover the contract (link classes, kinds, traces), the detector in `src/core`, the chosen first minute in the guided view, and the update of the product definition. Run and reassemble stay out of scope.

Planning is not justified yet: both the owner's choice of a first minute and the model gate are open.

Update 2026-11-05: the owner chose D and asked for the plan. The same day the owner set local models aside (they still have limitations) and moved the gate to Claude and OpenAI, the routes the product is built on first: Claude through MCP, OpenAI through ChatGPT. The runner's local routes stay for a later phase. The gate becomes the plan's first phase, and its result decides whether the extraction phases proceed as written ([P-20261105-exploration](../plans/P-20261105-exploration/plan.md)).

## Open questions

- How does the detector tell a partial path from a partial extraction (see the owner's look)?
- What does the app do when the trace and the nucleus disagree, for example when a trace walks through parts the extractor did not link?
- When the learner leaves a trace to explore freely, does the trace stay drawn, as a path to return to?
- A runbook's prerequisites are things to *do* first (the preflight), not things to *understand* first. Are they the same link class, or a fourth?
- Do prerequisites belong in the stored disassembly, or are they computed when the source is opened?
