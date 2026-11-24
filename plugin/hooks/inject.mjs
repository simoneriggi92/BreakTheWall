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
 */
const ROUND_SKILLS = new Set(['grilling', 'grill-me', 'grill-with-docs']);
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

/** Typed or called, bare or under its plugin (`mattpocock-skills:grilling`). */
const isRoundSkill = (/** @type {unknown} */ name) =>
  typeof name === 'string' && ROUND_SKILLS.has(name.trim().replace(/^\//, '').split(':').at(-1) ?? '');

const markerDir = () => join(process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'break-the-wall'), 'options-sessions');

/** The session's marker file, or undefined for an id that could name anything but one file in the folder. */
const markerOf = (/** @type {unknown} */ session) =>
  typeof session === 'string' && SESSION_ID.test(session) ? join(markerDir(), session) : undefined;

/**
 * One empty file per session asked, its time refreshed at each use (a compaction too, so a long session stays
 * marked); markers past FORGET_MS go as one is written.
 */
function mark(/** @type {unknown} */ session) {
  const marker = markerOf(session);
  if (!marker) return;
  try {
    const dir = markerDir();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(marker, '');
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      if (now - statSync(join(dir, name)).mtimeMs > FORGET_MS) rmSync(join(dir, name), { force: true });
    }
  } catch { /* Without a marker the request still went out; only a later compaction will not repeat it. */ }
}

function isMarked(/** @type {unknown} */ session) {
  const marker = markerOf(session);
  try { return marker !== undefined && statSync(marker).isFile(); } catch { return false; }
}

/** @param {Record<string, unknown>} event @returns {boolean} whether the request goes with this event */
function asks(event) {
  switch (event.hook_event_name) {
    case 'UserPromptExpansion':
      if (!isRoundSkill(event.command_name)) return false;
      mark(event.session_id);
      return true;
    case 'PreToolUse': {
      const input = event.tool_input;
      if (event.tool_name !== 'Skill' || typeof input !== 'object' || input === null || !isRoundSkill(/** @type {{ skill?: unknown }} */ (input).skill)) return false;
      mark(event.session_id);
      return true;
    }
    case 'SessionStart':
      if (event.source !== 'compact' || !isMarked(event.session_id)) return false;
      mark(event.session_id);
      return true;
    default:
      return false;
  }
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
    if (typeof event !== 'object' || event === null || !asks(event)) return;
    // A compaction only re-sends the request the summary dropped: the server kept the phase, and one the person ended
    // must stay ended. Only a round skill starting opens it.
    if (event.hook_event_name !== 'SessionStart') markPhase(event);
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event.hook_event_name, additionalContext: OPTIONS_REQUEST } }));
  } catch { /* Not an event: nothing to add. */ }
});
