# Question and review UIs for coding agents: what exists, and where Break the Wall stands

Date: 2026-11-27. Scope: research for issue #164 (map #160). No app source, configuration or dependency is changed. Sources are Claude Code's documentation (code.claude.com, read on 2026-11-27, Claude Code 2.1.332 installed), Plannotator's source and docs at commit `f61d44d` (2026-11-20, plugin 0.29.1 installed locally; latest release v0.29.5 of 2026-11-26), `mattpocock/skills` issues and files read through the GitHub API, the repositories of the community plugins named below, and the vendors' own documentation for tools outside Claude Code.

Labels: **Fact** is backed by the cited source; **Inference** is the author's reading of those facts; **Unverified** is a claim no source settles.

## Short answer

- **Nobody else ties a spec's statements to what backs them for a person to check.** That is the one real gap Break the Wall fills (the understand core). The closest tools do something next to it: Plannotator and Kiro let you comment on passages, spec-kit writes each answer into the spec, Seldon has a second model check a plan's claims against the repository. None of them shows a person which statement rests on which answer, issue or line, or flags the ones with nothing behind them.
- **The decide core has a strong, free, popular neighbour: Plannotator.** Its Inbox already draws an agent's questions as cards ("Question N of M", recommendation, **Other…**, note, skip, accept recommended), and it markets itself as "an interactive UI for the grill-me skill". What Break the Wall still does that Plannotator does not: open the rounds of Pocock's skills **as they are, from a terminal session, with no command per round**, and keep the side chat **out of** the agent's conversation. Both are narrow advantages that Plannotator could close with a small change.
- **`AskUserQuestion` is good enough for small, bounded choices** and costs nothing to install, but it holds at most 4 questions of 2–4 options. Pocock tried it and turned it down for grilling, because pickers push the model towards pre-baked answers. Five requests for it, or for a form, were closed for that reason.
- **The bar Pocock set cuts both ways.** Break the Wall passes it (a note in your own words is always there; a question without alternatives stays open), but its injected instruction asks the agent to write alternatives as a lettered list. That is a nudge towards options, the thing Pocock objects to. Worth watching in the launch feedback.

## The map

```
                      DECIDE (answer an agent's questions)
                              │
   AskUserQuestion ─── picker in the terminal, 1–4 q × 2–4 options
   grill-kit, claude-grill-mod ─── forks of grilling that call AskUserQuestion
   Plannotator Inbox ─── cards from :::question blocks the agent sends
   Plannotator /plannotator-last ─── annotate the round's text, per round
   VS Code askQuestions, Cursor plan mode, spec-kit /clarify ─── other harnesses
   Break the Wall rounds ─── the skill's own prose rounds, parsed, one question at a time
                              │
                              ▼ the answers lead to a spec / plan
                      UNDERSTAND (check what the agent wrote)
                              │
   Claude Code plan approval ─── approve, or "keep planning" + Ctrl+G edit
   Plannotator plan review ─── delete / comment / label passages, plan diff, approve or deny
   Kiro Markdown Review ─── comment on passages, phase gates, Sync Files
   spec-kit ─── Q→A written into a Clarifications section of the spec
   Seldon ─── a judge model verifies claims against the repo, verdict + refs
   Break the Wall spec ─── statement → its backing; unbacked flagged; remark → next round; Approve
```

Arrows: "leads to". Lines under each core: tools that overlap it.

## Comparison

