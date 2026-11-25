import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptExploration } from '../src/core/exploration-generation';
import type { Exploration } from '../src/core/exploration';
import type { RoundView } from '../src/core/round-answers';
import type { SpecView, UnreadableHandover } from '../src/core/spec';
import { importSource } from '../src/core/source';
import { LocalPage } from '../src/renderer/LocalPage';
import { BAKERY, bakery, toAnswer } from './explorations';

const SECRET = 'a'.repeat(43);
const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
const V1 = 'spec-0123456789abcdef-1', V2 = 'spec-0123456789abcdef-2';

async function explored(id: string, text = BAKERY): Promise<Exploration> {
  const source = await importSource({ kind: 'paste', title: 'The night bakery', text });
  return acceptExploration(JSON.stringify(toAnswer(await bakery())), { source, language: 'en', meta: { id, createdAt: '2026-11-24T10:00:00.000Z', provider: 'claude', model: 'sonnet' } });
}
const version = (fields: Partial<SpecView> = {}): SpecView => ({
  id: V1, location: 'docs/spec.md', title: 'The night bakery', number: 1, handedOverAt: '2026-11-24T10:00:00.000Z', session: SESSION,
  superseded: false, latest: V1, exploration: { id: 'x-one', revision: 'v1' }, run: null, ...fields,
});
const ROUND: RoundView = {
  session: SESSION, project: 'BreakTheWall', turnFolded: false, number: 1, receivedAt: '2026-11-24T09:00:00.000Z', turnText: 'One decision is open.',
  questions: [{ number: 1, title: 'Where do specs live?', body: 'In a file or an issue.', options: [], recommended: null, recommendation: 'In an issue.' }],
  draft: { generalNote: '', answers: {} }, sent: null, superseded: false,
};

/** The local server as the page sees it: the latest round, the specs handed over, their explorations, and a poll. */
function fakeServer(initial: { specs: SpecView[]; round?: RoundView; explorations: Exploration[]; unreadable?: UnreadableHandover[]; text?: string }) {
  let { specs } = initial;
  const unreadable = initial.unreadable ?? [];
  const requests: { method: string; url: string }[] = [];
  const polls = new Set<(reply: Response) => void>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    requests.push({ method, url });
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current') return Response.json({ current: initial.round ? { kind: 'round', round: initial.round, phaseOpen: false } : null });
    if (url === '/api/specs') return Response.json({ specs, unreadable });
    const one = /^\/api\/specs\/([^/]+)$/.exec(url);
    if (one) {
      const spec = specs.find(x => x.id === one[1]);
      return spec ? Response.json({ spec, text: initial.text ?? BAKERY }) : new Response('{}', { status: 404 });
    }
    const found = /^\/api\/explorations\/([^/]+)\/([^/]+)$/.exec(url);
    if (found) {
      const x = initial.explorations.find(y => y.id === found[1] && y.revision === found[2]);
      return x ? Response.json({ exploration: x }) : new Response('{}', { status: 404 });
    }
    const explore = /^\/api\/specs\/([^/]+)\/exploration$/.exec(url);
    if (explore && method === 'POST') { specs = specs.map(x => x.id === explore[1] ? { ...x, run: { state: 'running', repairing: false } } : x); wake(); return Response.json({}, { status: 202 }); }
    if (explore && method === 'DELETE') return new Response(null, { status: 204 });
    if (url === '/api/page/poll') return new Promise<Response>((done, fail) => {
      polls.add(done);
      init?.signal?.addEventListener('abort', () => fail(new DOMException('aborted', 'AbortError')));
    });
    return new Response('{}', { status: 404 });
  });
  function wake() { for (const done of polls) done(Response.json({ changed: true })); polls.clear(); }
  const changeSpecs = (next: SpecView[]) => act(() => { specs = next; wake(); });
  return { fetch: fetch as unknown as typeof window.fetch, requests, changeSpecs };
}

const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', `/#t=${SECRET}`); setLanguage('en-GB'); });
afterEach(() => { cleanup(); setLanguage('it-IT'); });
/** The exploration view is open (its "how it was read"), with the spec's title. */
async function title() {
  await screen.findByRole('button', { name: 'How it was read' });
  expect(within(document.querySelector<HTMLElement>('.xp-bar')!).getByRole('heading', { level: 1 })).toHaveTextContent('The night bakery');
}

