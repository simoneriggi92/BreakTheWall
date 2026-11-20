# Side chat prototype (throwaway)

Answers [What should a side chat anchored to one question look like?](https://github.com/simoneriggi92/BreakTheWall/issues/73) on the map [a calmer way through an agent's question rounds](https://github.com/simoneriggi92/BreakTheWall/issues/70). It lives only on the `prototype/side-chat` branch and is never merged.

Built on variant B ("Indice + lettore") of [`prototypes/round`](../round/README.md), the layout chosen in #78. Three structurally different side chats, switched with `?variant=A|B|C` or the bar at the bottom (← →):

| Key | Name | Where it opens | Threads per block | Decomposability verdict | Return text |
|---|---|---|---|---|---|
| A | Colonna accanto al blocco | takes the right column; follows the focused block | one | first line of the chat, as soon as it opens | folds to a strip under the chat |
| B | Sotto il blocco | centre splits: block above, chat below | several, as tabs | only inside a reply | stays in the right column |
| C | Fili nel margine | cards in the margin, anchored to passages | several, as cards | on demand, "Scomponibile?" on the block | only in the review sheet |

Common to all three: select a passage → "Chiedi qui" anchors a question to it (violet highlight, distinct from the amber annotations). Each reply lists what the read-only fork "read". "📎 Allega alla risposta" is the only way an exchange reaches the agent; the return text shows attached exchanges under their block. Q3 and Q5 are judged decomposable and offer a Break the Wall decomposition (parts, links with declared/interpreted basis, the line behind each link); the others answer as a plain fork.

Replies are mocked: ~2.3 s before the fork's first read and streamed words, close to the ~3 s first token witnessed on #74. File paths cited exist on `main`; the reply contents are not checked.

## Run it

```bash
open prototypes/side-chat/index.html
```

Keys: `c` open the chat, `Esc` close, `j`/`k` block, `1`–`4` option, `y` proposal, `r` review, `t` theme, `←`/`→` variant. Resize below 1180 px (outline → rail) and 860 px (side column → drawer) to judge the surface beside a terminal.
