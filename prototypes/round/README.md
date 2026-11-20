# Round prototype (throwaway)

Answers [What should answering and annotating one round look like?](https://github.com/simoneriggi92/BreakTheWall/issues/78) on the map [a calmer way through an agent's question rounds](https://github.com/simoneriggi92/BreakTheWall/issues/70). It lives only on the `prototype/round-answer` branch and is never merged.

Three structurally different ways to read a grilling round as blocks, answer each one and annotate spans of its text, on one page, switched with `?variant=A|B|C` or the bar at the bottom (← →):

| Key | Name | Shape |
|---|---|---|
| A | Una alla volta | One block on screen, a segmented progress strip, previous/next |
| B | Indice + lettore | Outline of questions on the left, one block in the middle, the return text always visible on the right |
| C | Documento con margine | The whole round as one document; the focused block is lit, answered ones fold to a line, answers and annotations in the margin |

The round is the real one from [What does the overview record hold, and how does the host check it?](https://github.com/simoneriggi92/BreakTheWall/issues/69) (Q2 tail to Q7), with the `➡️` lines shown as the agent's proposal. The two Mermaid diagrams (Q3, Q4) were added by the prototype to test diagrams inside a block. No agent, no plugin, state in memory only.

## Run it

```bash
open prototypes/round/index.html
```

A single file; Mermaid 12.2.0 (the version the app pins) loads from jsDelivr.

Keys: `j`/`k` block, `1`–`4` option, `y` take the proposal, `n` note, `r` review the return, `t` theme, `←`/`→` variant. Select text in a block to annotate it.
