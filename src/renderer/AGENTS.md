# Renderer (src/renderer)

## Overview

The React interface: library, studio, the exploration view with its three roles (guide, structure, source), and the earlier disassembly player. It runs sandboxed with no Node, filesystem or network access and talks to the host only through the preload bridge.

## Key files

| File | Owns |
|---|---|
| `App.tsx`, `Library.tsx`, `Studio.tsx` | Top level screens and routing between them |
| `exploration/` | The exploration view and its shared state (`state.ts`, `model.ts`) |
| `disassembly/` | The disassembly player (run and reassemble), kept readable |
| `i18n/` | Text catalogs: `it.ts` and `en.ts` for the app, `x-it.ts` and `x-en.ts` for the exploration, `devices.ts` for words that name the computer |
| `markdown.ts`, `diagrams.ts`, `svg-mount.ts` | Rendering a source as a document, and its Mermaid diagrams |

## Commands

```bash
npm run dev:web   # this renderer alone in a browser, for layout only (no generation, no desktop persistence)
```

## Conventions

- Every string lives in both languages. The Italian catalog defines the shape (`typeof xIt`, `Messages` from `it.ts`), so a key missing in English fails the type check.
- Host access goes through the bridge in `src/core/bridge.ts` and `src/core/provider.ts`. Need something new from the host? Add a named operation in `src/desktop/preload.ts`, never a workaround here.
- Source text and model output are content, never HTML or executable UI. Markdown renders with `markdown-it` and raw HTML off; links are not followed and images are not fetched.
- Wording changes are tested in both languages where the wording matters (`tests/i18n.test.tsx`).

## Gotchas

- The production content policy allows styles only from the app's files. A Mermaid diagram's styles are applied through the CSS object model in `svg-mount.ts`; do not loosen the policy to make a style work.
- Mermaid loads on first use and runs with `securityLevel: 'strict'`.
- Browser preview is not proof of desktop behavior: persistence and the bridge only exist under Electron.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