| Tool | What the person does | What returns to the agent | Install cost | Core it overlaps |
|---|---|---|---|---|
| **`AskUserQuestion`** (Claude Code built-in) | picks an option per question, or types in **Other** / the notes field, in a terminal dialog ¹ | `answers` map, question text → label or typed text ² | none | decide, for bounded choices only |
| **Plannotator Inbox** | answers `:::question` cards in a browser window (pick, **Other…**, note, skip, accept recommended); answers whenever, nothing blocks ³ ⁴ | "Answers to your questions" block, as the session's next turn ³ ⁴ | `curl … \| bash` binary + Claude Code plugin + restart ⁵ | decide |
| **Plannotator `/plannotator-last`** | runs the command on a round, highlights, strikes through and comments on its text ⁶ | the annotations as structured feedback ⁶ | as above | decide (by annotation, not by question) |
| **Plannotator plan review / annotate** | deletes, comments, labels passages; plan diff between versions; approve or deny ⁷ | deny: annotations as feedback; approve in Claude Code carries no notes ⁷ | as above | understand (review, not backing) |
| **Plannotator "Ask this session"** | asks about a passage; the session that opened Plannotator answers ⁸ | the question and the answer **enter** the agent's conversation ⁸ | as above | decide (side chat), with the opposite contract |
| **grill-kit** | clicks AskUserQuestion cards, rounds of up to 4; a claude.ai artifact board logs decisions ⁹ | AskUserQuestion answers | plugin; a forked grilling skill | decide |
| **claude-grill-mod** | clicks AskUserQuestion cards one at a time; a band shows progress; a plan at the end ¹⁰ | AskUserQuestion answers | plugin with a mod; rules in Traditional Chinese | decide |
| **Claude Code plan mode** | approves (three ways) or "keep planning" and says what to change; Ctrl+G edits the plan in an editor ¹¹ | the approval, or the typed feedback | none | understand (approve only) |
| **Seldon** | runs `/seldon plan.md`, reads a verdict | — (the verdict is for the person) | plugin zip or skill ¹² | understand (machine check of claims) |
| **VS Code `askQuestions`** | answers a question carousel: single/multi select, free text, recommended highlighted ¹³ | the answers | VS Code + Copilot | decide (other harness) |
| **Cursor plan mode** | answers clarifying questions, edits the plan Markdown, clicks Build ¹⁴ | the edited plan | Cursor | both, lightly (other harness) |
| **Kiro specs** | comments on passages in Markdown Review (IDE) or at checkpoints (CLI); approves phase by phase ¹⁵ | comments as one revision request ¹⁵ | Kiro IDE/CLI/web, account; free tier 50 credits, Pro $20/month ¹⁶ | understand (other harness) |
| **spec-kit `/clarify`** | answers ≤5 questions, one at a time, in chat: a letter, "recommended", or ≤5 words ¹⁷ | each answer written into the spec's `## Clarifications` and the section it affects ¹⁷ | spec-kit CLI + templates | both, in chat |
| **Break the Wall** | answers the skill's own round one question at a time (accept, pick, or a note in own words); side chat beside a question; checks the spec's statements against their backing, remarks, approves | only the answers; remarks open the next round; Approve sends one fixed message | Claude Code 2.1.330+, Node 22+, marketplace + plugin, Pocock's skills | both |

Harnesses other than Claude Code are out of the map's scope (map #160); they are here only to show what people elsewhere already have.

## Findings

### 1. `AskUserQuestion`: free, built in, and too small for a grilling round

- **Fact.** Claude uses it "to ask you multiple-choice questions when it needs a decision or a clarification. Answer by picking an option, or type your own text through the `Other` row or the notes field." Questions stay open unless `askUserQuestionTimeout` is set. ¹
- **Fact.** Each call holds 1–4 questions with 2–4 options each; `header` is at most 12 characters; it is not available in subagents. The answer is a map from question text to label (or the typed text); an optional `response` replaces the list with "The user responded: …". In the SDK, options can carry Markdown or HTML previews. ²
- **Inference.** Free text exists, so "pick only" is not a hard limit of the UI. The cost is elsewhere: the question must be written as a tool call with short labels, so the model writes questions that fit a picker. That is exactly Pocock's objection (§3).
- **Inference.** For a quick bounded choice mid-task it is good enough, and Break the Wall should not try to replace it. For a 7-question round with paragraphs of context, a recommendation and diagrams, it does not fit.

### 2. Plannotator: the broad, mature neighbour

