# Plan review: disassembly

Plan: [P-20261024-disassembly v6](plan.md). Version 1 reviewed on 2026-10-24; versions 2 and 3 on 2026-10-25; versions 4, 5 and 6 on 2026-10-26. Review type: author self-review and static checks. There was no independent reviewer. Phase `contract` was implemented under v2, phase `player` under v3, and the code of phase `generation` under v4.

## Version 6: changes and findings resolved

Version 6 follows the owner's requests after the D9 decision: the three generation improvements the agent proposed, and five player and content changes.

| Finding | Resolution in v6 |
|---|---|
| "Number by logical order" has no single meaning across kinds of material. In an argument, should the conclusion come first or last? | One rule for every kind, as the product identity asks: numbers follow the arrows. That is the flow for a mechanism, grounds before conclusions for an argument, and the dependency first for `depends-on`. It reuses the ranks the layout already computes, so numbers and drawing cannot disagree. Stated as an assumption the owner can change. |
| Renumbering can contradict texts a model wrote with the old order, such as "step 3" in a run. | Generation inputs list parts in reading order with their numbers. Saved disassemblies may keep an old number in a text: a residual risk. |
| Shortening the role tightens a limit, and D9 already failed on near-miss lengths. | D19, the shorten request, comes first, and D20's lead limit is a length finding it can fix. |
| A rule against repetition in the contract would make saved disassemblies and fixtures invalid. | The rule is a generation and expansion check only. The contract does not change. |
| "Restates the lead" is a judgement. | It is measured with word overlap, like `givesAway`, and calibrated on the repeat measured in D9's Mill output and on the hand-made fixtures, which must not be flagged. |
| A markdown and diagram renderer is a dependency. Dependency changes were outside every earlier approval. | The v6 approval names exactly three: `markdown-it`, `mermaid`, `@types/markdown-it`. Mermaid loads only on first use, and the main bundle has a size limit. |
| Rendering untrusted markdown inside the app could run code or fetch content. | Raw HTML off, Mermaid strict, links not followed, images not fetched, tests with hostile markup. The renderer already runs sandboxed with context isolation. |
| A rendered view loses the line links that make citations work. | `markdown-it` maps each block to its source lines, so citations highlight blocks. |
| "Sezione smontaggio" is ambiguous. | Read as the card of the open part; stated as an assumption for the owner to correct. |
| Keeping a failed generation keeps text derived from possibly private sources on disk. | One draft at most, next to the saved disassemblies, deleted on success, on "Start over" and on a new generation. |
| Letting parts finish after one fails spends requests on a generation that may never complete. | It saves them for the resume, which then sends only the failed part. Cancelling still stops everything at once. |
| Suggestions asked automatically would spend plan usage the learner did not request. | The owner chose a button: nothing is sent until the learner presses it. Results are reused for the same selection, the cost is shown and the request can be cancelled. |
| A suggestion request reads the whole source, so it costs about as much input as the structure request. | It is sent only on request, uses the content model, returns little text, and is not repeated for a selection that already has suggestions. Its time is measured in the witnessed use. |
| Suggested questions could bias the learner toward what the model finds easy. | They fill an editable field and never replace it. Each one shows its kind and parts, so the learner sees what it will open before choosing. |
| The live check needs ChatGPT runs. | It uses the 4 public generations left in D9's budget. The budget does not grow. |

Checks (v6):
- D1–D14 text is unchanged; their evidence stays valid. The phase `generation-usability` notes that D10's witnessed generations are best done after it.
- Task IDs D15–D23 are new, numbered after D14. The order within each phase is stated.
- Dependencies point backwards: D15 on D2, D5, D7; D16 on D5, D13; D17 on D5–D7; D18 on D5; D19 on D9, D14; D20 on D19; D21 on D9, D10; D22 on D2, D5, D21; D23 on D10, D19.
- The digest covers the plan body up to "Review and authorization"; the implementation records sit after it.

Residual risks added in v6:
- The restate threshold comes from a few outputs. It may let some repeats through, or flag a point that only shares the part's key terms.
- The fitted drawing on a very tall pane can make plates large and the joints long. The pane's minimum and maximum keep this in range, but visual quality is witnessed, not tested.
- The rendered view and the line view can disagree on where a block starts, for example around front matter or lists. Tests cover the block maps of the fixtures; a local-only test, skipped when the file is absent, covers the work document.
- A model change on resume mixes two models in one generation. The `generation` record names the setup at completion, not per part.


