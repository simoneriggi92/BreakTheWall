---
status: accepted
---

# An exploration cites files and refers to its overview

An exploration held one source and cited it by line (`{ from, to }`), so it could not say which file of a repository a claim rests on, and a large source now opens through an overview and a focus (ADR 0001). So every citation names its file, `{ file, from, to }`, for every source: a pasted text or a single document is a source of one file, named by its title. And one repository yields two kinds of record: an **overview**, saved once per snapshot identity (ADR 0002), and an **exploration** for each focus, which refers to its overview and carries the files it read. A source within the budget stays one exploration without an overview. (Owner, 2026-11-18, ticket "How does a citation name a file, and how many explorations does one repository yield?".)

## Decision

- **Contract.** `schemaVersion: 2`. The exploration carries `files: [{ path, text, sha256 }]` in place of `source`, within the budget; `file` in a citation is one of those paths. A path is relative, POSIX, without `..` or a leading `/`, unique in the exploration, compared exactly as git lists it.
- **Focus.** A focus's exploration carries `overview: { id, role }`: the overview it came from and the role it reads in depth. Another area of the same snapshot is another exploration sharing that overview.
- **Order.** Files are kept in natural path order (`ch2` before `ch10`); a position in the source is `(file index, line)`, wherever `firstLine` orders parts, aspects or blocks today.
- **Source index and reading report.** Each file is a top section, its Markdown headings its subsections; a code file has none. With one file the file level is dropped and nothing changes. The report has one group per file, verdicts per `(file, line)`, and `leftOut` lists the exploration's files nothing cites. Files not read belong to the bill of materials, not to the report.
- **Stored explorations.** A version 1 file read from disk is upgraded in memory (its source becomes the one file, every citation gets its name); the file on disk is never rewritten. A model or an assistant through the MCP server must answer version 2. Prepared fixtures are rewritten.
- **Missing overview.** A focus whose overview is missing or invalid opens alone, from its saved files, and the view says the overview is not available.
- **Library.** One entry per overview, its focuses under it; a stale overview stays listed with its focuses.

## Considered options

- **`file` optional, absent meaning the only text.** Rejected: two shapes in every rule, the drift the repository map forbids.
- **Global line numbers over a flattened text**, translated back by the host. Rejected: models miscount large numbers, and `file:line` would become an invisible translation.
- **A short id per file** (`f3`), as the retired disassembly did. Rejected: one more mapping for the model to get wrong, and an unreadable stored document.
- **One document per repository**, growing with each focus, or duplicated with the overview inside. Rejected: unbounded, a revision means regeneration rather than addition, and copied overviews can diverge.
- **Rewriting version 1 files on disk.** Rejected: an irreversible write to the learner's data for no gain over upgrading on read.
- **A symbol index for code** (functions and classes through a parser). Rejected: it is not an index the source declares, and it puts a language parser into a rule that serves every source.

## Consequences

- Citations cost more output tokens (a path per range).
- What the overview contains, and whether it cites whole files, is left to the overview's contract; whether "order agreement" and traces mean anything on a repository is left to the detector on a repository's shape.