- **Fact.** Plannotator is "a local, browser-based review surface for AI coding agents" across ten harnesses: plan review, annotation of Markdown/HTML/URLs, code review of diffs and PRs, sharing, and the Inbox. MIT or Apache-2.0; 15,334 stars on 2026-11-27. ⁵
- **Fact (Inbox).** "One local window where your agents leave you messages, questions, files, and guided reviews while they keep working … Nothing holds an agent session open while you do, and your reply goes back to the session that asked." ⁵ The agent sends `:::question` blocks through the `plannotator_inbox` tool; each block is one decision with choices, `Recommended:`, optional `Why:`, `Stakes:`, picture choices; `:::question-text` asks for free text. The person sees "Question N of M", picks, types in **Other…**, adds a note, skips or accepts the recommendation. The agent gets "Answers to your questions" with "(your recommendation)" marked and an "Unanswered" list. "A good round has a few questions … about 8 at most." ³ ⁴
- **Fact (grill-me).** A blog post of 2026-08-15 presents `/plannotator-last` as "an interactive UI for the grill-me skill": run it on each round, annotate, Send Feedback. The author: "the ability to annotate each part of a question or answer, rather than just selecting answers, is where the power is." ⁶ Since 2026-11-08, when a person invokes a grill-me skill **from the Inbox's own reply box**, the Inbox adds a note asking the agent to send its questions as `:::question` cards, keeping the skill's pace; the note is "never added to a session's own `/grill-me`" (`packages/core/grill-me.ts`). A one-time tip tells Inbox users: "its questions come to your Inbox as cards you can answer anytime" (`packages/inbox/components/GrillMeTip.tsx`).
- **Fact (side questions).** In Claude Code with the Plannotator mod, "Ask this session" is the only Ask AI option, and "your question shows in the agent's chat … your questions and the answers are also part of the agent's conversation." With a separate provider instead, "AI chat history stays separate from approve, deny, and send-annotations output." ⁸
- **Fact (plan review).** Annotation types: deletion, comment, quick label, looks good, global comment; image-region comments; plan diff between versions; in Claude Code "Approve does not send answers or notes to the agent". ⁷ ³
- **Fact (install).** The Claude Code plugin needs the `plannotator` binary first, installed by `curl -fsSL https://plannotator.ai/install.sh | bash` (or PowerShell), then `/plugin marketplace add backnotprop/plannotator`, `/plugin install`, restart. ⁵
- **Inference: where Plannotator is better.** Breadth (code review, HTML, sharing, ten harnesses, phone over Tailscale), maturity and audience, plan diff, an async Inbox that collects decisions from many sessions, and picture choices. For a person who already runs Plannotator, its Inbox is "good enough" for answering questions one at a time.
- **Inference: where Break the Wall differs.** (a) Rounds of Pocock's skills open from a terminal session with no command per round and no change to the skill's question format; Plannotator needs either `/plannotator-last` each round (annotation, not questions) or a grill-me started from the Inbox (cards in Plannotator's own format). (b) Break the Wall's side chat stays out of the agent's conversation; Plannotator's does the opposite in Claude Code. (c) Plannotator's plan review is free-form annotation; it does not show what a statement rests on. (a) is a small step for Plannotator, which already detects grill-me skills by name; (b) is a design choice either tool could flip; (c) is the only part with real distance.

### 3. Pocock: what people asked for, and why he said no

- **Fact.** `.out-of-scope/native-question-tool.md` (added 2026-10-06): requests to route grilling through a harness's question UI are out of scope. Reasons: the skills are harness-neutral text, and naming one harness's tool means a branch per harness or a skill that only works in one place; and "Structured pickers push the model towards multiple-choice questions with pre-baked answers, which is the opposite of what grilling is for: open questions you answer in your own words, one branch of the decision tree at a time. I've tried the `AskUserQuestion` UI and don't want it in these skills." A per-user `CLAUDE.md` line is the suggested route. ¹⁸
- **Fact: the five requests.** ¹⁹
  - **#19** (2026-03-21): use the question tool for select and multi-select; "makes it easier … instead of typing things out". Pocock: "I hate the AskUserQuestion UI, so I won't be including it here."
  - **#643** (2026-07-22): show the existing questions and recommendations through AskQuestion in Cursor, Claude Code and Claude Desktop, text as fallback; recordings attached. A commenter pointed to Pocock's video against the tool.
  - **#840** (2026-08-12): "I don't like the wall of text and how to answer everything in batches in plain text … questions are less overwhelming"; a rewritten skill with batches of at most five. A second user agreed the format "bypass[es] the tools".
  - **#1107** (2026-09-22): has to add "Use your QA tool to ask one question at a time" every time; a second user "Me too!".
  - **#1152** (2026-10-02): a PRD and a branch for a `/grill-questionnaire` skill writing a standalone HTML form with choices, recommendation, "other", rationale, and a Markdown export. Closed: same decision, and "a new skill, which I'm not taking. You're welcome to publish it yourself."
- **Inference: what they wanted.** The same three things each time: not to read a wall of text, not to answer by number in a prompt box, and to compare options side by side. Most asked for the picker as the means; #1152 asked for a page. None asked for a side chat or for spec checking.
- **Fact.** Discussion #1492 (Show and tell, 2026-11-27) is Break the Wall's own post. It cites the five requests and Pocock's reasons, says the plugin "doesn't fork or edit any skill", and names what it does inject: alternatives as a lettered list, `- **(a)** label: consequence`, and references at the end of each `/to-spec` statement. It asks where the page pushes people towards picking. No replies yet. ²⁰
- **Inference.** Break the Wall answers both of Pocock's reasons: it lives outside the skills, and it never forces a pick. But the lettered-list injection is a mild version of what he warns against: it asks the model to enumerate alternatives so the page can lay them out. That is the question #1492 rightly put to readers.

### 4. Community grilling UIs inside Claude Code

- **Fact.** `GingerCowboy/grill-kit` (MIT, 0 stars): a reworked grilling skill; "A round is one AskUserQuestion call holding up to 4 frontier questions"; decisions logged on a claude.ai artifact ("Grill Board") or in Markdown. ⁹
- **Fact.** `Karylcode/claude-grill-mod` (MIT, 0 stars): a mod plus a skill; one AskUserQuestion card per question with 2–4 options, a progress band, interrupt, a plan at the end; rules and buttons in Traditional Chinese. ¹⁰
- **Inference.** Both are what the five requesters asked for, built by forking the skill, which is the route Pocock suggested. Both inherit AskUserQuestion's limits and the pre-baked-answer pressure. Neither has a side chat or a spec view. They show demand, not competition.

### 5. Spec and plan review

- **Fact (Claude Code).** Plan approval offers "Yes, and use auto mode", "Yes, manually approve edits", "No, keep planning" (tell Claude what to change); Ctrl+G opens the plan in an editor. ¹¹ Ultraplan, which reviewed plans on claude.ai with inline comments, "is no longer available". ²¹
- **Fact (Kiro).** Specs are `requirements.md` (EARS), `design.md`, `tasks.md`. In the IDE a floating **Review** button opens Markdown Review "where you can comment on exact passages"; in the CLI, staged line comments go back "as one revision request". **Sync Files** "will create new tasks that map to the new requirements"; the docs describe no traceability ids between items. ¹⁵
- **Fact (spec-kit).** `/clarify` asks at most 5 questions, "EXACTLY ONE question at a time", with a recommended option and a table of 2–5 choices or a ≤5-word answer; each answer is written as `- Q: … → A: …` under `## Clarifications` and applied to the section it affects. ¹⁷
- **Fact (Seldon).** A plugin that "inspects your codebase for evidence, and returns a verdict": approve, approve with changes, major revision, with findings that cite file and line. ¹²
- **Inference.** Each touches a piece of the understand core: Kiro and Plannotator the passage remark, spec-kit the answer kept in the spec, Seldon the check of claims. None joins them: no tool found shows a person each statement of an agent-written spec beside what backs it (a round's answer, an issue, a file's lines), flags the ones with no backing, and turns a remark into the agent's next round. Seldon is the closest in intent, but it is a model's verdict, not a person's reading.

## Where Break the Wall stands

```
            better or good enough elsewhere            where Break the Wall is alone
  ┌──────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
  │ small bounded choices → AskUserQuestion  │   │ statements tied to their backing,        │
  │ async questions from many agents,        │   │ unbacked ones flagged (understand)       │
  │ pictures, phone → Plannotator Inbox      │   │ remark on the spec → next round          │
  │ plan diff, code review, sharing          │   ├──────────────────────────────────────────┤
  │ → Plannotator                            │   │ thin lead, easy to copy:                 │
  │ machine check of a plan → Seldon         │   │ Pocock's rounds as they are, no command  │
  │ other harnesses → askQuestions, Kiro,    │   │ per round; side chat kept out of the     │
  │ Cursor, spec-kit                         │   │ conversation (decide)                    │
  └──────────────────────────────────────────┘   └──────────────────────────────────────────┘
```

- **Inference.** The product definition calls decide "the way in" and understand "what sets the product apart". The comparables confirm that split: the way in is crowded and Plannotator is one release away from it; the part that sets it apart has no direct competitor.
- **Inference.** The adoption question on the map ("people who grill with Pocock's skills only, or any skill that asks in rounds") meets a real fact here: Plannotator already reaches grill-me users and owns the "review surface for agents" slot. A Pocock-only decide core competes with it on its own ground.
- **Unverified.** Whether people value the backing check enough to install for it. The product definition cites outside readers (2026-11-21) asking for a way to check an AI-written design doc against its lines; no usage data exists yet.

## Sources

1. Claude Code, Tools reference, "AskUserQuestion tool behavior": https://code.claude.com/docs/en/tools-reference
2. Claude Code, Agent SDK, "Handle approvals and user input" (question format, response format, limitations): https://code.claude.com/docs/en/agent-sdk/user-input
3. Plannotator docs, "Questions in Plans and Documents" (`apps/marketing/src/content/docs/guides/questions.md` at `f61d44d`): https://plannotator.ai/docs/guides/questions/
4. Plannotator, `apps/skills/claude/plannotator-inbox/SKILL.md` and Inbox reference (`docs/reference/inbox.md`) at `f61d44d`: https://github.com/backnotprop/plannotator
5. Plannotator README at `f61d44d` (scope, Inbox, install, license); repository metadata via `gh api repos/backnotprop/plannotator`: https://github.com/backnotprop/plannotator
6. Plannotator blog, "An interactive UI for the grill-me skill" (2026-08-15) and docs "Annotate Last": https://plannotator.ai/blog/an-interactive-ui-for-the-grill-me-skill/
7. Plannotator docs, "Plan Review" (`docs/commands/plan-review.md` at `f61d44d`): https://plannotator.ai/docs/commands/plan-review/
8. Plannotator docs, "AI Features", "Ask this session" (`docs/guides/ai-features.md` at `f61d44d`): https://plannotator.ai/docs/guides/ai-features/
9. `GingerCowboy/grill-kit`, README and `plugins/grill-kit/skills/grill/SKILL.md`: https://github.com/GingerCowboy/grill-kit
10. `Karylcode/claude-grill-mod`, README: https://github.com/Karylcode/claude-grill-mod
11. Claude Code, Permission modes, plan mode: https://code.claude.com/docs/en/permission-modes
12. `degrammer/seldon`, README: https://github.com/degrammer/seldon
13. VS Code 1.109 release notes, "Ask Questions tool (Experimental)" and Plan agent: https://code.visualstudio.com/updates/v1_109 ; 1.110 (moved to core, carousel): https://code.visualstudio.com/updates/v1_110
14. Cursor docs, Plan mode: https://cursor.com/docs/agent/plan-mode
15. Kiro docs, Specs and best practices: https://kiro.dev/docs/specs/ , https://kiro.dev/docs/specs/best-practices/
16. Kiro pricing: https://kiro.dev/pricing/
17. spec-kit, `templates/commands/clarify.md`: https://github.com/github/spec-kit/blob/main/templates/commands/clarify.md
18. `mattpocock/skills`, `.out-of-scope/native-question-tool.md` (commit `f0588cd`, 2026-10-06): https://github.com/mattpocock/skills/blob/main/.out-of-scope/native-question-tool.md
19. `mattpocock/skills` issues #19, #643, #840, #1107, #1152 and their comments: https://github.com/mattpocock/skills/issues/19 , /643 , /840 , /1107 , /1152
20. `mattpocock/skills` discussion #1492: https://github.com/mattpocock/skills/discussions/1492
21. Claude Code, "Ultraplan is no longer available": https://code.claude.com/docs/en/ultraplan
