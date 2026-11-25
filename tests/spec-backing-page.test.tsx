import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackingReport } from '../src/core/backing';
import { acceptExploration } from '../src/core/exploration-generation';
import type { Exploration } from '../src/core/exploration';
import type { SpecView } from '../src/core/spec';
import { importSource } from '../src/core/source';
import { LocalPage } from '../src/renderer/LocalPage';
import { BAKERY, bakery, toAnswer } from './explorations';

/**
 * The backing of a handed-over spec in the page (#106), against a fake HTTP bridge (seam ② of #92): unbacked and
 * broken statements flagged on their lines and counted per section, the cited answer beside its statement, a flag
 * turned into a remark in one action, and a spec that declares no backing left without flags.
 */
const SECRET = 'b'.repeat(43);
const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
const V1 = 'spec-0123456789abcdef-1';
const HANDED_OVER = '2026-11-24T10:00:00.000Z';

async function explored(): Promise<Exploration> {
  const source = await importSource({ kind: 'paste', title: 'The night bakery', text: BAKERY });
  return acceptExploration(JSON.stringify(toAnswer(await bakery())), { source, language: 'en', meta: { id: 'x-one', createdAt: HANDED_OVER, provider: 'claude', model: 'sonnet' } });
}
const version = (fields: Partial<SpecView> = {}): SpecView => ({
  id: V1, location: 'docs/spec.md', title: 'The night bakery', number: 1, handedOverAt: HANDED_OVER, session: SESSION,
  superseded: false, latest: V1, exploration: { id: 'x-one', revision: 'v1' }, run: null, ...fields,
});

/** BAKERY's statements as the server would check them, had the agent written their references. */
const CHECKED: BackingReport = {
  declared: true,
  statements: [
    { from: 4, to: 4, section: 3, quote: 'Bread left out loses water and the crumb hardens.', state: 'unbacked', references: [] },
    { from: 7, to: 8, section: 6, quote: 'Flour and water are mixed into a dough. The dough rests overnight in the cold room.', state: 'backed', references: [
      { kind: 'answer', written: '[R1·Q2]', found: true, answer: { session: SESSION, round: 1, question: 2, title: 'How long does the dough rest?', sent: true, choice: 'b', option: 'Overnight', note: 'In the cold room.' } },
    ] },
    { from: 11, to: 12, section: 10, quote: 'The rested dough is baked at dawn. The oven thermometer drifts by ten degrees.', state: 'broken', references: [
      { kind: 'answer', written: '[R4·Q1]', found: false },
    ] },
    { from: 15, to: 16, section: 14, quote: 'The baker sets the loaves on the counter. Customers pay at the till.', state: 'backed', references: [
      { kind: 'link', written: '#80', found: true, title: 'Spec intake' },
      { kind: 'answer', written: '[R1·Q3]', found: true, answer: { session: SESSION, round: 1, question: 3, title: 'Who keeps the till?', sent: true, choice: null, option: null, note: '' } },
    ] },
  ],
  sections: [
    { title: 'Why bread goes stale', line: 3, statements: 1, unbacked: 1, broken: 0 },
    { title: 'The dough', line: 6, statements: 1, unbacked: 0, broken: 0 },
    { title: 'The oven', line: 10, statements: 1, unbacked: 0, broken: 1 },
    { title: 'Selling', line: 14, statements: 1, unbacked: 0, broken: 0 },
  ],
};
const UNDECLARED: BackingReport = { declared: false, statements: [], sections: [] };

type Request = { method: string; url: string; body?: unknown };
/** The local server as the page sees it: one spec, its exploration, its backing and its remarks. */
function fakeServer(initial: { specs: SpecView[]; backing: BackingReport; exploration: Exploration; approvals?: unknown[] }) {
  let remarks = { draft: { generalNote: '', remarks: [] as unknown[] }, sent: [], approvals: initial.approvals ?? [], rides: null, transcriptGone: false };
  const requests: Request[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    requests.push({ method, url, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current') return Response.json({ current: null });
    if (url === '/api/history') return Response.json({ projects: [], update: null });
    if (url === '/api/specs') return Response.json({ specs: initial.specs });
    if (url === '/api/explorations/x-one/v1') return Response.json({ exploration: initial.exploration });
    if (url === `/api/specs/${V1}/backing`) return Response.json(initial.backing);
    if (url === `/api/specs/${V1}/remarks`) {
      if (method === 'GET') return Response.json(remarks);
      remarks = { ...remarks, draft: JSON.parse(String(init?.body)) };
      return new Response(null, { status: 204 });
    }
    if (url === '/api/page/poll') return new Promise<Response>((_, fail) => init?.signal?.addEventListener('abort', () => fail(new DOMException('aborted', 'AbortError'))));
    return new Response('{}', { status: 404 });
  });
  return { fetch: fetch as unknown as typeof window.fetch, requests, saved: () => requests.filter(x => x.method === 'PUT').at(-1)?.body };
}

const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', `/#t=${SECRET}`); setLanguage('en-GB'); });
afterEach(() => { cleanup(); setLanguage('it-IT'); });

/** The spec's source as the exploration shows it, once open. */
async function source() {
  await screen.findByRole('button', { name: /How it was read|Come è stata letta/ });
  return document.querySelector<HTMLElement>('.xp-source')!;
}
/** The flag on each block of the source that carries one, by the lines it spans. */
const flags = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('[data-backing]')].map(x => [`${x.dataset.from}-${x.dataset.to ?? x.dataset.from}`, x.dataset.backing]);
const panel = () => screen.getByRole('complementary', { name: 'Backing of the spec' });

