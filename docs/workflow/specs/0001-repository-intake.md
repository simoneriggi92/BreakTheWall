# 0001. Read a local repository through hardened git plumbing

> **Frozen on 2026-11-16.** Written under the retired `jsmastery-pro/skills` workflow and kept as history, not as a plan of record. See [the frozen history](../README.md).

**Date**: 2026-11-13
**Status**: Proposed

## Summary

You pick a local folder inside a git repository, and the app reads it safely and tells you exactly what it read. Git lists the files (so `.gitignore` rules are exact), but only through commands that cannot be tricked into running code from the repository. Every file that is not read is listed with its reason, and any file that looks like it holds a secret is held back whole. The result is a saved manifest (the list of what was read and why the rest was not) that the repository map (feature 5) and the area exploration (feature 6) build on.

## Context

Break the Wall reads a source and lets you explore how it holds together. Release 1 makes a code repository one more kind of source. Before any map or exploration can exist, the app needs a trustworthy answer to one question: which files of this repository, at which version, did it actually read? The pain this release answers is the reader who discovers that the one file they needed was silently left out. So the intake must account for every file, not just the ones it kept.

Three forces shape the problem. First, safety: a repository can hold credentials, and whatever the intake reads may later travel to a model in a conversation. A missed secret is the costliest failure here, which is why the scope raises this feature to the Beta tier. Second, a repository is not trusted input: a downloaded folder can carry its own `.git/config`, and some git settings name a program for git to run. Third, size: the target is a repository of about 3,000 files (the size of FastAPI), while a monorepo or a home folder can hold hundreds of thousands, most of them dependencies or build output that `.gitignore` already describes.

The existing app reads only single `.txt` and `.md` files chosen by hand (`src/core/source.ts`, the `sources:pick` handler in `src/desktop/main.ts`), with no folder access anywhere. The renderer has no filesystem; every desktop operation is a named, validated IPC call (`src/desktop/AGENTS.md`). Saved data lives in versioned JSON files under `<userData>`, replaced atomically (`src/desktop/exploration-store.ts`).

This feature assumes the reader is a developer with a local clone and git installed (the first readers named in `docs/product.md`). It deliberately stops at the manifest: what the repository is and how it divides is feature 5, and reading an area's code is feature 6.

## Requirements

**User stories**:
- As a developer, I want to open a local repository in Break the Wall so that I can later explore it like any other source.
- As a developer, I want to see exactly which files were read and why every other file was not, so that I know the file I need was not dropped without a word.
- As a developer, I want files holding secrets kept out automatically, so that a credential never travels into a conversation by accident.
- As a developer working in a monorepo, I want to read just one package folder, so that I stay within the limits and read only what matters.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: In the Library, "Open a repository" opens the native folder dialog. Cancelling the dialog changes nothing.
- **AC-2**: A folder outside a git work tree, a machine without git, or a repository git refuses to open (for example "dubious ownership") is refused with a message naming the cause, in Italian and English. Nothing is saved.
- **AC-3**: The snapshot records the `HEAD` commit (or none, for a repository without commits), the branch (or none, for a detached `HEAD`), the paths whose content differs from that commit (`modified`, including tracked files deleted from disk), and the paths not in that commit (`untracked`).
- **AC-4**: Every candidate path (a tracked or untracked, not ignored, file present on disk under the chosen folder) appears exactly once in the manifest: either as read, or as not read with a reason. Ignored paths appear as entries too, one per ignored folder as git collapses it (for example `node_modules/`), or one per ignored file.
- **AC-5**: A path is not read, with its reason and detail, when it is a symbolic link (`link`), a submodule (`submodule`), generated (`generated`: declared `linguist-generated` or `linguist-vendored` in `.gitattributes`, a known lockfile, or a `.min.js`, `.min.mjs`, `.min.css` file, the detail naming which), larger than 1 MB (`size`, with its bytes), binary (`binary`), not valid UTF 8 (`not-utf8`), or failing to open or read (`unreadable`).
- **AC-6**: A file is held back whole as `secret` when its content matches a secret rule, or when it is an environment file (`.env` or `.env.<anything>`) other than `.env.example`, `.env.sample` or `.env.template`. The manifest names each finding as rule and line (at most 50 per file), and never contains the matched value, whole or in part. There is no way to force such a file to be read.
- **AC-7**: A selection with more than 20,000 candidate files, or whose files to read add up to more than 200 MB, is refused before any file is read, with a message stating the counts found and the limits.
- **AC-8**: The report shows the snapshot, the counts (read, not read, not read per reason), the not read entries grouped by reason with `secret` first, each with its detail, and the read files listed by path with their state (`clean`, `modified`, `untracked`).
- **AC-9**: While the intake runs, the screen shows progress as files done out of the total, with a Cancel button. Cancelling saves nothing and leaves any earlier record of the same folder untouched.
- **AC-10**: The manifest is saved under `<userData>`, one record per chosen folder. The Library lists saved repositories and reopens their report. "Read again" runs the intake again on the same folder and replaces the record. "Remove" deletes the saved record only, never the folder.
- **AC-11**: Git runs only through the plumbing commands named in this spec, with `core.fsmonitor` turned off, never through a shell and never `git status`. A repository whose `.git/config` names an fsmonitor program does not run it. No file content crosses IPC, and the renderer never supplies a filesystem path.
- **AC-12**: Choosing a subfolder of a repository reads only that subfolder. Paths are relative to it, and the snapshot comes from the repository that contains it.
- **AC-13**: The intake of a repository of about 3,000 files (a FastAPI clone) finishes within 10 seconds on the owner's Apple Silicon Mac.
- **AC-14**: Every new interface string exists in the Italian and the English catalog.

