# Break the Wall

Break the Wall takes a source apart into source-linked parts and lets the learner explore how it holds together.

## Language

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
The reading of a large source as a whole: what it is about, its aspects, and its roles with the files or sections each one holds. It never holds a learner's question.
_Avoid_: level 1, whole level

**Role**:
A part of a source named by what it does for the whole, not by a component's name. In an overview a role holds whole files or listed sections of the digest.
_Avoid_: module, component, folder, member (a member is a component a role names)

**Focus**:
The part of a large source read in depth, chosen by the learner's question or, without one, by the app.
_Avoid_: scope, area, level 2

**Round**:
The questions an agent asks together and waits on before it goes on, each with its context, options and recommendation. Answering rounds is the way into Break the Wall.
_Avoid_: form, questionnaire, prompt

**Side chat**:
A conversation anchored to one question of a round, that can read what the agent reads but never enters the agent's conversation unless the person attaches a reply to their answer.
_Avoid_: btw, ask AI, thread

**Remark**:
A note in free text the person anchors to one passage of a round's question or of a spec, for the agent to read. It is never answered where it is written.
_Avoid_: annotation (a part of a source), comment, note (the free text of an answer)

**Spec**:
What the agent writes from the answered rounds of a session. It opens as a source of one file, read as it was when handed over.
_Avoid_: plan, PRD, design doc

**Exploration**:
The in-depth reading of a source within the budget, or of one focus of a large source, saved with the files it read. A focus's exploration refers to the overview it came from; another focus of the same snapshot is another exploration sharing that overview.
_Avoid_: lesson, session, analysis