describe('statements no decision stands behind are flagged (#106)', () => {
  it('marks unbacked and broken statements on their lines, and counts them in the bar and per section', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored() }).fetch}/>);
    const host = await source();
    await vi.waitFor(() => expect(flags(host)).toEqual([['4-4', 'unbacked'], ['11-12', 'broken']]));
    await user.click(screen.getByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    const sections = () => within(panel()).getAllByRole('region').map(x => within(x).getByRole('heading', { level: 3 }).textContent);
    // What needs fixing first: the sections with a flag, alone.
    expect(within(panel()).getByRole('button', { name: 'To fix · 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(sections()).toEqual(['Why bread goes stale · 1 unbacked', 'The oven · 1 broken']);
    await user.click(within(panel()).getByRole('button', { name: 'All · 4' }));
    expect(sections()).toEqual([
      'Why bread goes stale · 1 unbacked',
      'The dough · backed',
      'The oven · 1 broken',
      'Selling · backed',
    ]);
    // Broken backing is shown apart from unbacked, with the reference that was not found and why.
    const oven = within(panel()).getByRole('region', { name: /The oven/ });
    expect(oven).toHaveTextContent('Broken backing');
    expect(oven).toHaveTextContent(/\[R4·Q1\].*not found: no such round or question in this session/);
    const stale = within(panel()).getByRole('region', { name: /Why bread/ });
    expect(stale).toHaveTextContent('Unbacked');
    expect(stale).toHaveTextContent('Rests onNothing: the statement cites no answer, issue or file.');
  });

  it('shows the cited answer beside its statement, and the issue a link names', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored() }).fetch}/>);
    await source();
    await user.click(await screen.findByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    await user.click(within(panel()).getByRole('button', { name: 'All · 4' }));
    const dough = within(panel()).getByRole('region', { name: /The dough/ });
    expect(dough).toHaveTextContent('Flour and water are mixed into a dough. The dough rests overnight in the cold room.');
    expect(within(dough).getByRole('button', { name: 'Go to lines 7–8 in the source' })).toHaveTextContent('lines 7–8');
    // Folded, the answer is one line: the question and what the person chose.
    const answer = within(dough).getByRole('group', { name: 'Cited answer [R1·Q2]' });
    expect(answer).not.toHaveAttribute('open');
    expect(answer.querySelector('summary')).toHaveTextContent('[R1·Q2]How long does the dough rest?you chose (b)');
    // Unfolded, the agent's words and the person's note stand apart, each named.
    await user.click(answer.querySelector('summary')!);
    expect(answer).toHaveAttribute('open');
    expect(within(answer).getByText('The agent’s option (b)').nextElementSibling).toHaveTextContent('Overnight');
    expect(within(answer).getByText('Your note').nextElementSibling).toHaveTextContent('In the cold room.');
    const selling = within(panel()).getByRole('region', { name: /Selling/ });
    expect(selling).toHaveTextContent('#80Issue or PRSpec intake');
    // Sent with neither a choice nor a note: no choice, not "a note only".
    expect(within(selling).getByRole('note', { name: 'Cited answer [R1·Q3]' })).toHaveTextContent('[R1·Q3]Who keeps the till?you made no choice');
  });

  it('finds a statement in the source from the panel, and marks its lines there', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored() }).fetch}/>);
    const host = await source();
    await user.click(await screen.findByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    await user.click(within(panel()).getByRole('button', { name: 'Go to lines 11–12 in the source' }));
    const located = [...host.querySelectorAll<HTMLElement>('[data-located]')];
    expect(located.map(x => `${x.dataset.from}-${x.dataset.to ?? x.dataset.from}`)).toEqual(['11-12']);
    // Another statement moves the mark: one place at a time.
    await user.click(within(panel()).getByRole('button', { name: 'Go to line 4 in the source' }));
    expect([...host.querySelectorAll<HTMLElement>('[data-located]')].map(x => x.dataset.from)).toEqual(['4']);
  });

  it('marks every line of a statement in the numbered lines, not only its first', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored() }).fetch}/>);
    const host = await source();
    await user.click(screen.getByRole('button', { name: 'Lines' }));
    await user.click(await screen.findByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    await user.click(within(panel()).getByRole('button', { name: 'Go to lines 11–12 in the source' }));
    expect([...host.querySelectorAll<HTMLElement>('[data-located]')].map(x => x.dataset.from)).toEqual(['11', '12']);
  });

  it('opens the source column when it is folded, then marks the statement there', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored() }).fetch}/>);
    await source();
    await user.click(screen.getByRole('button', { name: 'Fold: Source' }));
    expect(document.querySelector('.xp-source')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    await user.click(within(panel()).getByRole('button', { name: 'Go to lines 11–12 in the source' }));
    await vi.waitFor(() => expect([...document.querySelectorAll<HTMLElement>('.xp-source [data-located]')].map(x => `${x.dataset.from}-${x.dataset.to}`)).toEqual(['11-12']));
  });

  it('says it in Italian too', async () => {
    setLanguage('it-IT');
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored() }).fetch}/>);
    await source();
    await user.click(await screen.findByRole('button', { name: /^Fondamento/ }));
    const aside = screen.getByRole('complementary', { name: 'Fondamento della specifica' });
    expect(within(aside).getByRole('button', { name: 'Da sistemare · 2' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(aside).getByRole('button', { name: 'Tutte · 4' }));
    const answer = within(aside).getByRole('group', { name: 'Risposta citata [R1·Q2]' });
    expect(answer.querySelector('summary')).toHaveTextContent('hai scelto (b)');
    expect(answer).toHaveTextContent('L’opzione (b) dell’agente');
    expect(answer).toHaveTextContent('La tua nota');
    expect(within(aside).getByRole('button', { name: 'Vai a righe 7–8 nella sorgente' })).toBeInTheDocument();
    expect(within(aside).getByRole('region', { name: /The oven/ })).toHaveTextContent('non trovato: questo round o questa domanda non esistono nella sessione');
  });
});