## Options considered

### Option 1: The git command line, plumbing only, hardened

The host runs the installed `git` with `execFile` (no shell) and only low level commands that list and resolve: `rev-parse`, `symbolic-ref`, `ls-tree`, `ls-files`, `check-attr`. Each call forces `core.fsmonitor=false` and `core.untrackedCache=false`. Whether a file differs from the commit is computed by the app itself, by hashing the file the way git does and comparing with the commit's tree, so `git status` (which refreshes the index and can run configured filters and the fsmonitor) is never needed.

**Pros**:
- Ignore rules are exactly git's: nested `.gitignore`, `.git/info/exclude`, the global excludes file.
- No new dependency; git is already on a developer's machine.
- Fast on thousands of files: one process call per listing, not per file.

**Cons**:
- Requires git installed; the app must explain the refusal when it is missing.
- Runs an external program on untrusted input, so the hardening is load bearing and must be tested against a hostile repository.

### Option 2: isomorphic-git

A git implementation in plain JavaScript, added as a dependency. It reads `.git` directly and never starts a process.

**Pros**:
- No external program, so no configuration of the repository can make anything run.
- Works without git installed.

**Cons**:
- A new dependency with a large surface, to pin and keep current, for a project that adds dependencies only when needed.
- Slower on large trees, and its ignore and index handling can differ from real git in edge cases, which is exactly where "nothing left out silently" is judged.

### Option 3: A walker of its own plus the `ignore` package

The host walks the folder itself, applies `.gitignore` files with the `ignore` package, and reads `HEAD` from the files in `.git`.

**Pros**:
- No process, small dependency.
- Also works on folders that are not repositories.

**Cons**:
- Global excludes, `.git/info/exclude`, packed refs, worktrees and submodules all have to be reimplemented.
- "Modified since the commit" needs the commit's tree, which means parsing git objects (compressed, possibly packed): effectively writing a small git.

## Decision

**Chosen option**: Option 1: The git command line, plumbing only, hardened.

The host reads the repository with hardened git plumbing, classifies every candidate path in a fixed order, holds back secrets by content and environment files by name, and saves a manifest (never file content) that the renderer shows as a report.

## Rationale

The force that decides this feature is "every file accounted for". Real git is the only option that agrees with what the developer sees in their own tools about what is ignored; options 2 and 3 would each produce their own, slightly different idea of the repository, and the difference would surface as a file missing for no stated reason. The owner also prefers no new dependency where an existing tool suffices (`AGENTS.md`, Rules).

