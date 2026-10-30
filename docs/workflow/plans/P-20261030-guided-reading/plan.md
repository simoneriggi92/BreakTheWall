---
id: P-20261030-guided-reading
title: A finite source-ordered reading view inside the existing player
version: 1
state: completed
current_task: none
last_evidence: TypeScript and 408 tests pass; production build passes; source pane drag resizing, expansion and restoration verified at desktop and mobile widths
next_action: Owner tests codex/guided-source-reading locally; generation and learning-effectiveness work remain separate
approval: approved
---

# Guided source reading

## Authorization and boundary

The owner explicitly requested a branch from main and implementation of the reviewed guided section, efficiently and within scope, on 2026-10-30. This direct implementation request authorizes this slice; it takes precedence over the workflow skill's command syntax. It does not authorize publishing, merging, provider calls, or unrelated changes. The earlier private prototype supplies interaction decisions only; its source, prepared diagrams and screenshots must not enter the public repository.

The checkout is isolated from the owner's working checkout. Existing plans and their gates are not changed or completed by this work. The old disassembly plan still has owner-witnessed gates outstanding; this plan documents this independent, explicitly requested branch only.

## Scope

- Derive a finite reading route from original source blocks, in source/file order, without generation. Never split fenced code, lists or tables to meet a size target; never drop source intervals.
- Vertical navigation, free jumps/back/forward, one quiet position indicator, and persistence through the existing progress store. Position is not a score or proof of reading.
- Original passage, original source below with highlighting and full reader, and the existing source-linked parts/relationships on drafting paper with their icons. One decomposition; no invented diagrams or relationships.
- Keep the overview, bill of materials, source views, Run and Reassemble accessible. Old saved progress remains valid. A selected question may have excluded source material: it remains readable and its status stays explicit.
- Italian/English and both themes; keyboard and narrow layouts.

Excluded: questionless Studio/generation contracts, new AI calls, new Run/Reassemble activities, semantic rewriting of sources, layout-engine overhaul, dependencies, packaging, publication and private examples.

## Tasks and acceptance

- [x] G1: Route and saved navigation model. Complete contiguous source coverage; block-safe boundaries, multiple sources and code/headingless fallback; old/invalid/revised progress checked.
- [x] G2: Player view and minimal chrome. Source stays next to its existing drawing; highlighted reference and reader work; jumps preserve overview position and reading position across modes/restart.
- [x] G3: Relevant automated tests, full `npm run check`, `npm run build`, diff check and bounded local UI inspection. Record exactly what was verified and leave owner judgement separate.

## Evidence

See [verification](verification.md) and [bounded review](review.md). No publication, provider integration, installer or owner acceptance is claimed.