Version 5 follows the owner's requirement that any part can be taken apart on request, at any depth, as long as the source allows it. Generation under v4 produced two levels, and the contract allowed three.

| Finding | Resolution in v5 |
|---|---|
| "No limit on levels" could mean one request producing an unbounded tree. That means a large answer, more forgotten lines, deep nested schemas, and plan usage spent on branches nobody opens. | The first generation keeps its shape. Further depth comes from one small request per part, carrying only that part's lines, when the learner asks for it. |
| Without a numeric limit, something must stop the descent, or a model splits single lines. | The source stops it. A part must cite at least 6 non-blank lines to be divisible, and the host enforces this rule, not the model. The threshold was checked against the fixtures: story events stay whole, code and argument parts open. |
| A deeper level can silently drop lines of its parent. Measured: the fixtures already do, by 1–31 lines per part. | A per-part bill of materials, with part-level exclusions and reasons. The fixtures are corrected in D13, and the check applies to generation and expansion alike. |
| Taking a part apart changes the disassembly, so its revision changes. Under D3, a revision change restarts progress, so going deeper would erase the learner's runs and notes. | An expansion must be additive, and the host checks it. The learner state then moves to the new revision; any other change keeps the D3 reset. |
| The store would list every revision as a separate card. | The store lists the latest revision of each disassembly. |
| A mixed setup or a later expansion by another model hides who wrote which level. | An `expansions` list records the part, provider, model and time of each expansion. |
| The D9 comparison would measure a generator that is about to change. | Phase `depth` comes before the comparison. The budget gains 4 expansions, one per public case, to measure D14. |
| Prepared examples are bundled read-only; expanding them needs a stored copy. | Out of scope for this plan, stated as an assumption the owner can change. |
| Runs act on the top level, so a deep level has nothing to run. | Stated as a limit. Runs at deeper levels can be a later plan if the owner wants them. |

Checks (v5):
- D1–D8 text is unchanged except one note in D1, which points to D13. Their evidence stays valid, and so does the v4 generation code.
- The task IDs D13 and D14 are new, numbered after D12 so that recorded IDs keep their meaning. The order is stated: D13 → D14 → D9's comparison → D10.
- Dependencies point backwards: D13 on D1–D3 and D8; D14 on D9 and D13; D10 now also on D14.
- The digest covers the plan body up to "Review and authorization"; the implementation records sit after it.

Residual risks added in v5:
- The 6-line threshold is a judgement from four public and private fixtures, not a measured optimum. The owner can change it, and evaluation will show whether it blocks useful splits.
- Deep levels have one sentence per part and no runs, so they explain less than the top level. If that proves too thin, points at deeper levels are a contract change for a later plan.
- Expansion adds requests that the first generation's request count does not show. The action states its cost before sending.

## Version 4: changes and findings resolved

Version 4 follows the owner's request to compare ChatGPT models for generation, looking for good quality with cheaper models, and to try a work document.

| Finding | Resolution in v4 |
|---|---|
| The owner asked to compare models "per la generazione di lezione", but lessons are the format being replaced. Results on lessons would not carry over to two-phase generation. | The comparison runs on disassemblies, inside D9, after the two-phase pipeline exists. |
| "Cheaper" has no price per token on this route: Sign in with ChatGPT spends plan usage. | The plan defines cost as plan usage, requests, characters and time, and the report measures all four. |
| One model per generation hides the cheapest good option. The structure is where costly errors happen; content requests are short and local to one part. | Setups name a model per phase. A mixed setup C (strong structure, cheap content) is compared with all-strong A and all-cheap B. |
| The v3 cap (2 attempts per case) did not say how many models or setups. | An explicit budget: 30 generations in total, enforced by the runner, with a stop at the first usage-limit response. The approval boundary names it. |
| Automated checks cannot tell a true point from a plausible false one, and knowing the model biases the reader. | A blind claim review, with setups labelled A/B/C. The decision rule requires the chosen setup to have no more wrong points than A. |
| The owner's work document may fall under company policy. | It runs on ChatGPT only after the owner confirms the policy in chat; until then, local route only. It stays in `.local/` and is described only generically. |
| Model names on the account change over time. | Models are chosen from the account's list at run time, and exact slugs are recorded. |
| Four public cases are needed, one per kind of material, and none may be private. | Atlas runbook (mechanism), Mill (argument, public domain), Kessmouth (story, original), this repository's core pipeline (code). |

