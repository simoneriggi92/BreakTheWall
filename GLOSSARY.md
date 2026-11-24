# Break the Wall

Break the Wall lets a person answer an agent's rounds one question at a time, then explore the spec they lead to, taken apart into source-linked parts.

## Language

**Person**:
The one who answers an agent's rounds and explores the spec they lead to, or any source they open.
_Avoid_: learner, user, owner (who decides the product), reader (for the role; a reading surface, and the first readers are the audience), reviewer

**Source**:
The material opened in the app to explore, given by the person or handed over as a spec, read whole and cited by its own lines. One loop serves every source.
_Avoid_: input, mode, subject type

**Repository**:
A source made of many files, cited by file and line. It is explored by the same loop as any other source, never as a mode of its own.
_Avoid_: repo mode, codebase view

**Snapshot**:
The files a repository is made of at the moment it is read, as they are on disk, identified by their content. A commit, when there is one, only labels it.
_Avoid_: revision, checkout, version

**File**:
One text of a source, named by its path. A pasted text or a single document is a source of one file, named by its title.
_Avoid_: document, entry, blob

**Citation**:
A range of lines in one file of a source, naming the file. Every claim of a reading rests on citations; no quote is kept, the lines are read from the file.
_Avoid_: reference, quote, evidence

**Large source**:
A source larger than the app's budget for one reading, whatever its kind. It opens through an overview and a focus; a source within the budget is read whole.
_Avoid_: big repo, large repository

**Digest**:
What the app shows of a large source to its overview, built without a model: the listing of its files and sections with their line ranges, the few texts read whole, and the links the source declares.
_Avoid_: summary, index, map

**Overview**:
The reading of a large source as a whole: what it is about, its aspects, and its roles with the files or sections each one holds. It never holds a person's question.
_Avoid_: level 1, whole level

**Role**:
A part of a source named by what it does for the whole, not by a component's name. In an overview a role holds whole files or listed sections of the digest.
_Avoid_: module, component, folder, member (a member is a component a role names)

**Focus**:
The part of a large source read in depth, chosen by the person's question or, without one, by the app.
_Avoid_: scope, area, level 2

**Session**:
The agent's conversation in which rounds are asked, named by its agent. It is live while the agent runs it and ended otherwise; an ended session can be resumed, and keeps its rounds either way.
_Avoid_: conversation, chat, tab

**Round**:
The questions an agent asks together and waits on before it goes on, each with its context, options and recommendation. Answering rounds is the way into Break the Wall. A round is superseded when a later round or free block of the same session arrives; only the latest of a session is answered.
_Avoid_: form, questionnaire, prompt

**Round phase**:
The stretch of a session whose turns come to the page: from its first round or injection marker until the person ends it, or three turns in a row pass without a round. Outside it, the agent's turns stay in the terminal.
_Avoid_: grilling mode, round mode, page mode

**Injection marker**:
The sign that the agent was asked to write rounds in the page's format, given when a round skill starts. It opens the round phase before any round arrives.
_Avoid_: trigger, hook

**Free block**:
A turn of the agent without a round, during the round phase: its text, whole, and one field for the person's words, which return to the agent as one message.
_Avoid_: clarification (what it often is, not what it is), message, chat turn

**Answer**:
What the person gives one question of a round: a choice (the recommendation, an option, or none), an optional note, and the remarks and side-chat replies they attach. A round's answers return to the agent together.
_Avoid_: reply (a side chat's), feedback

**Side chat**:
A conversation anchored to one question of a round, that can read what the agent reads but never enters the agent's conversation unless the person attaches a reply to their answer.
_Avoid_: btw, ask AI, thread

**Remark**:
A note in free text the person anchors to one passage of a round's question or of a spec, for the agent to read. It is never answered where it is written.
_Avoid_: annotation (a part of a source), comment, note (the free text of an answer)

**Spec**:
What the agent writes from the person's decisions, taken in the rounds of one or more sessions. It opens as a source of one file, read as it was when handed over. A spec revised and handed over again is a new version; the earlier one stays readable as it was, and takes no new remarks.
_Avoid_: plan, PRD, design doc

**Backing**:
What a statement of a spec declares it rests on: an answer, a decision recorded elsewhere, or lines of a file. A statement without backing is unbacked; one whose backing cannot be found has a broken backing.
_Avoid_: basis (a link's, declared or interpreted), evidence, source

**Exploration**:
The in-depth reading of a source within the budget, or of one focus of a large source, saved with the files it read. A focus's exploration refers to the overview it came from; another focus of the same snapshot is another exploration sharing that overview.
_Avoid_: lesson, session, analysis
