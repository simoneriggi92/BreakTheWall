# How much the page helps: own words, repeats and unread rounds in real transcripts

Date: 2026-11-27. Scope: research for issue #163 (map #160). No app source, configuration or dependency is changed. The evidence is the owner's Claude Code transcripts, read locally with throwaway scripts that were not committed. This file carries only counts, ratios and anonymous format patterns: no excerpts, names or project names.

Labels: **Fact** is a count from the transcripts or a line of the cited source; **Inference** is the author's reading of those counts; **Unverified** is a claim the data cannot settle.

## Short answer

- **The page does not push answers toward picks more than the terminal does. It still holds mostly picks.** In real work sessions, 60% of page answers carry some of the person's own words, against 35% of terminal answers to rounds the page could have read. Per answered question, the share is 22% in the page against at least 14% in the terminal. But 73% of the questions answered in the page are a bare pick: the recommendation or a letter, with no note.
- **Picks come from the skill as much as from the page.** In the terminal, 65% of answers to readable rounds are a bare "yes" or a letter per question. The grilling skill asks for exactly that: "Word each question so 'yes' accepts your recommended answer" (`.agents/skills/grilling/SKILL.md:24`).
- **Corrections and repeats are rare in both channels.** No page answer was amended or corrected afterwards. 10 of 156 questions were asked again after a page answer, and 8 of those 10 had been left with no answer on the page. The agent asking again is the page working as designed.
- **Unread rounds are the clearest loss, and they come from one variant.** 24 of 110 rounds (22%) were not read at all and 2 more only in part. Together that is 97 of 444 questions. 23 of those rounds use `❓ **Qn - Title**:`, where the title sits inside the number's bold. Where the plugin's format request was injected, no round went unread. The only remaining failure there is the follow-up suffix `**Qnb**` / `**Qn B**` (#161).
- **The sample is small and comes from one person in 12 days.** It has 15 real-work rounds answered in the page. Treat the direction as evidence and the percentages as rough.

## Map of the measure

```
assistant turn ──(final text)──▶ round?  ── QUESTION regex (src/core/round.ts:38) ──▶ read whole / in part / not at all
      │                                         ▲ intended questions = lines opening with ❓
      ▼
next prompt ──▶ page answer      turnOrigin "system" + `**Qn · title**` lines (returnMessage)
            ├─▶ terminal answer  turnOrigin "human"
            └─▶ other            task notification, skill command, end of session
      │
      ▼
the prompt after that ──▶ correction?   the next round ──▶ repeated question?
```

Arrows read "is classified by" or "leads to".

## Method

**Corpus (Fact).** The corpus is 160 main-session transcripts in 32 project folders under `~/.claude/projects`. Subagent transcripts (220) were skipped, because the mod posts only the main loop's turns (`plugin/hooks/register.ts:63`). The analysis found 110 rounds in 31 sessions across 8 project folders, dated 2026-11-16 to 2026-11-27, written on Claude Code 2.1.304 to 2.1.332 with one model.

**A round (Fact, method).** A round is an assistant message, the last one before a prompt, that has at least one line opening with `❓`, outside code fences. The intended questions are those `❓` lines. The questions read are the lines that match the parser's `QUESTION` regex (`src/core/round.ts:38`) outside fences, as `parseRound` does. Turns with two or more bold `**Qn**` heads and a `➡️` line but no `❓` were also searched. There were none.

**A page answer (Fact).** The mod submits the answers with `$.prompt.submit({ text: message, asUser: true })` (`plugin/hooks/register.ts:163`). In the transcripts these prompts are recorded with `turnOrigin: "system"` and `promptSource: "system"` (46 of them, Claude Code 2.1.330 to 2.1.332). Typed prompts are recorded with `turnOrigin: "human"`. The message has one `**Qn · title** word` line per question (`src/core/round-answers.ts:151-160`):

- the word is `recommendation` / `raccomandazione`, `(x)`, `no choice` / `nessuna scelta`, `no answer` / `nessuna risposta`, or nothing for a note alone;
- the note sits below that line, indented by two spaces;
- remarks follow as `- «…»`.

Other system-origin prompts were not counted as round answers: spec remarks, spec approvals, other plugins and probes.

**Own words (method).** A page question counts as answered in the person's own words when its note, its general note or a remark has words beyond a pick. A terminal answer is bare when every token is:

- a question number, a letter or a number;
- or a word from a fixed list of acknowledgements in Italian and English ("yes", "sì", "ok", "a tutte", "procedi", "recommendation").

Pasted content and image markers do not count as own words. For the terminal, a per-question estimate splits the message at each `Qn` reference. It is a lower bound, because an unreferenced message with words counts as one question.

**Corrections and repeats (method).**

- An answer is *amended* if a second prompt arrives before the agent writes anything.
- It is *corrected* if the next prompt opens with a correction word, such as "no,", "scusa", "anzi", "actually" or "I meant".
- A question is *repeated* if its title matches, at a similarity of 0.8 or more, a title in the previous round of the same session.

**Groups (method).** Two project folders hold staged sessions: the demo project used to record the launch clips, and a trial folder. Their 34 rounds (31 answered in the page) were measured separately. They are kept out of the comparison, because the picks there were chosen for the camera.

## Own words and answer length

Real-work sessions only (76 rounds, 23 sessions, 6 project folders):

| | Page | Terminal, rounds the page could read | Terminal, unread rounds | Terminal, all |
|---|---|---|---|---|
| Rounds answered | 15 | 26 | 22 | 48 |
| Answers with some own words | 9 (60%) | 9 (35%) | 10 (45%) | 19 (40%) |
| Bare answers (picks or "yes" only) | 6 (40%) | 17 (65%) | 12 (55%) | 29 (60%) |
| Questions with own words | 14 of 63 answered (22%) | ≥ 13 of 95 (≥ 14%) | ≥ 12 of 86 (≥ 14%) | ≥ 25 of 181 |
| Words per message, median | 7 own words | 6.5 words | 11 words | 7.5 words |
| Words per question | 6.5 own words | 3.1 words | 6.4 words | 4.6 words |

Page answers in detail (Fact):

- **Kind per question.** Of 74 questions, 32 took the recommendation, 26 a lettered option, 3 a note alone and 2 "no choice". 11 (15%) were left with no answer.
- **Picks.** 46 of the 63 answered questions (73%) were a pick with no words.
- **Remarks and side chats.** Neither was used in real-work rounds. They appear only in the staged sessions: 3 remarks and 3 side chats.

Terminal counts include the pick tokens themselves, such as "Q3 sì", in their word counts. The page counts only the words of notes. So the gap in words per question is, if anything, understated. In the 2 rounds of page sessions that were answered in the terminal anyway, the person wrote long messages carrying pasted context (median 148 words).

Staged sessions, for contrast (Fact): 5 of 121 answered questions (4%) carry own words, and 116 are bare picks.

**Inference.**

- On Pocock's bar ("open questions you answer in your own words", `mattpocock/skills` `.out-of-scope/native-question-tool.md` at `f0588cd`), the page has not made the person's answers worse. Per question and per message they carry more own words than terminal answers to the same kind of round.
- The bar is still mostly unmet: about three in four answered questions are a click with nothing written.
- The terminal baseline is just as pick-heavy. The skill's "yes accepts the recommendation" and the plugin's lettered options (`plugin/hooks/inject.mjs:36`) both invite a pick before the page draws a button.
- A page that wants own words has to ask for them where the pick is made. Removing the pick would also remove what the terminal already does.

## Corrections and repeats

| | After a page answer | After a terminal answer |
|---|---|---|
| Amended before the agent replied | 0 of 46 | 0 of 49 |
| Next prompt opens as a correction | 0 of 32 with a next prompt | 2 of 40 with a next prompt |
| Following rounds with a repeated question | 6 of 39 | 2 of 33 |
| Repeated questions | 10 of 156 (6%) | 2 of 132 (1.5%) |

**Fact.**

- 8 of the 10 questions repeated after a page answer had been sent as "no answer". 1 had been sent as "no choice" and 1 as the recommendation.
- Both terminal repeats are reworded follow-ups to the same question.
- Both terminal corrections came after an all-"yes" answer and added context that changed a premise.
- No page message was delivered twice.

**Inference.** The page's higher repeat rate comes from questions left unanswered, not from answers misread. The agent asking again for what was skipped is the expected loop. Corrections are too few in either channel to tell the channels apart.

## Rounds the page failed to read

| | Rounds | Not read | Read in part | Questions intended | Questions read |
|---|---|---|---|---|---|
| All | 110 | 24 (22%) | 2 | 444 | 347 (78%) |
| Sessions with the plugin's format request injected | 49 (11 sessions) | 0 | 2 | — | all but 3 |
| Sessions without it | 61 (20 sessions) | 24 (39%) | 0 | — | — |

Format variants that failed, by round and by head line (Fact):

| Pattern (anonymous) | Rounds | Head lines | Why `QUESTION` rejects it |
|---|---|---|---|
| `❓ **Qn - Title**: body` | 23 | 90 | the number's bold must close right after the digits (`\*\*Q(\d{1,3})\*\*`) |
| `❓ **Qnb** - **Title**: body` (follow-up suffix, #161) | 2 | 3 | a letter after the number |
| `❓ **Dn - Title**: body` (another initial for "question") | 1 | 4 | `Q` is literal |

What was not seen (Fact):

- **Other dashes.** All 437 head lines of the form `❓ **Qn**` or `❓ **Qn -` used a plain hyphen. The regex already accepts `–`, `—`, `:` and `·`, but no round needed them.
- **A missing `❓`.** No round of bold `**Qn**` questions with a recommendation lacked it.
- **A missing bold.** No round of plain `Qn:` questions was found.
- **Date.** The `❓ **Qn - Title**` variant appears from 2026-11-16 to 2026-11-24. The suffix variant appears on 2026-11-27, in an injected session.

**Fact.** Where a round was read only in part, the person typed the answers to the dropped follow-ups inside another question's note, keyed by their suffixed numbers. This happened in 1 page message. No unread round was answered through the page's free block. 22 unread rounds were answered in the terminal, and the other 2 were followed by a command, not an answer.

**Inference.**

- The injection, in `plugin/hooks/inject.mjs`, says "Keep the skill's round format". The skill's template shows the canonical head (`.agents/skills/grilling/SKILL.md:13`). Together they hold the format well enough that the remaining failure is a single, known shape.
- Outside injected sessions, two in five rounds would not have reached the page. For the map's fog item on contract tolerance, the evidence favours two changes:
  - accept `**Qn - Title**` and a suffixed `Qn`;
  - flag a `❓` line the parser cannot read.
- Holding the format harder is the weaker option, because the variants appeared exactly where nothing asked for the format.

## Limits of the measure

- **One person, one model, 12 days** (2026-11-16 to 2026-11-27). There are 15 real-work page rounds. A single session can move any percentage by ten points.
- **Selection bias.** The owner built the page and answered in it while developing it. The page was used mostly for the product's own design, and the terminal mostly for other subjects and for earlier dates. Subject, date and channel are confounded: nearly half the terminal answers to unread rounds (10 of 22) come from one other project's sessions. Staged sessions were excluded by folder, and staging inside a real-work folder cannot be detected.
- **Heuristics.** "Own words" is a fixed token list in two languages. "Correction" is a fixed list of opening words. "Repeat" is title similarity. A long "yes, and …" counts as own words, and pasted material never does. The terminal per-question figure is a lower bound.
- **Unread is measured with today's regex** (`src/core/round.ts:38`, unchanged since it landed, `9b8b6ee`). Most unread rounds were in sessions where the page was not open. They show what the page *would* have missed, not what the person saw fail.
- **Retention.** Claude Code keeps transcripts for a limited period, so older grilling sessions, if any, are not in the corpus.
- **Not measured.** The quality of a decision, time to answer, and whether an agent understood a pick differently from a note (**Unverified**).

## Sources

- `src/core/round.ts:38`: `QUESTION`, the head regex used to count questions read.
- `src/core/round-answers.ts:134-160`: `TITLE_WORDS` and `returnMessage`, the shape that identifies a page answer.
- `plugin/hooks/register.ts:63,163`: main-loop turns posted, and answers submitted with `asUser: true`.
- `plugin/hooks/inject.mjs:28,36`: round skills and the format request whose text marks injected sessions.
- `.agents/skills/grilling/SKILL.md:13,24`: the canonical head, and "Word each question so 'yes' accepts your recommended answer".
- `mattpocock/skills`, `.out-of-scope/native-question-tool.md` (last commit `f0588cd`, 2026-10-06): "Structured pickers push the model towards multiple-choice questions with pre-baked answers … open questions you answer in your own words".
- Issue #161: the `Q1 B` / `Q1b` follow-up that falls out of the round.
- The owner's transcripts, read locally on 2026-11-27: the counts above. The scripts and raw output stay off the repository.
