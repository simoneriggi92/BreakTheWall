# Where Break the Wall 1.0 stands, across both cores

Date: 2026-11-27. Scope: research for [#162](https://github.com/simoneriggi92/BreakTheWall/issues/162) (map [#160](https://github.com/simoneriggi92/BreakTheWall/issues/160)). No app source, configuration or dependency is changed. Sources: the code at `origin/main` `2ff14d1` (1.0.0 plus the social card), [the product definition](../product.md#identity), [the glossary](../../GLOSSARY.md), the open issues, the built page run in a browser at 1440, 1100 and 760 px, and the owner's local Claude Code transcripts of this project, of which only counts and anonymous patterns appear here.

Labels: **Fact** is backed by the cited code, issue or witnessed run; **Inference** is the author's reading of those facts; **Unverified** is a claim nothing here settles.

## Short answer

1.0 is a working loop, not a demo. The decide core is the stronger one: rounds reach the page, answers return to the session as the person's own words, and since the page existed the owner has answered rounds there and almost never in the terminal. The understand core works end to end (handover → backing flags → remarks or Approve), but its central promise, "check the spec against its lines", is weaker than its labels say: a statement shows **Backed** when its reference resolves, not when the reference supports it.

The five weaknesses that cost the person most, ranked:

1. **The page puts the wrong thing in front, and the spec can trap it.** It opens on the newest round of any session, and a spec whose structure is not written has no way back to the round.
2. **Questions fall out of a round silently.** One bent header line and the question is gone from the page, with nothing said.
3. **Backing reads as verification but only checks that a reference resolves.** An answer never sent, or lines that say something else, still show "Backed".
4. **The decision and its context do not fit together at real widths.** The options fall below the fold, the side chat squeezes the question, and the two spec panels squeeze the spec.
5. **Nothing draws the person's own words, and nothing marks an answer given in a hurry.** 59% of answers are the recommendation in one click, and 10% carry a word of the person's. Backing then shows these answers as decided.

## The map

```
            DECIDE                                       UNDERSTAND
 skill starts ─▶ inject.mjs asks for options      to-spec ─▶ inject.mjs asks for `Spec:` + backing
      │                                                  │
 turn.complete ─▶ server parses round ─▶ page      handover ─▶ server reads spec ─▶ backing check (no model)
      ▲                                  │                                       └▶ structure (claude -p, sonnet)
      │                                  ▼                                              │
 prompt.submit ◀─ lease ◀─ answers (+ side chat, remarks)      page: source + flags + remarks / Approve
      ▲                                                                                 │
      └──────────────── remarks ask for a round ◀───────────────────────────────────────┘
 arrows: "sends to"
```

## Evidence base

| Source | What it gave | Limit |
|---|---|---|
| Code at `2ff14d1` | parsing, injection, delivery, phase, sessions, backing, Approve | — |
| `npm run preview:round` fixture, then a pasted spec posted to the same session | the round page, side chat, spec page, backing and remarks panels at 1440, 1100, 760 px | `claude` was kept off the server's `PATH` so no model run was spent: the side chat showed its fallback and the spec its "structure not written" state. **The spec's explored structure was not seen.** Approve was not shown, because the fixture's round awaited answers (see W5 below). |
| Transcripts: 113 session files in 17 local folders of this project | counts of rounds, bent question lines, page deliveries by answer kind, handovers, approvals | Main-loop text only (no subagents). Patterns by line shape, never by content. Only this project's folders, not the owner's other projects. |
| The page's local data folder | 13 rounds, 7 free blocks, 2 side chats with 2 asks, 3 remark batches, kept for 3 sessions | The owner deleted earlier sessions, so this undercounts. |

### Transcript counts

**Fact** (counted 2026-11-27):

| | Count |
|---|---|
| Rounds (assistant texts with at least one parsed question) | 74, holding 291 questions, in 19 sessions |
| … answered in the terminal, up to 2026-11-22 | 29 of 29 |
| … from 2026-11-23 (the page in use) | 43 rounds: 37 answered from the page, 3 in the terminal, 3 with no later message |
| Page deliveries (answer messages) | 37, carrying 157 answers |
| Answers: recommendation · option · no answer · note alone · no choice | 92 · 46 · 14 · 3 · 2 |
| Answers with a note in the person's words | 16 (10%); with a remark 2; with a side-chat reply attached 3 |
| Deliveries where every answer is the recommendation | 12 of 37 |
| Deliveries sent with at least one question unanswered | 5 of 37 |
| Question-looking lines the parser drops | 56 in all: 45 with the whole header in one bold span (`❓ **Qn - title**`), all from 2026-11-16 to 2026-11-22; from 2026-11-26, 6 (a suffix after the number, as in #161, and `Qn` without the `❓`) |
| Assistant texts whose every question line was dropped (no round at all) | 14, all up to 2026-11-22 |
| Rounds shown with a question line missing beside the parsed ones | 7: 2 on 2026-11-22, then 5 of the 43 rounds from 2026-11-23 (all on 2026-11-26 and 27) |
| Spec handovers · approvals · remark messages | 9 · 4 · 5 |
| Sessions that started `wayfinder` · of them with page deliveries | 18 · 1 |

## Decide core

### Strengths

- **The return path is exact and honest.** **Fact.** The page's "What the agent receives" is built by the same function the server sends with ([`returnMessage`, src/core/round-answers.ts:151](../../src/core/round-answers.ts)). A message is escaped so a leading `/` or `!` never runs as a command (`asText`, line 189). The mod submits it with `$.prompt.submit({ asUser: true })` and confirms only after the submit ([plugin/hooks/register.ts:152-170](../../plugin/hooks/register.ts)). The server leases it, offers it again if never confirmed, and queues it for `claude --resume` when the session has ended ([src/server/rounds.ts](../../src/server/rounds.ts), lease and queue). **Inference:** the person sees in the terminal exactly what the agent got. Nothing is lost when a session ends mid-round.
- **The parser holds the skill's format well.** **Fact.** It reads round headers inside fences as text, renumbers duplicate numbers, and keeps an options list only when it has two or more distinct letters, so a stray lettered line stays in the body ([src/core/round.ts:38, 137](../../src/core/round.ts)). Zod checks the result.
- **The injection steers skills without editing them.** **Fact.** It asks round skills for lettered options and a short context list, asks `to-spec` for the `Spec:` line and backing, and asks again after a compaction ([plugin/hooks/inject.mjs:28-29, 128](../../plugin/hooks/inject.mjs)). A missed request degrades a question to "yes or a note" and never breaks it. **Fact (transcripts):** the most common bend, the one-bold-span header, stopped after 2026-11-22, when the page and its injection came into use.
- **It is used, and it replaced the terminal for rounds.** **Fact.** 29 of 29 rounds were answered in the terminal before the page existed. From 2026-11-23, 37 of 40 answered rounds went through the page. 157 answers came back in 37 messages.
- **Clarifying turns stay in the page.** **Fact.** In the round phase, a turn without a round becomes a free block with one response field. Three quiet turns end the phase ([src/core/round-phase.ts:12](../../src/core/round-phase.ts)). 7 free blocks remain in the data folder.
- **The side chat is bounded and says when it is degraded.** **Fact.** Each ask is a read-only fork (`--resume … --fork-session`, tools `Read,Grep,Glob`, no MCP, no persistence: [src/server/side-chats.ts:31, 54](../../src/server/side-chats.ts)). Nothing reaches the agent unless the person attaches a reply. **Witnessed:** with no `claude` available it answered "No reply. Ask again." and "The session could not be forked: this reply knows the round, not the conversation."
- **Sessions are first-class.** **Fact.** History by project, ended sessions queued for resume, rounds read-only once Claude Code drops the transcript ([src/server/sessions.ts](../../src/server/sessions.ts)).
- **Keyboard and preview.** **Witnessed:** `j/k` move, `1–3` pick, `y` accept, `n` note, `c` side chat, `Ctrl+Enter` send. The preview of the message updates live, and Mermaid diagrams draw inside questions.

### Weaknesses

- **D1. The page shows the newest round of any session.** **Fact.** `current()` is the round or free block received last, across every session and project ([src/server/rounds.ts:163](../../src/server/rounds.ts)). A new round that arrives while the person reads waits behind an Open notice ([src/renderer/LocalPage.tsx](../../src/renderer/LocalPage.tsx)). Already [#167](https://github.com/simoneriggi92/BreakTheWall/issues/167). **Inference:** an older session's round, still unsent, can be answered by mistake and queued for a session the person never resumes.
- **D2. A bent header drops the question with no word.** **Fact.** One regex decides what a question is ([src/core/round.ts:38](../../src/core/round.ts)). The transcripts show 56 dropped lines in four shapes. Before the page, 14 assistant texts lost their whole round this way, which cost nothing while rounds were answered in the terminal. Since the page, no round was lost whole, but 5 of 43 rounds reached it with a question missing: the person saw a round, complete-looking, without that question. A text with no parsed question is no round, so it becomes either terminal text or a free block. Nothing in the page says "this looked like a question". [#161](https://github.com/simoneriggi92/BreakTheWall/issues/161) fixes one shape only.
- **D3. Round skills outside the three names are only reached by luck.** **Fact.** Only `grilling`, `grill-me` and `grill-with-docs` are asked for options and open the phase ([plugin/hooks/inject.mjs:28](../../plugin/hooks/inject.mjs)). `wayfinder` and other skills that ask in rounds are reached only when they call one of these through the Skill tool. Of 18 `wayfinder` sessions, 1 has page deliveries. Already [#138](https://github.com/simoneriggi92/BreakTheWall/issues/138).
- **D4. The decision falls below the fold, and the side chat squeezes the question.** **Witnessed:**
  - At 1440×900 the option cards meet the window's foot, and the recommendation and the choices sit below it.
  - Opening the side chat narrows the question column. The flowchart's labels shrink to a few pixels, and the chosen option drops out of view.
  - At 1100 the outline turns into a rail and the side chat's field is cut by the ruler.
  - At 760 the right column becomes a drawer over the question, so the side chat on a question hides that question.

  Already [#151](https://github.com/simoneriggi92/BreakTheWall/issues/151)/[#153](https://github.com/simoneriggi92/BreakTheWall/issues/153) for the split sheet. The narrow-width drawer is not covered there.
- **D5. Own words are rare, and nothing marks haste.** **Fact.**
  - 92 of 157 answers (59%) are the recommendation, and 16 (10%) carry a note.
  - In 12 of 37 deliveries every answer is the recommendation.
  - 14 questions went back as "no answer", in 5 deliveries: Send is open with questions unanswered.

  **Inference:** taking a good recommendation is a fine answer, so this is no verdict on the person. But the page makes acceptance one key (`y`) and asks for nothing more, against the bar the map sets (answers in the person's own words, [#168](https://github.com/simoneriggi92/BreakTheWall/issues/168)). An outside reader asked for a mark on hasty answers ([#88](https://github.com/simoneriggi92/BreakTheWall/issues/88)). Nothing records one.
- **D6. Everything rests on the mods API and a local toolchain.** **Fact.** The mod uses `$.prompt.submit`, `$.http.fetch`, `$.process.run` and `$.session.*`. It needs Claude Code ≥ 2.1.330, Node 22 on `PATH`, and no `allowManagedModsOnly` policy ([plugin/.claude-plugin/plugin.json](../../plugin/.claude-plugin/plugin.json), [README](../../README.md)). Already [#165](https://github.com/simoneriggi92/BreakTheWall/issues/165)/[#169](https://github.com/simoneriggi92/BreakTheWall/issues/169). **Inference:** this costs people who never get in, not people using the page, so it is not ranked below.
- **Minor, witnessed:**
  - An option whose label wraps puts its letter alone on a line ([#120](https://github.com/simoneriggi92/BreakTheWall/issues/120)).
  - The large `01` watermark sits under the question's text and the Ask button.
  - The head chip shows the folder name and a session-id fragment.
  - Mermaid's inline styles log 76 content-policy errors in the console. The diagrams still draw.

## Understand core

### Strengths

- **The handover is explicit and versioned.** **Fact.** The `Spec:` line must be the turn's last line, with an issue, a file or `pasted` ([src/core/spec.ts](../../src/core/spec.ts)). Each handover of the same location is a new version, and earlier versions stay readable and take no new remarks. A handover that cannot be read is said, with its reason (`unreadableWhySchema`).
- **Backing is checked with no model, and is deterministic.** **Fact.** Answers are looked up in the rounds of the spec's sessions, links through the person's `gh`, and lines against files in the session's folder ([src/server/backing.ts](../../src/server/backing.ts)). **Witnessed:** the flags carry a count in the bar, a "To fix" filter, a jump to the line, and a Remark button that turns a flag into a remark. A wrong line range (`rounds.ts:9000-9010`) and an unknown question (`[R1·Q9]`) were both flagged broken, with a plain reason.
- **The loop closes back into decide.** **Fact.** Remarks are anchored to lines or to "missing here". Their message asks the agent for a round before any edit and for the `Spec:` line on the revision ([src/core/spec-remarks.ts:107-140](../../src/core/spec-remarks.ts)). Remarks written while a round awaits answers ride in that round's message. **Fact (transcripts):** 9 handovers, 5 remark messages, 4 approvals. The loop is used, if briefly.
- **Approve is one fixed message and is honest about open flags.** **Fact.** It names the version and counts its unbacked and broken statements; no note, no command ([src/core/spec-remarks.ts:230-239](../../src/core/spec-remarks.ts)).

### Weaknesses

- **U1. "Backed" means "the reference resolves", not "it supports the statement".** **Fact, witnessed:**
  - `[R1·Q1]` showed **Backed** with "no answer sent from the page". An answer reference resolves as long as the question exists ([src/server/backing.ts:34-44](../../src/server/backing.ts)).
  - A file reference is backed when the file has at least that many lines (line 78). Lines 1–20 of an unrelated file backed a statement about history.
  - A link is backed when `gh` finds the issue.

  **Inference:** the green mark reads as checked where nothing was checked. That is the very failure [#88](https://github.com/simoneriggi92/BreakTheWall/issues/88) warns of, and it weakens the product's own claim ("check an AI-written design doc against its lines before signing off", [docs/product.md](../product.md#identity)).
- **U2. False flags and blind spots.**
  - **Witnessed:** in a pasted handover, the agent's own preamble ("I wrote the spec from your answers.") counted as an unbacked statement.
  - **Fact:** paths outside the session's folder are always broken ([#140](https://github.com/simoneriggi92/BreakTheWall/issues/140)).
  - **Fact:** `[R·Q]` resolves only in sessions that handed over a version of this spec ([src/server/specs.ts:112](../../src/server/specs.ts)). A spec written after `/clear`, or in a new session, cannot cite its rounds. All 9 handovers in the transcripts came from sessions with rounds of their own, so this has not yet cost the owner.
- **U3. The spec can trap the page.** **Fact, witnessed:** a spec handed over takes the front, even over a round awaiting answers. While its structure is being written, or after that fails, the spec page has no Close, no History and no way back to the round. `onClose` reaches only the explored view ([src/renderer/spec/SpecPage.tsx:120-127](../../src/renderer/spec/SpecPage.tsx)), and the spec's dock shows only notices ([src/renderer/LocalPage.tsx:172-180](../../src/renderer/LocalPage.tsx)). A reload lands on the spec again. **Inference:** this looks like a new bug. It overlaps [#167](https://github.com/simoneriggi92/BreakTheWall/issues/167) but is not named there.
- **U4. Until its structure is written, the spec reads as raw Markdown.** **Fact.** Each version's structure is a background `claude -p` run on `sonnet` ([src/server/specs.ts:34](../../src/server/specs.ts)), started at handover. **Witnessed:** before it, the spec is numbered raw lines, with `#` headings and table pipes as text. **Unverified:** how long the run takes, what it costs, and how the explored view reads at the three widths. Not seen here.
- **U5. The panels squeeze the source.** **Witnessed:** at 1100 px with Backing and Remarks open, the spec itself is about 230 px wide, the narrowest of the three columns. At 760 px the backing panel covers all but the first lines of the spec.
- **U6. Approve disappears without a reason.** **Fact.** While a round of the session awaits answers, both Send and Approve are replaced by a note ([src/renderer/spec/SpecRemarks.tsx:191](../../src/renderer/spec/SpecRemarks.tsx)). Approve is disabled with no reason while the draft has words (line 197). The server still accepts an approval while a round awaits. Already [#134](https://github.com/simoneriggi92/BreakTheWall/issues/134), and named in the 1.0 changelog's known limits.

## The five weaknesses that cost the person most

The ranking weighs how often a person meets each one, by how bad the result is when they do. A silent wrong result counts for more than a visible annoyance.

| # | Weakness | Why it costs the most | Evidence | Tracked |
|---|---|---|---|---|
| 1 | **The wrong thing in front, and the spec trap** (D1 + U3) | It is met at every new session, before any value. The worst case is a dead end with no way back to the round the agent waits on, or an answer sent into an old session's queue. | `rounds.ts:163`; `LocalPage.tsx:172-180`; `SpecPage.tsx:120-127`; witnessed | #167 (the trap is new) |
| 2 | **Questions drop silently** (D2 + D3) | The person cannot answer what the page does not show, and nothing tells them it is missing: the agent waits or goes on without the decision. Since the page came into use, 5 of 43 rounds (about 1 in 9) arrived with a question missing. | `round.ts:38`; `inject.mjs:28`; transcript counts | #161 (one shape), #138 |
| 3 | **Backing as false assurance** (U1 + U2) | It sits on the last step before sign-off. A green "Backed" on an unsent answer, or on lines that say something else, invites an Approve the check never earned. It is rarer per use than 1 and 2, but its cost lands in the spec and in the work built from it. | `backing.ts:34-44, 78`; witnessed | #140, #88 (in part) |
| 4 | **The decision and the context do not fit at real widths** (D4 + U5) | It is paid on every question and every spec review: scrolling to answer, losing the question behind the side chat, reading the spec in a 230 px column. Visible and recoverable, so below 1–3. | screenshots at 1440, 1100, 760 | #151/#153 (rounds only) |
| 5 | **No pull toward own words, no mark of haste** (D5) | 90% of answers carry no word of the person's. Backing then shows those answers as decided, so a quick yes in round two reaches the spec as a firm decision. Its cost is slow and hidden. | answer-kind counts; `returnMessage` | #168, #88 |

Next in line, not ranked: install and mods-API dependence (D6, costs people who never get in), raw spec until a model run (U4), and Approve without a reason (U6, known).

## Open after this research

- How the explored spec view reads at real widths, and what its `sonnet` run costs per version. Witness it with `claude` on `PATH`.
- Whether the one-bold-span bend can come back without the injection, for example in a session where the plugin's hooks did not run. Its 45 lines all predate the page's use.
- The spec trap (U3) as a bug ticket, for triage outside the map.