Checks (v4):
- D1–D8 text is unchanged; their evidence stays valid.
- Task IDs are unchanged; D9 grows, and D10 gains the setup choice.
- The digest covers the plan body up to "Review and authorization"; the implementation records sit after it.

Residual risks added in v4:
- 8 attempts per setup give an indication, not a proof. A difference of one or two valid results between setups is within noise, and the report must say so.
- The blind review depends on the owner's time: 3 setups × 4 cases. If the owner cannot review all of them, the plan records which ones were reviewed, and the decision rule applies only to those.

## Version 3: changes and findings resolved

Version 3 adds the owner's requirement of 2026-10-25: an interface in English and Italian.

| Finding | Resolution in v3 |
|---|---|
| The v2 player is "all in Italian", and every current string is hard-coded in Italian. | D4 moves every string into two catalogs with the same keys; D5–D10 take their wording from them. |
| Messages from the core and the desktop host are Italian sentences, so a catalog in the renderer would not reach them. | They travel as codes with parameters. Import errors and provider failures already have codes; D3 already made disassembly notices codes; lesson notices get codes in D4. |
| Interface language and content language could be confused, e.g. by translating a disassembly on the fly. | The plan separates them: the interface follows the setting, content keeps its `language`, the app never translates content, and content blocks carry their own `lang`. |
| An English interface with only Italian examples would feel unfinished. | D8 adds English versions of Atlas and Mill, whose sources are English already. |
| The validator's findings are English, and they also serve as repair instructions for models. | They stay English. D10 shows a summary in the interface language and the findings as technical detail; D7 words the bill-of-materials check from data. |
| Generated content could come back in the wrong language. | D9 names the content language in every request and adds a repairable finding when `detectLanguage` disagrees. |
| An i18n library would be a dependency change. | Excluded: a small catalog and `t()` in the renderer; the approval boundary names it. |
| Untranslated strings are easy to miss in review. | D4 acceptance: key parity, and a render test that reads each screen with `detectLanguage` in both languages. |

Checks (v3):
- D1–D3 text is unchanged; their v2 evidence stays valid.
- Task IDs are unchanged. D4 grows into "themes and languages", so no task is renumbered and dependencies still point backwards.
- Relative links resolve, including the new anchor to the implementation record.

Residual risks added in v3:
- `detectLanguage` is coarse: it checks function words. It catches a screen left in the other language, not a single stray label. Review of each task still reads both catalogs.
- The English versions of Atlas and Mill are hand-written content. They add review work in D8, and their quality is judged by the owner.

## Version 2: changes and findings resolved

Version 2 follows [research R-20261025](../../research/R-20261025-repository-and-document.md), where a private .NET repository and a PDF chapter were disassembled by hand in the lab.

| Finding | Resolution in v2 |
|---|---|
| The owner requires document analysis, but v1 excluded PDF adapters. | New gated phase `document` (D12): page-by-page extraction with a quality check and a fallback, page map, header and footer removal, figures listed as excluded. |
| A configuration file with keys and a password would have passed a name-based secret filter. | D11 detects secrets by content before preview, excludes such files whole with reason `secrets`, and is accepted against a fixture with planted secrets. |
| An extractor dropped ligatures without any error. | D12 refuses text that fails the quality check after the fallback; acceptance includes a PDF that triggers the failure. |
| Arguments with independent supports weaken rather than fall. | D1: load-test `verdict` is `falls`, `weakens` or `holds`; D6 shows the third outcome. |
| Interchangeable parts were marked wrong by one-part slots. | D1: a slot's `accepts` can be a set. |
| A hand layout drew a joint through a plate, which the label check missed. | D2 acceptance adds "no joint crosses a plate" on every level of every fixture. |
| A repository snapshot had uncommitted changes. | D1 `scope` records commit and modified files; D11 shows them in the preview. |
| Grouping by directory would split one mechanism across projects. | D11: sub-assemblies follow responsibilities and cite file paths. |
| Boilerplate dominated line accounting in code. | D11 excludes imports, namespaces and closing lines automatically with reason `context`. |
| Private and copyrighted cases could leak into the public repository. | They stay in `.local/`; public notes describe them generically; local-only tests skip when the files are absent. |
| A PDF library may be needed. | Approval explicitly excludes dependency changes; the extractor choice needs the owner's separate approval. |

