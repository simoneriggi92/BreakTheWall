# Plan review: disassembly v2

Plan: [P-20261024-disassembly v3](plan.md). Version 1 reviewed on 2026-10-24; versions 2 and 3 on 2026-10-25. Review type: author self-review and static checks. There was no independent reviewer. Phase `contract` was implemented under v2 before v3 was written.

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
