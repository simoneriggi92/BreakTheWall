import { screen, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundView } from '../src/core/round-answers';
import type { CurrentView } from '../src/core/round-phase';
import type { History, HistorySession } from '../src/core/session-history';
import { LocalPage } from '../src/renderer/LocalPage';

vi.mock('../src/renderer/diagrams', () => ({ renderDiagram: vi.fn(async () => '<svg></svg>') }));

const SECRET = 'a'.repeat(43);
const ALPHA = 'c0ffee00-0000-4000-8000-00000000000a';
const BETA = 'c0ffee00-0000-4000-8000-00000000000b';

const roundOf = (session: string, number: number, title: string, more: Partial<RoundView> = {}): RoundView => ({
  session, number, receivedAt: `2026-11-23T10:0${number}:00.000Z`, turnText: '',
  questions: [{ number: 1, title, body: `About ${title.toLowerCase()}`, options: [], recommended: null, recommendation: 'The simple one.' }],
  draft: { generalNote: '', answers: {} }, sent: null, superseded: false, ...more,
});
const asView = (round: RoundView): CurrentView => ({ kind: 'round', round, phaseOpen: true, queued: false, transcriptGone: false });
const sessionOf = (session: string, rounds: HistorySession['rounds'], more: Partial<HistorySession> = {}): HistorySession =>
  ({ session, startedAt: '2026-11-23T10:00:00.000Z', live: true, skill: null, ticket: null, transcriptGone: false, rounds, ...more });

/**
 * The local server as the page sees it (seam ② of #92): the latest round, the history column, past rounds by
 * session and number, deletion, and a poll that answers when any of them changes.
 */
function fakeServer(initial: { current: RoundView; history: History; past?: RoundView[] }) {
  let current = initial.current;
  let history = initial.history;
  const past = new Map((initial.past ?? []).map(x => [`${x.session}/${x.number}`, x]));
  const requests: { method: string; url: string }[] = [];
  const polls = new Set<(reply: Response) => void>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    requests.push({ method, url });
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current') return Response.json({ current: asView(current) });
    if (url === '/api/history') return Response.json(history);
    if (url === '/api/page/poll') return new Promise<Response>((done, fail) => {
      polls.add(done);
      init?.signal?.addEventListener('abort', () => fail(new DOMException('aborted', 'AbortError')));
    });
    const round = /^\/api\/rounds\/([^/]+)\/(\d+)$/.exec(url);
    if (method === 'GET' && round) {
      const found = past.get(`${round[1]}/${round[2]}`) ?? (current.session === round[1] && current.number === Number(round[2]) ? current : undefined);
      return found ? Response.json(asView(found)) : new Response('{}', { status: 404 });
    }
    const session = /^\/api\/sessions\/([^/]+)$/.exec(url);
    if (method === 'DELETE' && session) {
      history = { ...history, projects: history.projects.map(p => ({ ...p, sessions: p.sessions.filter(x => x.session !== session[1]) })).filter(p => p.sessions.length > 0) };
      wake();
      return new Response(null, { status: 204 });
    }
    if (method === 'PUT') return new Response(null, { status: 204 });
    return new Response('{}', { status: 404 });
  });
  function wake() { for (const done of polls) done(Response.json({ changed: true })); polls.clear(); }
  return {
    fetch: fetch as unknown as typeof window.fetch, requests,
    arrive: (next: RoundView, nextHistory: History) => { current = next; history = nextHistory; wake(); },
    change: (nextHistory: History) => { history = nextHistory; wake(); },
  };
}

const ONE: History = { projects: [{ cwd: '/work/alpha', sessions: [sessionOf(ALPHA, [{ number: 1, receivedAt: '2026-11-23T10:01:00.000Z', state: 'open' }])] }], update: null };
const TWO: History = {
  projects: [
    { cwd: '/work/beta', sessions: [sessionOf(BETA, [{ number: 1, receivedAt: '2026-11-23T10:09:00.000Z', state: 'open' }])] },
    ...ONE.projects,
  ],
  update: null,
};

const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', `/#t=${SECRET}`); setLanguage('en-GB'); });
afterEach(() => setLanguage('it-IT'));

const focused = () => within(screen.getByRole('article')).getByRole('heading', { level: 2 });

describe('a round from another session while the person writes (#102)', () => {
  it('stays on the round being written and says a new round arrived in the other project, which Open shows', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ current: roundOf(ALPHA, 1, 'Where do rounds live?'), history: ONE });
    render(<LocalPage fetch={server.fetch}/>);
    expect(await screen.findByRole('article')).toHaveTextContent('Where do rounds live?');
    await user.click(screen.getByRole('button', { name: 'Write a note' }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Half a th');
    server.arrive(roundOf(BETA, 1, 'Which page?'), TWO);
    const notice = await screen.findByRole('status', { name: 'New round in beta' });
    expect(notice).toHaveTextContent('New round in beta');
    expect(focused()).toHaveTextContent('Where do rounds live?');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Half a th');
    await user.click(within(notice).getByRole('button', { name: 'Open' }));
    expect(focused()).toHaveTextContent('Which page?');
    expect(screen.queryByRole('status', { name: /New round/ })).toBeNull();
  });

  it('shows the latest round at once when the person is not writing', async () => {
    const server = fakeServer({ current: roundOf(ALPHA, 1, 'Where do rounds live?'), history: ONE });
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    server.arrive(roundOf(BETA, 1, 'Which page?'), TWO);
    await waitFor(() => expect(focused()).toHaveTextContent('Which page?'));
    expect(screen.queryByRole('status', { name: /New round/ })).toBeNull();
  });
});

