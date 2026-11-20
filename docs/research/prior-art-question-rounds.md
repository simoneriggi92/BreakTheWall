# Prior art: answering an agent's question rounds outside the terminal

Date: 2026-11-20. Scope: research for issue #71 (map #70). No app source, configuration or dependency is changed. Nothing was installed or run; every claim comes from the owner's documentation, README or source listed under Sources.

Labels used below: **Fact** is backed by the cited source; **Inference** is the author's reading of those facts. "Not documented" means the primary source is silent, not that the feature is absent.

## The target, in five checks

From map #70, the experience is judged on five parts:

1. **Blocks**: each question of a round is its own unit (context, options, recommendation, diagram when useful).
2. **Anchored side chat**: a chat attached to one block, opened beside it with the round still in view, able to read the repository, without filling the main conversation.
3. **Answers returned**: choice + note per block go back to the running agent.
4. **Progress**: "3/7 answered", closed blocks collapse.
5. **History**: the next round updates the page; past rounds stay reachable.

Plus the launch constraint: started from Claude Code with a command or plugin, no installer to download.

One fact about the input shapes everything below. The repository's `grilling` skill does **not** use Claude Code's `AskUserQuestion` tool: it writes a round as plain Markdown in the assistant message (`❓ **Q1** - **<title>**: …` followed by `➡️ <recommended answer>`), then waits ([`.agents/skills/grilling/SKILL.md`](../../.agents/skills/grilling/SKILL.md)). So a tool that intercepts `AskUserQuestion` never sees a grilling round unless the skill's output changes.

## Short answer

**Partly solved, by one tool.** Plannotator's *question blocks* (MIT or Apache-2.0, a Claude Code plugin) already deliver blocks, answers returned to the running Claude Code session, a visible "N/M answered" count and drafts that survive a reload. What nothing found delivers is the **side chat anchored to one question** that can read the repository **without entering the main conversation**: Plannotator's Ask AI in a Claude Code session writes the question and answer into the agent's conversation, and every other "side chat" (Claude Code `/btw`, Desktop side chats, ChatGPT branches) is either not anchored to a block, has no tools, or forks into a separate full chat. The `AskUserQuestion`-based tools do not see grilling rounds at all, and are capped at four questions per call.

## Comparison

✓ covered · ◐ partly · ✗ not covered · ? not documented

| | Blocks | Anchored side chat | Answers returned | Progress | History | Launch from Claude Code | Licence |
|---|---|---|---|---|---|---|---|
| **Plannotator question blocks** (`/plannotator-last`, `/plannotator-annotate`, plan review) | ✓ one card per `:::question` | ◐ Ask AI exists; anchoring to a card not documented; in Claude Code it enters the main conversation | ✓ one message, per question | ✓ "Question N of M", "4/4 answered" | ◐ drafts survive reload; past rounds live in the agent session; rolling page not documented | ✓ plugin + slash command (binary via install script) | MIT or Apache-2.0 |
| **Plannotator Inbox** | ✓ several `:::question` cards per message | ✗ | ✓ next turn when idle | ◐ delivery status, section counts | ✓ threads stored, archive, search | ✓ plugin adds a `plannotator_inbox` tool | MIT or Apache-2.0 |
| **Claude Code `AskUserQuestion`** (terminal, VS Code, Remote Control) | ◐ 1–4 questions, 2–4 options, 12-char header | ✗ | ✓ native | ? | ✗ | built in | Claude Code terms (not open source) |
| **Claude Code `/btw`** (CLI) | ✗ | ◐ side, not anchored, no tools, single response | ✗ never enters the conversation | ✗ | ◐ newest 20 exchanges in memory, lost on exit | built in | Claude Code terms |
| **`/btw` in VS Code, side chat in Claude Desktop** | ✗ | ◐ panel beside the chat with follow-ups; not anchored to a passage | ✗ | ✗ | ◐ VS Code keeps the thread across reloads; Desktop does not save it | built in | Claude Code terms |
| **ChatGPT "Branch in new chat"** | ✗ | ◐ branch from a message, opens a separate full chat | ✗ no agent | ✗ | ✓ branches listed as chats | not applicable | OpenAI terms |
| **AskUserQuestionsPro** | ✓ grouped questions, six input types | ✗ | ✓ via hook or MCP | ? ("review" step) | ◐ recoverable rounds | ◐ npm global install + installer | MIT |
| **askUserQuestion Web** | ✓ cards, notes, HTML previews | ✗ | ✓ via skill + local server | ? | ◐ answers stored in `.auq/` | ◐ `git clone` + install script, then a skill | MIT |
| **better-ask-picker** | ✓ several questions in one TUI pane | ✗ | ✓ own `pick` tool | ✓ "(1/3)" | ✗ | ✓ `/plugin install` | MIT |
| **mcp-feedback-enhanced, interactive-mcp, interactive-feedback-mcp** | ✗ one feedback prompt per call | ✗ | ✓ MCP tool result | ✗ | ◐ (mcp-feedback-enhanced: history export) | MCP server config | MIT ¹⁹ |
| **Crystl question cards** | ◐ multiple-choice cards with dot navigation | ✗ | ✓ | ? | ? | separate macOS app | not stated |
| **MCP elicitation** (protocol) | ◐ a form defined by the server | ✗ | ✓ to the server | ✗ | ✗ | built in | open spec |