The cost of option 1 is the safety risk of running git on a folder that may not be trusted. That risk is concentrated in a few known places (the fsmonitor hook, configured filters run during an index refresh, hooks run by porcelain commands), and all of them sit outside the commands chosen here. Turning the fsmonitor off explicitly and never calling `git status` closes them, and a test with a trap repository proves it. Computing "modified" ourselves costs one SHA 1 per file, which is cheap next to reading the file at all.

The secret detector is a rule list of our own in `src/core` rather than an external scanner (gitleaks would add a Go binary to sign and ship for two systems; secretlint adds several transitive packages). The rules cover known token formats, private keys, credentials inside URLs, and assignments of long random values to names like `password` or `token`; environment files are held back by name because a short password such as `DB_PASSWORD=postgres2024` is neither a known format nor random enough for the assignment rule. Holding the whole file back with no override is the Beta choice: a false positive costs a quick edit and a "Read again", a false negative costs a leaked key.

## Feature design

**Data model sketch** (one JSON document per chosen folder, `<userData>/repositories/<id>.json`, schema `version: 1`):

| Entity | Key | Fields | Relationship |
|---|---|---|---|
| `RepositoryIntake` | `id`: `repo-` plus the first 12 hex characters of the SHA 256 of the chosen folder's real path | `version: 1` (req), `root`: absolute real path (req), `name`: folder name (req), `takenAt`: ISO time (req), `limits`: `{ maxFileBytes: 1_000_000, maxFiles: 20_000, maxTotalBytes: 200_000_000 }` (req) | contains 1 `Snapshot`, N `ReadFile`, N `NotReadEntry` |
| `Snapshot` (embedded) | none | `commit`: 40 hex or `null` (req), `branch`: string or `null` (req), `modified`: path[] (req), `untracked`: path[] (req) | 1:1 with the intake |
| `ReadFile` | `path`, unique in the intake | `bytes`: int (req), `lines`: int (req, of the normalized text), `longestLine`: int (req), `sha256`: hex of the normalized text (req), `state`: `clean` · `modified` · `untracked` (req), `language`: string or `null` (req) | N per intake |
| `NotReadEntry` | `path`, unique in the intake (an ignored folder ends with `/`) | `reason`: `ignored` · `link` · `submodule` · `generated` · `size` · `binary` · `not-utf8` · `secret` · `unreadable` (req); `detail` by reason: `generated` → `{ rule: 'attribute' \| 'lockfile' \| 'minified' }`, `size` → `{ bytes }`, `secret` → `{ findings: SecretFinding[] }` (1 to 50), others → `{}` | N per intake |
| `SecretFinding` (embedded) | none | `rule`: rule id (req), `line`: int, 1 based (req; `0` for the `env-file` rule, which names no line) | N per held back file |

`longestLine` is recorded so feature 6 can decide how to cite long lines with the facts at hand; long lines are not a reason to skip a file here. Paths are relative to the chosen folder, with `/` as separator on every system. The view sent to the renderer is the same document; `root` is included for display only and is never accepted back.

**State transitions**: an intake run goes `listing → reading → saved`, or ends in `refused` (AC-2, AC-7) or `cancelled` (AC-9). Only `saved` writes a file. A saved record has no states of its own: "Read again" replaces it, "Remove" deletes it.

**Intake pipeline** (host, `src/desktop/repository-intake.ts`; `cwd` is always the chosen folder, so git limits every listing to it and prints paths relative to it):