describe('one action turns a flag into a remark (#106)', () => {
  it('opens a remark on the flagged lines with the statement quoted, and saves it', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored() });
    render(<LocalPage fetch={server.fetch}/>);
    await source();
    await user.click(await screen.findByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    await user.click(within(panel()).getByRole('button', { name: 'Remark on lines 11–12' }));
    const remarks = screen.getByRole('complementary', { name: 'Remarks on the spec' });
    const field = within(remarks).getByRole('textbox', { name: 'Remark on lines 11–12 «The rested dough is baked at dawn. The oven thermometer drifts by ten degrees.»' });
    expect(field).toHaveFocus();
    await user.type(field, 'Which round decided this?');
    await vi.waitFor(() => expect(server.saved()).toEqual({ generalNote: '', remarks: [
      { version: 1, from: 11, to: 12, passage: 'The rested dough is baked at dawn. The oven thermometer drifts by ten degrees.', text: 'Which round decided this?' },
    ] }));
  });

  it('offers no remark on a superseded version, which takes none', async () => {
    const user = userEvent.setup();
    const specs = [version({ superseded: true, latest: 'spec-0123456789abcdef-2' })];
    render(<LocalPage fetch={fakeServer({ specs, backing: CHECKED, exploration: await explored() }).fetch}/>);
    await source();
    await user.click(await screen.findByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    expect(within(panel()).queryByRole('button', { name: /^Remark on/ })).toBeNull();
  });

  it('offers no remark on an approved version, which takes none (#132)', async () => {
    const user = userEvent.setup();
    const approvals = [{ version: 1, at: '2026-11-24T11:30:00.000Z', session: SESSION, queued: false, unbacked: 1, broken: 1 }];
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: CHECKED, exploration: await explored(), approvals }).fetch}/>);
    await source();
    await user.click(await screen.findByRole('button', { name: 'Backing · 1 unbacked · 1 broken' }));
    // The approval arrives with the remarks, read beside the backing.
    await vi.waitFor(() => expect(within(panel()).queryByRole('button', { name: /^Remark on/ })).toBeNull());
  });
});

describe('a spec that declares no backing (#106)', () => {
  it('shows no flag, only "this spec declares no backing" in "how it was read"', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], backing: UNDECLARED, exploration: await explored() });
    render(<LocalPage fetch={server.fetch}/>);
    const host = await source();
    await vi.waitFor(() => expect(server.requests.some(x => x.url.endsWith('/backing'))).toBe(true));
    expect(flags(host)).toEqual([]);
    expect(screen.queryByRole('button', { name: /^Backing/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'How it was read' }));
    expect(screen.getByRole('region', { name: 'How it was read' })).toHaveTextContent('This spec declares no backing');
  });

  it('says it in Italian too', async () => {
    setLanguage('it-IT');
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ specs: [version()], backing: UNDECLARED, exploration: await explored() }).fetch}/>);
    await source();
    await user.click(screen.getByRole('button', { name: 'Come è stata letta' }));
    expect(await screen.findByText('Questa specifica non dichiara alcun fondamento')).toBeInTheDocument();
  });
});
