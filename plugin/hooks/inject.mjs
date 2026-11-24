// @ts-check
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The plugin's classic hooks (#96): they ask the skills that write rounds for each question's options as a list the
 * server reads, so the page can show them side by side, without editing the pinned skills. Typed (UserPromptExpansion),
 * called by Claude (PreToolUse on Skill), and again after a compaction (SessionStart on compact) in a session asked
 * before, since a compaction summarises injected context instead of keeping it.
 *
 * Classic command hooks, not the mod's `classic.*` events: on Claude Code 2.1.330 a built-in plugin hooked on those
 * events runs first and passes them on past every other plugin, so a mod's hook there never runs (witnessed, #96).
 * Plain Node with no dependencies, like the mod: Claude Code's input is checked field by field. A request missed
 * degrades a round to "yes" or a note and never breaks it, so this answers nothing rather than fail.
 *
 * A round skill starting is also the injection marker that opens the session's round phase on the local server (#99), so a
 * clarifying turn before the first round already shows in the page. The launcher, beside the server in this plugin,
 * finds the server; it runs detached, so the skill's start never waits on it.
 *
 * The spec skill (`to-spec`) is asked for a closing `Spec: <location>` line (#104), which the server reads to open the
 * spec in the page. It opens no round phase: the handover ends it.
 */
const ROUND_SKILLS = new Set(['grilling', 'grill-me', 'grill-with-docs']);
const SPEC_SKILLS = new Set(['to-spec']);
/** A marker not refreshed for this long belongs to a session nobody resumes. */
const FORGET_MS = 30 * 24 * 3600 * 1000;
/** A session id names a file: only a plain one does. */
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Written for the model, so in English whatever the interface language. */
const OPTIONS_REQUEST = [
  'Break the Wall shows this grilling session\'s rounds in a page beside the terminal. Keep the skill\'s round format and questions as they are, with one addition:',
  'when a question has alternatives to choose between, list them inside its body as a Markdown list, one option per line, in exactly this form:',
  '',
  '- **(a)** label: consequence',
  '- **(b)** label: consequence',
  '',
  'Letters in order from (a); the label a few words; the consequence what choosing it leads to. In the ➡️ recommendation, name the option you recommend by its letter, as in "➡️ **(b)**, because …". A question with no real alternatives needs no list.',
].join('\n');

/** Written for the model, so in English whatever the interface language. */
const SPEC_REQUEST = [
  'Break the Wall opens the spec you hand over in a page beside the terminal, where the person reads it as a source. Keep the skill\'s steps and the spec\'s format as they are, with one addition: when you hand over the spec, end that message with one line, alone and last:',
  '',
  'Spec: <location>',
  '',
  'where <location> is the GitHub issue\'s URL (or `#<number>` for an issue of this repository), the file\'s path relative to the working directory, or `pasted` when the spec is the text of that same message, above the line. Hand over a revised spec the same way, with the same location: it opens as a new version.',
].join('\n');

/**
 * What each request asks, of which skills, and where the sessions asked are marked, so a compaction asks them again.
 * @typedef {'options' | 'spec'} Request
 * @type {Record<Request, { skills: Set<string>; folder: string; text: string }>}
 */
const REQUESTS = {
  options: { skills: ROUND_SKILLS, folder: 'options-sessions', text: OPTIONS_REQUEST },
  spec: { skills: SPEC_SKILLS, folder: 'spec-sessions', text: SPEC_REQUEST },
};
/** @type {Request[]} */
const KINDS = ['options', 'spec'];

/** The request a skill takes, typed or called, bare or under its plugin (`mattpocock-skills:grilling`). */
function requestOf(/** @type {unknown} */ name) {
  if (typeof name !== 'string') return undefined;
  const skill = name.trim().replace(/^\//, '').split(':').at(-1) ?? '';
  return KINDS.find(kind => REQUESTS[kind].skills.has(skill));
}

const markerDir = (/** @type {Request} */ kind) => join(process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'break-the-wall'), REQUESTS[kind].folder);

/** The session's marker file, or undefined for an id that could name anything but one file in the folder. */
const markerOf = (/** @type {Request} */ kind, /** @type {unknown} */ session) =>
  typeof session === 'string' && SESSION_ID.test(session) ? join(markerDir(kind), session) : undefined;

/**
 * One empty file per session asked, its time refreshed at each use (a compaction too, so a long session stays
 * marked); markers past FORGET_MS go as one is written.
 */
function mark(/** @type {Request} */ kind, /** @type {unknown} */ session) {
  const marker = markerOf(kind, session);
  if (!marker) return;
  try {
    const dir = markerDir(kind);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(marker, '');
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      if (now - statSync(join(dir, name)).mtimeMs > FORGET_MS) rmSync(join(dir, name), { force: true });
    }
  } catch { /* Without a marker the request still went out; only a later compaction will not repeat it. */ }
}

function isMarked(/** @type {Request} */ kind, /** @type {unknown} */ session) {
  const marker = markerOf(kind, session);
  try { return marker !== undefined && statSync(marker).isFile(); } catch { return false; }
}

/** @param {Record<string, unknown>} event @returns {Request[]} the requests that go with this event */
function asks(event) {
  /** @type {Request | undefined} */
  let kind;
  switch (event.hook_event_name) {
    case 'UserPromptExpansion':
      kind = requestOf(event.command_name);
      break;
    case 'PreToolUse': {
      const input = event.tool_input;
      if (event.tool_name === 'Skill' && typeof input === 'object' && input !== null) kind = requestOf(/** @type {{ skill?: unknown }} */ (input).skill);
      break;
    }
    case 'SessionStart': {
      if (event.source !== 'compact') return [];
      const marked = KINDS.filter(x => isMarked(x, event.session_id));
      for (const x of marked) mark(x, event.session_id);
      return marked;
    }
  }
  if (!kind) return [];
  mark(kind, event.session_id);
  return [kind];
}

/** `node launcher.cjs phase <session> <cwd>`, left running on its own; a failure only leaves the phase to the first round. */
function markPhase(/** @type {Record<string, unknown>} */ event) {
  const { session_id: session, cwd } = event;
  if (typeof session !== 'string' || !SESSION_ID.test(session) || typeof cwd !== 'string' || cwd === '') return;
  try {
    const launcher = join(dirname(dirname(fileURLToPath(import.meta.url))), 'server', 'launcher.cjs');
    const child = spawn(process.execPath, [launcher, 'phase', session, cwd], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
  } catch { /* No launcher to run: the phase opens at the first round. */ }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    if (typeof event !== 'object' || event === null) return;
    const requests = asks(event);
    if (requests.length === 0) return;
    // A compaction only re-sends the request the summary dropped: the server kept the phase, and one the person ended
    // must stay ended. Only a round skill starting opens it.
    if (event.hook_event_name !== 'SessionStart' && requests.includes('options')) markPhase(event);
    const additionalContext = requests.map(kind => REQUESTS[kind].text).join('\n\n');
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event.hook_event_name, additionalContext } }));
  } catch { /* Not an event: nothing to add. */ }
});
