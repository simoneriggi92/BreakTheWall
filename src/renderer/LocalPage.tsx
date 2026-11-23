import { useEffect, useMemo, useState } from 'react';
import type { RoundView } from '../core/round-answers';
import { App } from './App';
import { httpBridge, RefusedError } from './http-bridge';
import { PreferencesProvider, usePreferences } from './preferences';
import { RoundPage } from './round/RoundPage';
import { browserBridge } from './storage';

const SECRET_KEY = 'btw:page-secret';
const RETRY_MS = 2000;

/**
 * The secret `/break-the-wall` put in the fragment (`#t=…`), kept for this tab only and cleared from the address, so
 * it is not left in the address bar, the history or a copied link. A reload finds it in `sessionStorage`.
 */
function takeSecret(): string | null {
  const fromLink = new URLSearchParams(window.location.hash.slice(1)).get('t');
  if (fromLink) {
    try { sessionStorage.setItem(SECRET_KEY, fromLink); } catch { /* A tab without storage still works until reload. */ }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return fromLink;
  }
  try { return sessionStorage.getItem(SECRET_KEY); } catch { return null; }
}
function forgetSecret() {
  try { sessionStorage.removeItem(SECRET_KEY); } catch { /* nothing kept */ }
}

/** The local page's entry (#94): the app over the HTTP bridge, or one line saying where to open it from. */
export function LocalPage({ fetch: fetcher }: { fetch?: typeof fetch }) {
  const [secret] = useState(takeSecret);
  const bridge = useMemo(() => secret ? httpBridge(secret, fetcher) : undefined, [secret, fetcher]);
  const [state, setState] = useState<'checking' | 'open' | 'refused'>(bridge ? 'checking' : 'refused');
  /** The latest round the server holds; read again after every poll, which answers early when it changes. */
  const [round, setRound] = useState<RoundView | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    // Any failure, a refused secret or a stopped server, has the same remedy: open the page again from Claude Code.
    void bridge.getRuntime().then(() => { if (active) setState('open'); }, error => {
      if (!active) return;
      if (error instanceof RefusedError) forgetSecret();
      setState('refused');
    });
    return () => { active = false; };
  }, [bridge]);

  useEffect(() => {
    if (!bridge || state !== 'open') return;
    const stop = new AbortController();
    const refresh = () => bridge.getRound().then(next => { if (!stop.signal.aborted) setRound(next); }, () => {});
    void refresh();
    void (async () => {
      while (!stop.signal.aborted) {
        try {
          if (await bridge.poll(stop.signal) === 'refused') { forgetSecret(); setState('refused'); return; }
          void refresh();
        } catch {
          if (stop.signal.aborted) return;
          // A broken poll is either a hiccup or a stopped server; a restarted one listens on another port with
          // another secret, so this tab can never reconnect. Only then does it say where to open the page again.
          const alive = await bridge.getRuntime().then(() => true, error => { if (error instanceof RefusedError) forgetSecret(); return false; });
          if (stop.signal.aborted) return;
          if (!alive) { setState('refused'); return; }
          await new Promise(done => setTimeout(done, RETRY_MS));
        }
      }
    })();
    return () => stop.abort();
  }, [bridge, state]);

  if (state === 'open' && bridge) {
    if (!round) return <App bridge={bridge}/>;
    // Keyed by the round, so a new round starts with its own draft and focus.
    return <PreferencesProvider bridge={bridge}><RoundPage key={`${round.session}/${round.number}`} round={round} bridge={bridge}/></PreferencesProvider>;
  }
  if (state === 'checking') return null;
  return <PreferencesProvider bridge={browserBridge}><Secretless/></PreferencesProvider>;
}

function Secretless() {
  const { t } = usePreferences();
  return <main className="secretless">{t.page.secretless} <code>/break-the-wall</code></main>;
}
