import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentView } from '../src/core/round-phase';
import type { History } from '../src/core/session-history';
import { LocalPage } from '../src/renderer/LocalPage';

const SECRET = 'a'.repeat(43);
interface Call { url: string; secret: string | null }

/** The local server as the page sees it: it knows one secret and refuses every other; it may show a round or a free block. */
function fakeServer(known = SECRET, shows: { current?: CurrentView; history?: History } = {}) {
  const calls: Call[] = [];
  const held = new Set<(error: Error) => void>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const secret = new Headers(init?.headers).get('x-btw-secret');
    const url = String(input);
    calls.push({ url, secret });
    if (secret !== known) return new Response(JSON.stringify({ error: 'secret' }), { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current' && shows.current) return Response.json({ current: shows.current });
    if (url === '/api/history' && shows.history) return Response.json(shows.history);
    if (url === '/api/page/poll') return new Promise<Response>((_, fail) => {
      held.add(fail);
      init?.signal?.addEventListener('abort', () => fail(new DOMException('aborted', 'AbortError')));
    });
    return new Response('{}', { status: 404 });
  });
  const breakPolls = () => { for (const fail of held) fail(new TypeError('Failed to fetch')); held.clear(); };
  return { fetch: fetch as unknown as typeof window.fetch, calls, breakPolls };
}
const openAt = (hash: string) => window.history.replaceState(null, '', `/${hash}`);
const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });

beforeEach(() => { sessionStorage.clear(); openAt(''); });
afterEach(() => setLanguage('it-IT'));

describe('a tab opened without a valid secret (#94)', () => {
  it('says only to open it from Claude Code, in Italian', async () => {
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    expect(await screen.findByRole('main')).toHaveTextContent(/^Aprila da Claude Code con \/break-the-wall$/);
    expect(server.calls).toEqual([]);
  });

  it('says it in English when the browser speaks English', async () => {
    setLanguage('en-GB');
    render(<LocalPage fetch={fakeServer().fetch}/>);
    expect(await screen.findByRole('main')).toHaveTextContent(/^Open it from Claude Code with \/break-the-wall$/);
  });

  it('says it when the server refuses the secret, and forgets that secret', async () => {
    openAt(`#t=${'b'.repeat(43)}`);
    render(<LocalPage fetch={fakeServer().fetch}/>);
    expect(await screen.findByRole('main')).toHaveTextContent('Aprila da Claude Code con /break-the-wall');
    expect(sessionStorage.length).toBe(0);
  });
});

describe('a tab whose server has gone (#94)', () => {
  it('says to open it from Claude Code once the server stops answering, instead of waiting forever', async () => {
    openAt(`#t=${SECRET}`);
    let up = true;
    const server = fakeServer();
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (up) return server.fetch(input, init);
      throw new TypeError('Failed to fetch');
    }) as typeof window.fetch;
    render(<LocalPage fetch={fetch}/>);
    await screen.findByText('CLAUDE CODE · LOCALE');
    // The server stops: the held poll breaks, and nothing answers on its port any more.
    up = false;
    server.breakPolls();
    expect(await screen.findByText(/^Aprila da Claude Code con/)).toHaveTextContent('Aprila da Claude Code con /break-the-wall');
    expect(screen.queryByText('CLAUDE CODE · LOCALE')).not.toBeInTheDocument();
  });
});

describe('a tab opened from Claude Code (#94)', () => {
  it('takes the secret from the fragment, keeps it for the tab, and clears it from the address', async () => {
    openAt(`#t=${SECRET}`);
    render(<LocalPage fetch={fakeServer().fetch}/>);
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(Object.values({ ...sessionStorage })).toContain(SECRET);
    expect(await screen.findByText('CLAUDE CODE · LOCALE')).toBeInTheDocument();
  });

  it('sends the secret in a header on every call, and polls so the server knows a page is connected', async () => {
    openAt(`#t=${SECRET}`);
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    await waitFor(() => expect(server.calls.map(x => x.url)).toContain('/api/page/poll'));
    expect(server.calls.length).toBeGreaterThan(1);
    for (const call of server.calls) expect(call.secret).toBe(SECRET);
    for (const call of server.calls) expect(call.url).not.toContain(SECRET);
  });

  it('still opens after a reload, from the secret the tab kept', async () => {
    openAt(`#t=${SECRET}`);
    const first = render(<LocalPage fetch={fakeServer().fetch}/>);
    await screen.findByText('CLAUDE CODE · LOCALE');
    first.unmount();
    openAt('');
    render(<LocalPage fetch={fakeServer().fetch}/>);
    expect(await screen.findByText('CLAUDE CODE · LOCALE')).toBeInTheDocument();
  });
});

const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
const SHOWN = { project: 'BreakTheWall', turnFolded: false, session: SESSION, number: 1, receivedAt: '2026-11-24T10:00:00.000Z', sent: null, superseded: false };
const A_ROUND: CurrentView = {
  kind: 'round', phaseOpen: true, queued: false, transcriptGone: false, riding: [],
  round: {
    ...SHOWN, turnText: '', draft: { generalNote: '', answers: {} },
    questions: [{ number: 1, title: 'Where do rounds live?', body: 'Beside the session.', options: [], recommended: null, recommendation: 'In the data folder.' }],
  },
};
const A_FREE_BLOCK: CurrentView = { kind: 'free', phaseOpen: true, queued: false, transcriptGone: false, riding: [], block: { ...SHOWN, text: 'Which folder?', response: '' } };
const HISTORY: History = {
  projects: [{ cwd: '/work/BreakTheWall', sessions: [{ session: SESSION, startedAt: '2026-11-24T10:00:00.000Z', live: true, skill: null, ticket: null, transcriptGone: false, rounds: [{ number: 1, receivedAt: '2026-11-24T10:00:00.000Z', state: 'open' }] }] }],
  update: null,
};

describe('the progress strip and the history dock (#125)', () => {
  // jsdom lays nothing out: what it can show is the structure the stylesheet raises the dock by
  // (`.round-page.has-strip ~ .page-dock`, checked in tests/theme.test.ts) and the strip itself.
  it('puts the strip on a round, and the dock after the page that holds it, so the dock rises above it', async () => {
    openAt(`#t=${SECRET}`);
    render(<LocalPage fetch={fakeServer(SECRET, { current: A_ROUND, history: HISTORY }).fetch}/>);
    const strip = await screen.findByRole('contentinfo', { name: 'Avanzamento del round' });
    expect(within(strip).getByText('0/1 con risposta')).toBeInTheDocument();
    const page = strip.closest('.round-page')!;
    expect(page).toHaveClass('has-strip');
    const toggle = await screen.findByRole('button', { name: 'Cronologia' });
    const dock = toggle.closest('.page-dock')!;
    expect(dock).not.toBeNull();
    // A later sibling of the page, as the `~` combinator needs; inside the page it would never be raised.
    expect(dock.parentElement).toBe(page.parentElement);
    expect(page.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no strip under a free block, so the dock stays at the window\'s foot', async () => {
    openAt(`#t=${SECRET}`);
    render(<LocalPage fetch={fakeServer(SECRET, { current: A_FREE_BLOCK, history: HISTORY }).fetch}/>);
    await screen.findByRole('button', { name: 'Cronologia' });
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(document.querySelector('.round-page')).not.toHaveClass('has-strip');
  });
});