describe('the history column (#102)', () => {
  const ENDED: History = {
    projects: [
      { cwd: '/work/beta', sessions: [sessionOf(BETA, [{ number: 1, receivedAt: '2026-11-23T10:09:00.000Z', state: 'open' }])] },
      { cwd: '/work/alpha', sessions: [sessionOf(ALPHA, [
        { number: 1, receivedAt: '2026-11-23T10:01:00.000Z', state: 'superseded' },
        { number: 2, receivedAt: '2026-11-23T10:02:00.000Z', state: 'sent' },
      ], { live: false, skill: 'grill-with-docs', ticket: 102 })] },
    ],
    update: null,
  };
  const draft = { generalNote: 'Half way.', answers: { '1': { choice: 'recommendation' as const, note: 'Fine by me.' } } };

  it('lists project → session (live or ended, its skill and ticket) → numbered rounds with their state', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ current: roundOf(BETA, 1, 'Which page?'), history: ENDED }).fetch}/>);
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'History' }));
    const column = screen.getByRole('complementary', { name: 'History' });
    const projects = within(column).getAllByRole('region');
    expect(projects.map(x => x.getAttribute('aria-label'))).toEqual(['beta', 'alpha']);
    expect(within(projects[0]).getByText(/live/)).toBeInTheDocument();
    expect(within(projects[1]).getByText(/ended · #102 · grill-with-docs/)).toBeInTheDocument();
    expect(within(projects[1]).getAllByRole('button', { name: /^Round/ }).map(x => x.textContent)).toEqual(['Round 1 · superseded', 'Round 2 · sent']);
  });

  it('opens an earlier round read-only with its draft, and says when a newer round is elsewhere', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ current: roundOf(BETA, 1, 'Which page?'), history: ENDED, past: [roundOf(ALPHA, 1, 'Where do rounds live?', { draft, superseded: true })] });
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(screen.getByRole('button', { name: 'Round 1 · superseded' }));
    await waitFor(() => expect(focused()).toHaveTextContent('Where do rounds live?'));
    expect(screen.getByTestId('return-message')).toHaveTextContent('Half way.');
    expect(screen.getByTestId('return-message')).toHaveTextContent('Fine by me.');
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept the recommendation' })).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Questions' })).getByRole('button', { name: /Q1/ })).toHaveTextContent('recommendation');
    // Reading history is not left for a round that arrives meanwhile: the notice offers it.
    server.arrive(roundOf(BETA, 2, 'Which port?'), ENDED);
    expect(await screen.findByRole('status', { name: 'New round in beta' })).toBeInTheDocument();
    expect(focused()).toHaveTextContent('Where do rounds live?');
  });

  it('deletes a session only once the person confirms, and lists it no more', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ current: roundOf(BETA, 1, 'Which page?'), history: ENDED });
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'History' }));
    const alpha = within(screen.getByRole('complementary', { name: 'History' })).getByRole('region', { name: 'alpha' });
    await user.click(within(alpha).getByRole('button', { name: 'Delete session' }));
    expect(server.requests.filter(x => x.method === 'DELETE')).toEqual([]);
    await user.click(within(alpha).getByRole('button', { name: 'Keep it' }));
    await user.click(within(alpha).getByRole('button', { name: 'Delete session' }));
    await user.click(within(alpha).getByRole('button', { name: 'Delete it for good' }));
    expect(server.requests.filter(x => x.method === 'DELETE').map(x => x.url)).toEqual([`/api/sessions/${ALPHA}`]);
    await waitFor(() => expect(within(screen.getByRole('complementary', { name: 'History' })).queryByRole('region', { name: 'alpha' })).toBeNull());
  });

  it('says a newer version waits for the other sessions to end', async () => {
    const server = fakeServer({ current: roundOf(ALPHA, 1, 'Where do rounds live?'), history: ONE });
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    server.change({ ...ONE, update: '0.7.0' });
    expect(await screen.findByText('Break the Wall 0.7.0 is ready: the update comes once the other sessions end.')).toBeInTheDocument();
  });

  it('says all of it in Italian', async () => {
    setLanguage('it-IT');
    const user = userEvent.setup();
    const server = fakeServer({ current: roundOf(ALPHA, 1, 'Where do rounds live?'), history: { ...ENDED, update: '0.7.0' } });
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'Cronologia' }));
    const alpha = within(screen.getByRole('complementary', { name: 'Cronologia' })).getByRole('region', { name: 'alpha' });
    expect(within(alpha).getByText(/conclusa · #102 · grill-with-docs/)).toBeInTheDocument();
    expect(within(alpha).getAllByRole('button', { name: /^Round/ }).map(x => x.textContent)).toEqual(['Round 1 · superato', 'Round 2 · inviato']);
    expect(screen.getByText('Break the Wall 0.7.0 è pronto: l’aggiornamento arriva quando le altre sessioni finiscono.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Scrivi una nota' }));
    await user.type(screen.getByRole('textbox', { name: 'Nota' }), 'A metà');
    server.arrive(roundOf(BETA, 1, 'Which page?'), TWO);
    expect(await screen.findByRole('status', { name: 'Nuovo round in beta' })).toBeInTheDocument();
  });
});
