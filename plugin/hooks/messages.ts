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
};
const en: typeof it = {
  description: 'Open Break the Wall’s page in the browser',
  nodeMissing: 'Break the Wall needs Node ≥ 22 on PATH',
  opened: 'Break the Wall is open in the browser.',
  alreadyOpen: 'Break the Wall is already open in a browser tab.',
  failed: 'Break the Wall’s page did not open. Start the session with claude --debug to read why.',
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
