# Source-ordered reading in the existing player

Base: `origin/main` at `c9bcd56`. The owner requested implementation of the reviewed local guided-reading interaction on a dedicated branch. This note contains behavior and public-source evidence only.

## Findings and decisions

- `DisassemblyPlayer.tsx` already owns mode switching, progress loading/saving, citations and the shared workbench. Reading belongs inside its exploded-view mode, rather than becoming another Run or Reassemble loop.
- `markdown.ts` already maps rendered blocks to absolute source lines and disables raw HTML, external images and followed links. Its root token maps supply passage boundaries without interpreting headings inside fences, lists or tables. A soft size target only groups whole blocks; it never slices an oversized block. Code keeps a single whole-source passage in this increment.
- `SourcePane.tsx` and `SourceDocument.tsx` already provide highlighted lines, rendered Markdown, the full-window reader and outline. Reuse them. The central passage is literal source content, not an AI-written explanation; its range rendering retains absolute line numbers.
- `Sheet.tsx` draws the existing typed parts, icons and directed joints. The guide projects at most one existing joint and its endpoints vertically to keep the detail legible. It preserves ids, labels, direction, type and the whole drawing's part numbers. It neither invents a relation nor creates a competing global structure. The full overview remains available.
- `disassembly-state.ts` validates progress and checks references on restoration. An optional reading location (`source`, original `from` line, view) is compatible with old progress files and uses the same atomic desktop store. New sessions start with reading; old progress opens as before. It records position, not completion or comprehension.
- Main's generation still requires a question. This increment does not alter those contracts or make whole-source generation claims. Reading includes every source interval, including material excluded from the selected question, and exposes existing exclusion reasons.

## Boundary and verification

The implementation is covered by `P-20261030-guided-reading`. No private source, screenshot or prototype-specific explanation is copied to the repository. Tests use the repository's original/public fixtures. UI measurements use the actual branch on loopback, separately from the earlier private prototype.

Technical correctness, source coverage and saved navigation can be tested here. Semantic quality of AI output and learning effectiveness require separate evaluation. A passage boundary follows source structure; it is not a validated pedagogical concept boundary. Large indivisible blocks and code files can remain long.