## Findings

### 1. Plannotator question blocks: the closest match

- **Fact.** Plannotator is "a local, browser-based review surface for AI coding agents", installed in Claude Code with `/plugin marketplace add backnotprop/plannotator` and `/plugin install plannotator@plannotator`, plus a `plannotator` binary installed separately by a script ¹ ². Dual-licensed "under Apache 2.0 or MIT at your option" ¹. Latest release v0.29.1, 2026-11-19 ³.
- **Fact.** Since question blocks exist, an agent can write each decision as a `:::question … :::` block in Markdown: first line the question, prose lines as context (an image is allowed), choices as `- [ ] label — why`, and `Recommended: <label>`. Variants: `:::question-multi`, `:::question-text`. The docs advise "about 8 questions at most" per round ⁴.
- **Fact.** Each block renders as a card showing "Question N of M" and a status (Open, Answered, Skipped, Settled), with **Other…**, **Add note**, **Skip** and **Accept recommended**. The header shows "4/4 answered"; clicking it jumps to the next open question. Answers are saved in a draft that survives a reload; `Mod+Z` undoes ⁴.
- **Fact.** **Send answers** returns one message whose first section is "Answers to your questions", one `### Qn. <question> (line N)` entry each, `Answer: <choice>` marked "(your recommendation)" when accepted, plus `Note:`, `Skipped`, and an "Unanswered" list ⁴.
- **Fact.** Question blocks work in plan review, `plannotator annotate` on a Markdown file or folder, and `plannotator last`. With Claude Code 2.1.287 or later and the Plannotator mod, "The agent does not wait. Your answers arrive as a message when you send them" ⁴ ².
- **Fact.** The project wrote about this exact use case: "An interactive UI for the grill-me skill" (2026-08-15) runs `/grill-me`, then `/plannotator-last` on each round, annotates it, and sends the annotations back "as its next input". The post predates question blocks; in that flow a round is an annotatable message, not a set of cards ⁵ ⁴.
- **Fact.** Ask AI: "When Plannotator is opened from Claude Code 2.1.287 or later (with the Plannotator mod) … Ask AI is answered by the agent session that opened it. This is the only Ask AI option there." And: "Your question shows in the agent's chat … The question and the answer become part of the agent's conversation." Without the mod, Ask AI uses a provider instead; the Claude provider "starts with read and search tools plus a limited set of inspection commands" ⁶ ⁷.
- **Fact.** Ask AI is documented for code diffs (select lines, the answer "stays attached to the file in the chat history") and as available in annotate and `/plannotator-last`. Its conversation "is separate from your annotations and final review. Copy a useful conclusion into a normal annotation if you want it included" ⁷ ⁶.
- **Inference.** Against the target: blocks ✓ (recommendation, context and image per block; diagrams other than images not verified), answers returned ✓, progress ✓, responsiveness partly (instant draft save). The anchored side chat is where it misses: in the Claude Code setup that wakes the agent, Ask AI writes into the main conversation, which the map rules out; the provider path keeps it separate and can read the repository, but anchoring a thread to one question card, and keeping that card visible beside it, is not documented. Using it for grilling requires the round in `:::question` syntax (a change in the skill's output format, an open question on the map) or falls back to plain annotation via `/plannotator-last`. Whether the page rolls on to the next round, or reopens per round, is not documented.

### 2. Plannotator Inbox: asynchronous threads, no side chat

- **Fact.** The Inbox is "where all of that arrives while they keep working": agents send questions, plans and diffs to a local browser page on `127.0.0.1`; the Claude Code plugin adds a `plannotator_inbox` tool ⁸ ⁹. A message can carry several `:::question` blocks; picks "save at once"; **Send** delivers "your picks, your words, and any file annotations as one reply", which reaches Claude Code "as a new turn once the session is idle" ¹⁰.
- **Fact.** Threads are stored under `~/.plannotator/inbox/`, can be archived and searched; progress is shown as delivery status ("1 of 3 delivered") and sections such as "Stopped on you" ¹⁰. No AI chat on a thread or card is described ¹⁰.
- **Inference.** Strong on history and on not blocking the agent; the agent must choose to call `plannotator_inbox`, so grilling would again need a skill change. No anchored side chat.

### 3. Claude Code `AskUserQuestion`: the native form, too narrow for a grilling round

- **Fact.** `AskUserQuestion` "asks the user one to four multiple-choice questions"; each has `question`, a `header` (max 12 characters), 2–4 `options` with `label`, `description` and an optional `preview`, and `multiSelect` ¹¹ ¹². The user can answer through an `Other` row or a notes field ¹³.
- **Fact.** It can be answered outside the terminal: a `PreToolUse` hook can collect the answer "through your own UI" and return `permissionDecision: "allow"` with `updatedInput` holding `answers` ¹¹; an Agent SDK app does the same through `canUseTool` ¹². Remote Control forwards these questions to claude.ai/code and the mobile app and keeps them open until answered ¹⁴.
- **Inference.** It is the cleanest "answers returned" channel, but a grilling round never goes through it (see above), and four questions per call is below a typical round. Every third-party form that hooks it (finding 6) inherits both limits.

### 4. Claude Code `/btw` and Desktop side chats: side, but not anchored

- **Fact.** `/btw` asks "a question about your current work without adding to the conversation history". It answers only from context: "Claude can't read files, run commands, or search". It is a single response per question; earlier side questions are replayed (newest 20) and kept in memory until exit; `f` forks a question into a background subagent with tools ¹³.
- **Fact.** In the VS Code extension, "the answer opens in a panel beside the chat, where you can ask follow-up questions", and the thread survives window reloads ¹⁵ ¹³. In Claude Desktop, a side chat (`Cmd+;` or `/btw`) "can read everything in the main thread up to that point" and "doesn't add anything back to the main conversation"; Desktop "doesn't save side chats to disk" ¹⁶.
- **Inference.** This is the pain on the map ("`/btw` loses the thread"): the side answer is attached to the session, not to the question it came from, and in the CLI it cannot read the repository.

### 5. Side chats in chat products: branches, not anchors

- **Fact.** ChatGPT added branching on 2025-09-04: "you can now branch conversations in ChatGPT, letting you more easily explore different directions without losing your original thread" (web), extended to iOS and Android in December 2025 ¹⁷. A branch is a new chat in the sidebar, created from a whole message.
- **Fact.** Selecting text to open an inline sub-thread is still a user feature request on OpenAI's forum ¹⁸; a third-party Chrome extension ("ChatGPT Side Threads") adds it to ChatGPT, outside OpenAI's product ¹⁸.
- **Fact.** Claude Code has `/branch` (switch into a copy of the conversation) and `/fork` (copy into a background session) ²⁰.
- **Inference.** Branching leaves the original page and duplicates the whole conversation; it does not keep a question in view beside its chat, and nothing flows back as an answer. No first-party chat product found anchors a thread to a passage.

### 6. Plugins and MCP servers that render questions as a page

- **Fact.** AskUserQuestionsPro (MIT): "a local, full-screen structured-question UI" for Claude Code (via the `AskUserQuestion` hook) and Codex (via MCP); grouped questions with `binary`, `single`, `multi`, `scale`, `ranking`, `tree` inputs; single-flight rounds with recovery; installed with `npm install --global` ²¹.
- **Fact.** askUserQuestion Web (MIT, created 2026-10-15): questions as cards with "Other", "Add a note" and side-by-side HTML previews; a local server on port 5700 started by a skill; answers stored in `.auq/` ²².
- **Fact.** better-ask-picker (MIT, v0.1.0): a Claude Code plugin that draws its own TUI pane through the "early-access function-hooks plugin API", several questions in one pane with progress "(1/3)", no 4-option limit; needs a terminal at least 144 columns wide ²³.
- **Fact.** Feedback MCP servers (mcp-feedback-enhanced, interactive-mcp, interactive-feedback-mcp) open a page or window for one feedback prompt (text, a quick option, images in mcp-feedback-enhanced) whose reply returns as the tool result; mcp-feedback-enhanced lists Cursor, Cline, Windsurf, Augment, Trae, not Claude Code, and its maintainers note that "If native capabilities [elicitation] cover your needs, just use those" ¹⁹.
- **Fact.** Claude Code supports MCP elicitation: "Claude Code displays an interactive dialog in the terminal"; in cloud sessions the request appears as a card at claude.ai/code ²⁴. Crystl (macOS terminal app) shows "an agent's multiple-choice questions … as floating cards with dot navigation" ²⁵.
- **Inference.** These solve "a nicer form than the terminal". None has a side chat, and the `AskUserQuestion`-based ones do not see grilling rounds.

## Verdict

**Partly. Nothing solves the whole pain; one tool covers most of it.**

- **Covered already**: one block per question with context and recommendation, answers back to the running Claude Code agent, an answered count, instant save. Plannotator question blocks do this today, open source, launched from Claude Code with a plugin.
- **Not covered by anything found**: a side chat **anchored to one question**, opened **beside** it, that can **read the repository** and stays **out of the main conversation** until the owner attaches it. This is the part the map's pain names (`/btw` loses the thread), and it is the only clear gap.
- **Also unverified or missing**: a page that rolls on to the next round while past rounds stay reachable on it; the map's readability checks (line length, one block in focus).
- **Precondition for any of them**: grilling rounds are plain text. Plannotator needs `:::question` syntax (or degrades to plain annotation); `AskUserQuestion` tools need the tool call and fit at most four questions.

**Inference for the map.** Building the block form and the answer return from scratch would duplicate Plannotator. The cheap test is to run one real grilling round through Plannotator with the round written as `:::question` blocks, and judge it against the quality bar. What is left to design, and where a new product or a Break the Wall feature could earn its place, is the anchored side chat. Plannotator's dual MIT/Apache licence allows either reuse or contribution.

## Sources

1. Plannotator README, <https://github.com/backnotprop/plannotator> (read 2026-11-20).
2. Plannotator docs, Claude Code, <https://docs.plannotator.ai/open-source/agents/claude-code>.
3. Plannotator releases, `gh release list -R backnotprop/plannotator` (v0.29.1, 2026-11-19).
4. Plannotator docs, "Answer Your Agent's Questions Asynchronously", <https://docs.plannotator.ai/open-source/workflows/questions.md> (last verified by the project on v0.27.25/v0.28.0, October 2026).
5. Plannotator blog, "An interactive UI for the grill-me skill", <https://plannotator.ai/blog/an-interactive-ui-for-the-grill-me-skill/>.
6. Plannotator docs, "Ask This Session", <https://docs.plannotator.ai/open-source/workflows/ask-this-session.md> (verified on v0.28.0).
7. Plannotator docs, "Ask AI during a review", <https://docs.plannotator.ai/open-source/workflows/ask-ai.md> (verified on v0.25.0).
8. Plannotator Inbox page, <https://plannotator.ai/inbox/>.
9. Plannotator docs, Inbox setup, <https://docs.plannotator.ai/open-source/inbox>.
10. Plannotator Inbox reference, <https://plannotator.ai/docs/reference/inbox/>.
11. Claude Code docs, Hooks reference (AskUserQuestion input, "Tools that require user interaction", "Defer a tool call for later"), <https://code.claude.com/docs/en/hooks>.
12. Claude Code docs, Agent SDK "Handle approvals and user input", <https://code.claude.com/docs/en/agent-sdk/user-input>.
13. Claude Code docs, Tools reference ("AskUserQuestion tool behavior"), <https://code.claude.com/docs/en/tools-reference>, and Interactive mode ("Side questions with /btw"), <https://code.claude.com/docs/en/interactive-mode>.
14. Claude Code docs, Remote Control, <https://code.claude.com/docs/en/remote-control>.
15. Claude Code docs, VS Code extension, <https://code.claude.com/docs/en/vs-code>.
16. Claude Code docs, Desktop application ("Ask a side question without derailing the session"), <https://code.claude.com/docs/en/desktop>.
17. OpenAI on X, 2025-09-04, <https://x.com/OpenAI/status/1963697012014215181>, and 2025-12, <https://x.com/OpenAI/status/2000669385317605759>. (The ChatGPT release notes page returned HTTP 403 to automated fetches.)
18. OpenAI Developer Community, "Feature Request: 'Ask about this' - inline subthreads for selected text", <https://community.openai.com/t/feature-request-ask-about-this-inline-subthreads-for-selected-text/1390498>; Chrome Web Store, "ChatGPT Side Threads", <https://chromewebstore.google.com/detail/dmibonjkadgaanbknljobpbapjamobnl>.
19. <https://github.com/Minidoracat/mcp-feedback-enhanced> (README states MIT; GitHub detects "Other"), <https://github.com/ttommyth/interactive-mcp> (MIT), <https://github.com/noopstudios/interactive-feedback-mcp> (MIT).
20. Claude Code docs, Commands, <https://code.claude.com/docs/en/commands>.
21. AskUserQuestionsPro README, <https://github.com/ozkayhan/AskUserQuestionsPro>.
22. askUserQuestion Web README, <https://github.com/seikaikyo/askUserQuestionWeb>.
23. better-ask-picker README, <https://github.com/togishima/better-ask-picker>.
24. Claude Code docs, MCP ("Respond to MCP elicitation requests"), <https://code.claude.com/docs/en/mcp>.
25. Crystl, "Floating cards", <https://crystl.dev/features/floating-cards/>.