## Checks (v2)

- Relative links resolve, including R-20261025.
- Task IDs D1–D12 are ordered; dependencies point only backwards; D11 and D12 share the gate and can run in parallel.
- Phases cover every task once: contract, player, generation, repository, document.

## Residual risks added in v2

- Two gated phases make the plan larger. Each is independent and can be moved to its own plan without touching D1–D10.
- Electron has no built-in PDF text extractor. The likely options are pdf.js, a dependency, or a native macOS bridge, which is platform work. Both are decisions for D12, not for this approval.
- The owner has not yet judged the two private disassemblies (R-20261025, owner verdict table).

## Version 1: findings resolved before requesting approval

| Finding | Resolution |
|---|---|
| Replacing the stored format could break the saved lessons and progress the owner already has. | Lessons keep their schema, store and player as legacy content. D3 and D8 must load a saved lesson and its progress unchanged. |
| The plan overlaps with P-20261022-generation-quality: Q1b and Q2 tune the draft this plan replaces, and Q3 is the same pipeline. | The plan names the overlap. It proposes superseding that plan when this one is approved, keeps its completed Q1 as infrastructure, and absorbs Q3 into D9. The decision stays with the owner. |
| P-20261021 T5 is still blocked, and this plan could appear to bypass it. | D10 produces the witnessed generation and restart evidence for disassemblies. The plan does not change P-20261021's state; the owner decides after D10. |
| The prototype placed parts by hand, and generated content cannot. | D2 adds automatic layout with geometry acceptance on every level of all fixtures. D1 adds the text-length rules that the layout depends on. |
| Story joints were never tried, so the contract could fail on the third kind. | D1 adds an original story-kind case as a contract fixture, and D9 adds it as an evaluation case. |
| "Good generation" was not measurable. | D9 sets a valid-rate threshold on ChatGPT, structural invariants (0 forgotten lines, 0 overlaps) and claim review against the lesson baseline. The local route is reported, not gated, per the owner's model-priority decision. |
| Two-phase generation multiplies ChatGPT requests. | The request count is shown before generating. Content requests carry only one part's lines. Evaluation stays opt-in and capped. |
| Repository analysis could send secrets, and it is much larger work. | D11 sits in a gated phase that starts only after the owner accepts D9's numbers. It excludes secret-like files before the preview and can be moved to its own plan. |
| Theme work could break existing settings files. | `theme` is an optional field in `settingsSchema`. D4 tests that existing settings load. |
| Mill's text in fixtures must be suitable for a public repository. | It is the 1859 public-domain essay; the excerpt carries no third-party edition text. The private TeamCity file stays in `.local/`, and its test is skipped when the file is absent. |

## Checks

- Relative links resolve: product definition, research, prototype README, the two other plans.
- Task IDs D1–D11 are ordered. Dependencies point only backwards. Phases cover every task once.
- Commands come from `package.json`: `check`, `build`, `eval`. No new universal command is assumed.

## Residual risks accepted for owner review

- Q3 of the research (reassembly as proof) is still open. Reassembly ships as optional, and the plan claims no learning effect.
- The scope is large: four phases. Each phase ends in something usable and can be stopped there:
  - after `contract`: tested formats and layout;
  - after `player`: prepared disassemblies in the app;
  - after `generation`: generated disassemblies.
- The ChatGPT threshold (7 of 10 valid) comes from one baseline. If D9 falls short, the plan stops before D10 rather than lowering the bar silently.
- jsdom cannot measure rendered SVG text, so visual quality relies on witnessed checks.

No unresolved document-blocking finding remains. This is a proposal ready for owner review, not an approval.