1. `git rev-parse --is-inside-work-tree` must print `true` (else `not-a-repository`; a bare repository also fails here). `ENOENT` on spawn means `git-missing`. A refusal mentioning ownership maps to `unsafe-repository`, any other nonzero exit to `git-failed`.
2. Snapshot: `git rev-parse --verify --quiet HEAD^{commit}` (empty means no commit), `git symbolic-ref --quiet --short HEAD` (empty means detached), `git ls-tree -r -z HEAD` (path, mode and blob id of every file in the commit under the folder; skipped when there is no commit).
3. Listing: `git ls-files -z --stage` (tracked: mode tells `120000` link and `160000` submodule), `git ls-files -z --others --exclude-standard` (untracked, not ignored), `git ls-files -z --others --ignored --exclude-standard --directory` (ignored entries, folders collapsed).
4. `git check-attr -z --stdin linguist-generated linguist-vendored` for all candidates in one call.
5. `lstat` every candidate. Missing on disk: a tracked path goes to `snapshot.modified` only (it is deleted, not a candidate); an untracked one that vanished is `unreadable`. Then the caps (AC-7) on the candidate count and on the summed sizes of the files that would be read; refusal happens here, before reading.
6. Classify each candidate, first match wins: `link` → `submodule` → `generated` (attribute, then lockfile name, then minified name) → `secret` by name (`env-file`) → `size` → read the bytes → `binary` (a NUL byte in the first 8,000 bytes) → `not-utf8` (strict decode) → `secret` by content → read.
7. For a read file: strip the BOM and normalize with `normalizeText` from `src/core/source.ts`, count lines and the longest line, hash with `hashText`; compute the git blob id of the raw bytes (`sha1("blob " + length + "\0" + bytes)`) and compare it with the commit's blob for the path: equal means `clean`; if not equal, compare again after turning CRLF into LF (a Windows checkout with `core.autocrlf`), equal means `clean`; otherwise `modified`. A path absent from the commit is `untracked`.
8. Reads run 16 at a time, the abort signal is checked between files, progress is sent at most ten times a second. On success the manifest is validated with its Zod schema and written atomically.

Every git call is `execFile('git', ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '--no-optional-locks', ...args], { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }, maxBuffer })`, with `maxBuffer` large enough for 20,000 paths plus ignored entries (64 MB). Output is split on NUL, never on newlines, so any file name is safe.

**Secret rules** (`src/core/secrets.ts`, pure functions, scanned line by line on the normalized text): `private-key` (PEM `BEGIN ... PRIVATE KEY` headers), `aws-access-key` (`AKIA` or `ASIA` plus 16), `github-token` (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), `gitlab-token` (`glpat-`), `slack-token` (`xox` tokens and `hooks.slack.com/services/` URLs), `stripe-key` (`sk_live_`, `rk_live_`), `anthropic-key` (`sk-ant-`), `openai-key` (`sk-` keys, checked after `anthropic-key`), `google-api-key` (`AIza` plus 35), `jwt` (three base64url segments starting `eyJ`), `url-credentials` (a `scheme://user:password@` URL whose password passes the randomness check), `generic-assignment` (a name containing `password`, `passwd`, `secret`, `token`, `api_key`, `apikey`, `access_key`, `private_key`, `client_secret` or `auth`, then `=`, `:` or `=>`, then a value of at least 16 characters with Shannon entropy of at least 3.5 bits per character that is not a placeholder: no `example`, `changeme`, `your_`, `xxx`, `<`, `${`, `process.env`, `os.environ`), and `env-file` (by name, AC-6). Every pattern must be linear time (no nested quantifiers) so a 1 MB single line scans quickly. The thresholds are named constants next to the rules.

**API surface** (named IPC calls in `src/desktop/preload.ts`, handlers in `src/desktop/main.ts`, every handler starting with `trustedSender(event)`, inputs parsed with Zod schemas from `src/core/repository.ts`):

| Call | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `repositories:open` | invoke | none (the host opens the folder dialog) | `{ ok: true, intake }` or `{ ok: false, failure }` | trusted sender | `cancelled-dialog`, `busy`, `not-a-repository`, `git-missing`, `unsafe-repository`, `git-failed`, `too-many-files` `{ files, limit }`, `too-large` `{ bytes, limit }`, `cancelled` |
| `repositories:refresh` | invoke | `{ id }` (req) | same as `open` | trusted sender | as `open`, plus `not-found`, `folder-missing` |
| `repositories:cancel` | invoke | none | none | trusted sender | none (no run is a no op) |
| `repositories:list` | invoke | none | `{ repositories: Summary[], skipped }`, `Summary` = `id`, `name`, `root`, `takenAt`, `commit`, `branch`, `read`, `notRead` | trusted sender | none |
| `repositories:find` | invoke | `{ id }` (req) | the intake, or `undefined` | trusted sender | `undefined` when missing or invalid |
| `repositories:remove` | invoke | `{ id }` (req) | `{ ok: boolean }` | trusted sender | `ok: false` when missing |
| `repositories:progress` | event, host to renderer | none | `{ phase: 'listing' \| 'reading', done, total }` | not applicable | the preload drops what does not parse |

