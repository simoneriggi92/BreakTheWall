/** The oldest Claude Code the mod has been witnessed on; plugin.json's `engines` range starts here too (#145). */
export const MIN_CLAUDE_CODE = '2.1.330';

/**
 * The mod's own words, in both interface languages (#94). They live in the mod because the one that matters most,
 * "needs Node", has to be said when no server can run.
 */
const it = {
  description: 'Apre la pagina di Break the Wall nel browser',
  nodeMissing: 'Break the Wall richiede Node ≥ 22 nel PATH',
  opened: 'Break the Wall è aperto nel browser.',
  alreadyOpen: 'Break the Wall è già aperto in una scheda del browser.',
  failed: 'La pagina di Break the Wall non si è aperta. Avvia la sessione con claude --debug per leggere il motivo.',
  outdated: `Break the Wall richiede Claude Code ${MIN_CLAUDE_CODE} o successivo: esegui claude update e apri una nuova sessione.`,
};
const en: typeof it = {
  description: 'Open Break the Wall’s page in the browser',
  nodeMissing: 'Break the Wall needs Node ≥ 22 on PATH',
  opened: 'Break the Wall is open in the browser.',
  alreadyOpen: 'Break the Wall is already open in a browser tab.',
  failed: 'Break the Wall’s page did not open. Start the session with claude --debug to read why.',
  outdated: `Break the Wall needs Claude Code ${MIN_CLAUDE_CODE} or later: run claude update, then start a new session.`,
};
export type ModMessages = typeof it;
export const MOD_MESSAGES = { it, en };

/** The system's language, as the page defaults to it: Italian for an Italian locale, English otherwise. */
export const modMessages = (locale: string | undefined): ModMessages => locale?.toLowerCase().startsWith('it') ? it : en;

/** Whether `node --version` printed a Node the server runs on. */
export function nodeIsSupported(versionOutput: string): boolean {
  const major = /^v(\d+)\./.exec(versionOutput.trim())?.[1];
  return major !== undefined && Number(major) >= 22;
}

/** Whether a Claude Code version (`2.1.332`, or a development build's `2.1.332-dev.…`) is at least `MIN_CLAUDE_CODE`. */
export function claudeCodeIsSupported(version: string): boolean {
  const parts = (v: string) => /^(\d+)\.(\d+)\.(\d+)/.exec(v)?.slice(1).map(Number)
  const have = parts(version.trim())
  const need = parts(MIN_CLAUDE_CODE)
  if (!have || !need) return false
  for (let i = 0; i < 3; i++) if (have[i] !== need[i]) return have[i]! > need[i]!
  return true
}