describe('a handed-over spec opens in the page (#104)', () => {
  it('opens the spec handed over after the latest round as its exploration, read through the HTTP bridge', async () => {
    const server = fakeServer({ specs: [version()], round: ROUND, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await title();
    expect(screen.getByText('Version 1 · docs/spec.md')).toBeInTheDocument();
    expect(server.requests).toContainEqual({ method: 'GET', url: '/api/explorations/x-one/v1' });
    expect(screen.queryByText('open the new version')).toBeNull();
  });

  it('goes back to the round when the person leaves the spec', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], round: ROUND, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await title();
    expect(screen.queryByRole('button', { name: 'Back to your library' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close the spec' }));
    expect(await screen.findByRole('region', { name: 'The turn’s text' })).toHaveTextContent('One decision is open.');
  });

  it('holds a spec handed over while the person writes in the round, says so, and opens it on request', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [], round: ROUND, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    expect(await screen.findByRole('region', { name: 'The turn’s text' })).toHaveTextContent('One decision is open.');
    await user.click(screen.getByRole('button', { name: 'Write a note' }));
    const field = screen.getByRole('textbox', { name: 'Note' });
    await user.type(field, 'Half a tho');
    server.changeSpecs([version({ handedOverAt: '2026-11-24T10:00:00.000Z' })]);
    const notice = await screen.findByRole('status', { name: 'New spec in' });
    expect(screen.getByRole('region', { name: 'The turn’s text' })).toBeInTheDocument();
    expect(field).toHaveFocus();
    await user.click(within(notice).getByRole('button', { name: 'Open' }));
    await title();
  });

  it('keeps the round in front when the round came after the spec', async () => {
    const server = fakeServer({ specs: [version()], round: { ...ROUND, receivedAt: '2026-11-24T11:00:00.000Z' }, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    expect(await screen.findByRole('region', { name: 'The turn’s text' })).toHaveTextContent('One decision is open.');
    expect(screen.queryByRole('heading', { level: 1, name: 'The night bakery' })).toBeNull();
  });

  it('shows the structure being written, lets the person cancel it, and offers to write it again after a failure', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version({ exploration: null, run: { state: 'running', repairing: false } })], explorations: [] });
    render(<LocalPage fetch={server.fetch}/>);
    expect(await screen.findByText('Claude Code is writing the spec’s structure…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(server.requests).toContainEqual({ method: 'DELETE', url: `/api/specs/${V1}/exploration` });

    server.changeSpecs([version({ exploration: null, run: { state: 'failed', failure: { code: 'unavailable', reason: 'claude-failed' } } })]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Claude Code did not finish the request.');
    await user.click(screen.getByRole('button', { name: 'Write the structure again' }));
    expect(server.requests).toContainEqual({ method: 'POST', url: `/api/specs/${V1}/exploration` });
    expect(await screen.findByText('Claude Code is writing the spec’s structure…')).toBeInTheDocument();
  });
});

describe('the spec reads as numbered text while its structure is written (#128)', () => {
  /** The spec's text as the waiting page shows it: one numbered item per line. */
  const lines = async () => {
    const list = await screen.findByRole('list', { name: 'Lines of The night bakery' });
    return within(list).getAllByRole('listitem');
  };

  it('shows the spec as handed over, line by line with its numbers, beside the notice that the structure is being written', async () => {
    const server = fakeServer({ specs: [version({ exploration: null, run: { state: 'running', repairing: false } })], explorations: [] });
    render(<LocalPage fetch={server.fetch}/>);
    const items = await lines();
    expect(items).toHaveLength(BAKERY.split('\n').length);
    expect(items[0]).toHaveTextContent('1# The night bakery');
    expect(items[3]).toHaveTextContent(/^4.*loses water/);
    expect(screen.getByText('Claude Code is writing the spec’s structure…')).toBeInTheDocument();
    expect(server.requests).toContainEqual({ method: 'GET', url: `/api/specs/${V1}` });
  });

  it('keeps the text readable when the structure was not written, with the reason and the retry', async () => {
    const server = fakeServer({ specs: [version({ exploration: null, run: { state: 'failed', failure: { code: 'unavailable', reason: 'claude-failed' } } })], explorations: [] });
    render(<LocalPage fetch={server.fetch}/>);
    expect(await lines()).toHaveLength(BAKERY.split('\n').length);
    expect(screen.getByRole('alert')).toHaveTextContent('The spec’s structure was not written. Claude Code did not finish the request.');
    expect(screen.getByRole('button', { name: 'Write the structure again' })).toBeInTheDocument();
  });

  it('keeps the text readable when writing was cancelled, or the saved structure cannot be read', async () => {
    const cancelled = fakeServer({ specs: [version({ exploration: null, run: { state: 'failed', failure: { code: 'cancelled' } } })], explorations: [] });
    const { unmount } = render(<LocalPage fetch={cancelled.fetch}/>);
    expect(await lines()).toHaveLength(BAKERY.split('\n').length);
    expect(screen.getByRole('alert')).toHaveTextContent('Writing the structure was cancelled.');
    unmount();

    // The exploration is named but the server no longer has it.
    render(<LocalPage fetch={fakeServer({ specs: [version()], explorations: [] }).fetch}/>);
    expect(await lines()).toHaveLength(BAKERY.split('\n').length);
    expect(screen.getByRole('alert')).toHaveTextContent('The spec’s exploration could not be read.');
  });

  it('opens the exploration in place of the text once the structure is written', async () => {
    const server = fakeServer({ specs: [version({ exploration: null, run: { state: 'running', repairing: false } })], explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await lines();
    server.changeSpecs([version()]);
    await title();
    expect(screen.queryByText('Claude Code is writing the spec’s structure…')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Lines of The night bakery' })).toBeNull();
  });
});

describe('a handover that could not be read (#104)', () => {
  const unreadable = (location: string, why: UnreadableHandover['why']): UnreadableHandover => ({ location, session: SESSION, at: '2026-11-24T10:00:00.000Z', why });

  it('says which location could not be read and why, beside the round, until the person closes it', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [], round: ROUND, explorations: [], unreadable: [unreadable('../elsewhere/spec.md', 'outside')] });
    render(<LocalPage fetch={server.fetch}/>);
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('The spec at ../elsewhere/spec.md could not be read: the file is outside the session’s folder. No spec was handed over; the round phase does not end.');
    expect(screen.getByRole('region', { name: 'The turn’s text' })).toBeInTheDocument();
    await user.click(within(notice).getByRole('button', { name: 'Close notice' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says it in Italian too', async () => {
    setLanguage('it-IT');
    render(<LocalPage fetch={fakeServer({ specs: [], round: ROUND, explorations: [], unreadable: [unreadable('#7', 'gh-failed')] }).fetch}/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('La specifica in #7 non si è potuta leggere: gh non l’ha trovata o non ha risposto. Nessuna specifica è stata consegnata; la fase dei round non finisce.');
  });
});

describe('a superseded version (#104)', () => {
  it('stays readable when a new version arrives, says "superseded · open the new version", and opens it', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], explorations: [await explored('x-one'), await explored('x-two', BAKERY.replace('Loaf 2', 'Loaf 3'))] });
    render(<LocalPage fetch={server.fetch}/>);
    await title();

    server.changeSpecs([
      version({ id: V2, number: 2, latest: V2, handedOverAt: '2026-11-24T12:00:00.000Z', exploration: { id: 'x-two', revision: 'v1' } }),
      version({ superseded: true, latest: V2 }),
    ]);
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('superseded · open the new version');
    // The person keeps reading what they were reading.
    expect(screen.getByText('Version 1 · docs/spec.md')).toBeInTheDocument();

    await user.click(within(notice).getByRole('button', { name: 'open the new version' }));
    expect(await screen.findByText('Version 2 · docs/spec.md')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(server.requests).toContainEqual({ method: 'GET', url: '/api/explorations/x-two/v1' });
  });

  it('says it in Italian too', async () => {
    setLanguage('it-IT');
    const server = fakeServer({ specs: [version({ id: V2, number: 2, latest: V2 }), version({ superseded: true, latest: V2, handedOverAt: '2026-11-24T12:00:00.000Z' })], explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    expect((await screen.findByRole('button', { name: 'apri la nuova versione' })).closest('[role="status"]')).toHaveTextContent('superata · apri la nuova versione');
    expect(await screen.findByRole('button', { name: 'Chiudi la specifica' })).toBeInTheDocument();
  });
});