The renderer's `browserBridge` (the bridge used by `npm run dev:web`, with no host) answers `open` and `refresh` with a `desktop-only` failure and lists nothing.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| open | the folder | the native dialog in the host (`openDirectory`), resolved with `realpath`; never from the renderer |
| refresh | the folder | `root` of the stored record found by `id` |
| intake | `id` | derived: `repo-` plus 12 hex of SHA 256 of the real path |
| intake | `name` | the real path's last segment |
| intake | `takenAt` | the host clock at the end of a successful run |
| snapshot | `commit`, `branch` | `rev-parse` and `symbolic-ref` (pipeline step 2) |
| snapshot | `modified`, `untracked` | derived: blob comparison (step 7) and deleted tracked paths (step 5) |
| read file | `bytes` | `lstat` size |
| read file | `lines`, `longestLine`, `sha256` | derived from the normalized text (`normalizeText`, `hashText`) |
| read file | `state` | derived: blob id of the raw bytes compared with `ls-tree` output |
| read file | `language` | the extension map in `src/core/repository.ts` (unknown extension gives `null`) |
| not read | `reason`, `detail` | the classification order (step 6); `generated.rule` from which check matched; `size.bytes` from `lstat`; `secret.findings` from the rule scan |
| caps | limits in messages and `limits` | constants in `src/core/repository.ts` (1 MB, 20,000 files, 200 MB) |
| progress | `done`, `total` | the reading loop; `total` is the candidate count after step 5 |
| report | counts per reason | derived at render time from the manifest, never stored |
| Library | the list | `repositories:list` |

**Key invariants**:
- Every candidate path is in exactly one of `read` and `notRead`; no path appears twice; ignored entries never overlap candidates.
- No manifest field ever holds file content or any part of a matched secret value.
- A failed, refused or cancelled run writes nothing; a saved record is always a complete, schema valid manifest.
- The host reads only paths that, after `realpath`, are inside the chosen folder, and it never follows a symbolic link.
- Git is never given a command outside this spec's list and never runs `status`.
- One intake runs at a time; a second start while one runs answers `busy`.

**Security model**: a local, single person app; there are no roles. The renderer can name a saved record by `id` and nothing else: it never passes a path, and it never receives file content in this feature. Every handler checks the sender. The repository is untrusted input: git runs without a shell, with the fsmonitor and the untracked cache off, and only with listing commands, so no configuration inside the repository can make it run a program. Saved manifests are written with file mode `0600` in a `0700` folder, like the other stores. Content is never logged; errors log the code only. The MCP server cannot start an intake (out of scope).

**Configuration required**: none. No environment variable, credential or setting is added.

