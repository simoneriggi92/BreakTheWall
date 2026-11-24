# Renderer (src/renderer)

## Overview

The React interface: library, studio, the exploration view with its three roles (guide, structure, source), and the earlier disassembly player. It runs sandboxed with no Node, filesystem or network access and talks to the host only through a bridge: the preload's in Electron, or the HTTP bridge to its own local server in the page `/break-the-wall` opens.

## Key files

| File | Owns |
|---|---|
| `App.tsx`, `Library.tsx`, `Studio.tsx` | Top level screens and routing between them |
| `exploration/` | The exploration view and its shared state (`state.ts`, `model.ts`) |
| `disassembly/` | The disassembly player (run and reassemble), kept readable |
| `i18n/` | Text catalogs: `it.ts` and `en.ts` for the app, `x-it.ts` and `x-en.ts` for the exploration, `devices.ts` for words that name the computer |
| `LocalPage.tsx`, `http-bridge.ts` | The local page's entry (`vite build --mode page`): the secret from the fragment, the HTTP bridge, the page's poll, which reads what the page shows (a round or a free block) and the history again whenever it answers; it follows the latest round unless a field holds the focus or the person reads an earlier round |
| `round/RoundPage.tsx`, `round.css` | A round: the turn's text, the outline (answered questions folded), one question in focus, "what the agent receives" live, remarks on a passage of its body or recommendation, one Send, read-only once sent; "queued" with the `claude --resume <id>` to copy when sent to an ended session, read-only when its transcript is gone, and Copy as Markdown on every round (#103); its keys, and the width steps (rail below ~1180 px, drawer below ~860 px) read from `matchMedia` |
| `round/History.tsx` | The history column (#102): project → session → numbered rounds, a past round opened read-only, a session deleted once confirmed; and the notices of a round held back while the person writes or reads history, and of an update that waits |
| `round/SideChat.tsx` | A side chat on the focused question (#100), in the right column: the person's questions (quoting the passage asked about with "Ask here", #101), the streamed replies with what each read and their 📎 to attach one to the answer, and the held read that keeps a round's side chats current |
| `round/FreeBlockPage.tsx` | A turn without a round, during the round phase (#99): the turn's text and one response field |
| `spec/SpecPage.tsx`, `spec.css` | A handed-over spec (#104): its version over the exploration view, the structure being written (cancel, write again), and "superseded · open the new version" on a version a later handover replaced |
| `round/shared.tsx` | What a round and a free block share: the agent's Markdown, the one-at-a-time saver, the round phase control (top bar; in the drawer below ~860 px) |
| `round/passages.ts` | A question's passages: a selection as offsets into the rendered text (diagram figures left out), and the `<mark>`s drawn into it again after every render: amber for remarks, violet for passages asked about in the side chat |
| `markdown.ts`, `diagrams.ts`, `svg-mount.ts`, `use-diagrams.ts` | Rendering a source or a question as a document, and drawing its Mermaid diagrams |

## Commands

```bash
npm run dev:web   # this renderer alone in a browser, for layout only (no generation, no desktop persistence)
npm run build:plugin && npm run preview:round [-- round.md [turn.md …]]   # turns of one session in the real page (the last shown): prints its address with the secret
```

## Conventions

- Every string lives in both languages. The Italian catalog defines the shape (`typeof xIt`, `Messages` from `it.ts`), so a key missing in English fails the type check.
- Host access goes through the bridge in `src/core/bridge.ts` and `src/core/provider.ts`. Need something new from the host? Add a named operation in `src/desktop/preload.ts` (Electron) or a named endpoint in `src/server` behind the HTTP bridge (the local page), never a workaround here.
- Source text and model output are content, never HTML or executable UI. Markdown renders with `markdown-it` and raw HTML off; links render as `<span class="md-link">` and images as text, so rendered Markdown, inline included, is safe inside a control and fetches nothing.
- Wording changes are tested in both languages where the wording matters (`tests/i18n.test.tsx`).

## Gotchas

- The production content policy allows styles only from the app's files. A Mermaid diagram's styles are applied through the CSS object model in `svg-mount.ts`; do not loosen the policy to make a style work.
- Mermaid loads on first use and runs with `securityLevel: 'strict'`. It sizes labels from text it measures while drawing, and the policy refuses the styles it writes as markup then (its `<style>`, and `style` attributes such as a class title's bold). `renderDiagram` therefore draws inside the box the diagram is shown in, twice: the first drawing yields the `<style>`, adopted through the CSS object model for the second, and inside a drawing `setAttribute('style', …)` goes through `style.cssText` (#114). The CSP violations still logged while drawing come from the `<style>` Mermaid inserts in each of the two drawings and from markup it parses from strings; they leave no label clipped (the same sizes as with the policy bypassed). Only a real browser shows a clipped label: `npm run smoke:page` checks every label of the preview round's flowchart and class diagram, and the dev server allows inline styles and hides it.
- The round's width steps live in `RoundPage` (`is-wide`, `is-rail`, `is-drawer` classes), not in `round.css` media queries: the rail and the drawer change what is on the page, so CSS alone would let layout and content disagree. Tests fake `window.matchMedia` to reach them.
- Browser preview is not proof of desktop behavior: persistence and the bridge only exist under Electron.
- jsdom lays nothing out: a change to the round's measure, themes, rail or drawer is checked in `npm run preview:round` with a browser (Playwright), at full width, ~1100 px and ~760 px, in both themes. Measure a line's characters with the canvas (`measureText`), not by eye: `ch` is the width of a zero, wider than an average character.