**Critical test scenarios** (each maps to an acceptance criterion in ## Requirements):
- Happy path: a temporary repository with a committed file, a modified file, an untracked file, an ignored `node_modules/`, a lockfile, a `.min.js`, a binary, a Latin 1 file, a symbolic link and a 2 MB file produces a manifest where each lands in its expected list with its reason and detail, the snapshot lists the right modified and untracked paths, and each candidate appears once, verifies **AC-3**, **AC-4**, **AC-5**
- Secrets: files containing each rule's format (built at test run time by concatenation, so no literal token is ever committed to this public repository), a `.env` and a `.env.production` are held back with rule and line, a `.env.example` and placeholder assignments are read, and the saved JSON contains none of the values, verifies **AC-6**
- Hostile repository: a repository whose `.git/config` sets `core.fsmonitor` to a script that writes a marker file; after the intake the marker does not exist, verifies **AC-11**
- Refusals: a plain folder, a missing git binary (the git path made unavailable in the test), and a repository over a lowered cap are refused with the right code and counts, and nothing is saved, verifies **AC-2**, **AC-7**
- Cancel: an intake cancelled midway saves nothing and an earlier record of the same folder is unchanged, verifies **AC-9**
- Subfolder: choosing `packages/a` lists only its paths, relative to it, with the enclosing repository's commit, verifies **AC-12**
- Windows checkout: a file with CRLF on disk and LF in the commit is `clean`, verifies **AC-3**
- Permission: an IPC call from a frame outside the app origin is refused by `trustedSender`, and `repositories:refresh` with an unknown or malformed `id` returns `not-found` without touching the disk, verifies **AC-11**
- Report: the report renders snapshot, counts, groups with `secret` first and the read list in both languages, verifies **AC-8**, **AC-14**

## Build plan

Skateboard: the thinnest usable whole is the full chain (pick, read, save, report) with every safety rule in place, because at Beta nothing ships without the secret rules. The thinness comes from what is left out (no snapshot history, no override, no folder tree, no content shown), not from a partial chain. The order builds the pure, testable core first, then the host around it, then the screen.

1. Contract in `src/core/repository.ts`: Zod schemas for the manifest, the view, the summary, the IPC inputs and the failures; the limits; the lockfile and minified name rules; the extension to language map; the git blob id helper. Tests for schema bounds and the helpers, satisfies **AC-4**, **AC-5**, **AC-7**
2. Secret rules in `src/core/secrets.ts` with the scan returning `{ rule, line }[]` capped at 50, and the `env-file` name rule. Tests with true and false examples built at run time, plus a timing test on a 1 MB single line, satisfies **AC-6**
3. Hardened git runner and intake pipeline in `src/desktop/repository-intake.ts` (no `electron` import, so tests run it under plain Node), with the abort signal and the progress callback. Tests on temporary repositories: happy path, subfolder, CRLF, caps, refusals, cancel, and the fsmonitor trap, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**, **AC-9**, **AC-11**, **AC-12**
4. `src/desktop/repository-store.ts`: save atomically (`.pending` then rename), list (invalid files counted as skipped, never shown), find, remove. Tests like `tests/exploration-store.test.ts`, satisfies **AC-10**
5. IPC: the six handlers in `main.ts` (dialog with `openDirectory`, one run at a time, root from the store on refresh), the named calls and the progress listener in `preload.ts`, the bridge types in `src/core/provider.ts`, the `desktop-only` answers in `browserBridge`, satisfies **AC-1**, **AC-9**, **AC-10**, **AC-11**
6. Renderer: "Open a repository" in the Library heading, a Repositories section with one card per record, the progress screen with Cancel, and the report screen (snapshot, counts, groups by reason with `secret` first, read list with state, "Read again", "Remove" with a confirmation). Strings in `src/renderer/i18n/it.ts` and `en.ts` together. Tests with Testing Library in both languages, satisfies **AC-1**, **AC-8**, **AC-9**, **AC-10**, **AC-14**
7. On the real app: open a FastAPI clone, time the intake, check the report against `git ls-files` by hand on a few paths, satisfies **AC-13**

## Consequences

**Positive**:
- Features 5 and 6 start from a manifest that says exactly what exists, at which commit, and what was left out and why.
- What counts as ignored matches what the developer's own git says.
- No file content is copied out of the repository or across IPC; secrets never reach a saved file.

**Negative / tradeoffs**:
- Git must be installed; a machine without it gets a refusal, and the app does not ship git.
- A secret rule can be wrong. A false positive keeps a harmless file out until it is edited, since there is no override; a token in a format the rules do not know is still read. The rule list needs care over time.
- The manifest describes the working tree at one moment. Once the repository changes, features 5 and 6 must compare each file's `sha256` before using it, and say so when a file has changed.
- Reading the working tree means untracked content is not reproducible from the commit alone; the snapshot says which paths those are, but not their content.
- Hashing and scanning run in the main process. If AC-13 fails on real hardware, the scan moves to a worker thread.
- Folders that are not repositories cannot be read yet.

**Neutral**:
- A new store folder, `<userData>/repositories/`, and a new kind of card in the Library.
- Tests now create temporary git repositories, so git must be present wherever `npm run check` runs (it is on both CI systems).

## Follow-up

- [ ] Decide whether source maps (`*.js.map`, `*.css.map`) and other build output count as generated, if real repositories show them read often.
- [ ] Add a gotcha to `src/desktop/AGENTS.md` (via `/sync`): git runs only through the hardened runner, never `git status`, and test secrets are built at run time, never committed as literals.
- [ ] Review the secret rules against current token formats before a public release.
- [ ] Feature 6 decides how lines longer than the citation limit (`longestLine` above 4,000) are read or listed.
