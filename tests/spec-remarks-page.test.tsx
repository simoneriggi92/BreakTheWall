import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptExploration } from '../src/core/exploration-generation';
import type { Exploration } from '../src/core/exploration';
import type { RoundView } from '../src/core/round-answers';
import type { SpecView } from '../src/core/spec';
import type { SpecRemarksSection, SpecRemarksView } from '../src/core/spec-remarks';
import { importSource } from '../src/core/source';
import { LocalPage } from '../src/renderer/LocalPage';
import { BAKERY, bakery, toAnswer } from './explorations';

/**
 * Remarks on a handed-over spec in the page (#105), against a fake HTTP bridge (seam ② of #92): a passage selected in
 * the source takes a remark or a "(missing here)", "what the agent receives" follows live, one Send returns them, and
 * what was sent stays read-only.
 */
const SECRET = 'a'.repeat(43);
const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
const V1 = 'spec-0123456789abcdef-1', V2 = 'spec-0123456789abcdef-2';
const HANDED_OVER = '2026-11-24T10:00:00.000Z';

async function explored(id: string): Promise<Exploration> {
  const source = await importSource({ kind: 'paste', title: 'The night bakery', text: BAKERY });
  return acceptExploration(JSON.stringify(toAnswer(await bakery())), { source, language: 'en', meta: { id, createdAt: HANDED_OVER, provider: 'claude', model: 'sonnet' } });
}
const version = (fields: Partial<SpecView> = {}): SpecView => ({
  id: V1, location: 'docs/spec.md', title: 'The night bakery', number: 1, handedOverAt: HANDED_OVER, session: SESSION,
  superseded: false, latest: V1, exploration: { id: 'x-one', revision: 'v1' }, run: null, ...fields,
});
const noRemarks = (): SpecRemarksView => ({ draft: { generalNote: '', remarks: [] }, sent: [], rides: null, transcriptGone: false });

type Request = { method: string; url: string; body?: unknown };
/** The local server as the page sees it: the specs, their explorations and remarks, the latest round, and a poll. */
function fakeServer(initial: { specs: SpecView[]; remarks?: SpecRemarksView; round?: RoundView; riding?: SpecRemarksSection[]; explorations: Exploration[]; sendReply?: () => Response; holdSaves?: boolean }) {
  let remarks = initial.remarks ?? noRemarks();
  const requests: Request[] = [];
  /** Saves held as a slow network would hold them, until the test lets them land. */
  const heldSaves: (() => void)[] = [];
  const polls = new Set<(reply: Response) => void>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    requests.push({ method, url, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current') return Response.json({ current: initial.round ? { kind: 'round', round: initial.round, phaseOpen: false, riding: initial.riding ?? [] } : null });
    if (url === '/api/history') return Response.json({ projects: [], update: null });
    if (url === '/api/specs') return Response.json({ specs: initial.specs });
    const found = /^\/api\/explorations\/([^/]+)\/([^/]+)$/.exec(url);
    if (found) {
      const x = initial.explorations.find(y => y.id === found[1] && y.revision === found[2]);
      return x ? Response.json({ exploration: x }) : new Response('{}', { status: 404 });
    }
    if (/^\/api\/specs\/[^/]+\/remarks$/.test(url)) {
      if (method === 'GET') return Response.json(remarks);
      if (initial.holdSaves) await new Promise<void>(land => heldSaves.push(land));
      remarks = { ...remarks, draft: JSON.parse(String(init?.body)) };
      return new Response(null, { status: 204 });
    }
    if (/^\/api\/specs\/[^/]+\/remarks\/send$/.test(url)) {
      if (initial.sendReply) return initial.sendReply();
      const { draft } = JSON.parse(String(init?.body));
      remarks = { ...remarks, draft: { generalNote: '', remarks: [] }, sent: [{ at: '2026-11-24T11:00:00.000Z', generalNote: draft.generalNote, remarks: draft.remarks, round: null, session: SESSION, queued: false }] };
      return Response.json({ message: 'as sent' });
    }
    if (url === '/api/page/poll') return new Promise<Response>((done, fail) => {
      polls.add(done);
      init?.signal?.addEventListener('abort', () => fail(new DOMException('aborted', 'AbortError')));
    });
    return new Response('{}', { status: 404 });
  });
  const landSaves = () => { for (const land of heldSaves.splice(0)) land(); };
  return { fetch: fetch as unknown as typeof window.fetch, requests, landSaves, saved: () => requests.filter(x => x.method === 'PUT').at(-1)?.body };
}

const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', `/#t=${SECRET}`); setLanguage('en-GB'); });
afterEach(() => { cleanup(); setLanguage('it-IT'); document.getSelection()?.removeAllRanges(); });

/** The spec's source as the exploration shows it, once open. */
async function source() {
  await screen.findByRole('button', { name: /How it was read|Come è stata letta/ });
  return document.querySelector<HTMLElement>('.xp-source')!;
}
/** Selects `text` where it first stands inside `host`, as a drag of the mouse would, and lets go of the button there. */
function selectText(host: HTMLElement, text: string) {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = (node as Text).data.indexOf(text);
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + text.length);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.mouseUp(node.parentElement!);
    return;
  }
  throw new Error(`"${text}" is not in the element`);
}
const panel = () => screen.getByRole('complementary', { name: 'Remarks on the spec' });
const receives = () => within(panel()).getByTestId('spec-remarks-message').textContent;

describe('remarks anchor to quoted passages of the spec (#105)', () => {
  it('offers "Remark" on a passage selected in the source, anchors it by its lines, and saves what the person writes', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    selectText(await source(), 'loses water');
    await user.click(screen.getByRole('button', { name: 'Remark' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Remark on line 4 «loses water»' }), 'Why?');
    await vi.waitFor(() => expect(server.saved()).toEqual({ generalNote: '', remarks: [{ version: 1, from: 4, to: 4, passage: 'loses water', text: 'Why?' }] }));
    expect(receives()).toBe([
      'Remarks on the spec «The night bakery» (docs/spec.md), version handed over on ' + minute(HANDED_OVER) + '. Don\'t edit it yet: ask me what you need, in a round. When you revise the spec, end with the line `Spec: docs/spec.md` and keep each statement\'s backing.',
      '',
      '- line 4 «loses water» — Why?',
    ].join('\n'));
  });

  it('anchors a gap with "(missing here)" on the lines of the selection', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    selectText(await source(), 'thermometer drifts');
    await user.click(screen.getByRole('button', { name: 'Missing here' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Remark on lines 11–12 (missing here)' }), 'Who checks it?');
    await vi.waitFor(() => expect(server.saved()).toEqual({ generalNote: '', remarks: [{ version: 1, from: 11, to: 12, missing: true, text: 'Who checks it?' }] }));
    expect(receives()).toContain('- lines 11–12 (missing here) — Who checks it?');
  });

  it('offers nothing on a selection outside the source', async () => {
    const server = fakeServer({ specs: [version()], explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await source();
    selectText(document.querySelector<HTMLElement>('.xp-bar')!, 'The night bakery');
    expect(screen.queryByRole('button', { name: 'Missing here' })).toBeNull();
  });

  it('says it in Italian too', async () => {
    setLanguage('it-IT');
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    selectText(await source(), 'loses water');
    await user.click(screen.getByRole('button', { name: 'Manca qui' }));
    const aside = screen.getByRole('complementary', { name: 'Osservazioni sulla specifica' });
    await user.type(within(aside).getByRole('textbox', { name: 'Osservazione su riga 4 (manca qui)' }), 'Il sale?');
    expect(within(aside).getByTestId('spec-remarks-message')).toHaveTextContent(/^Osservazioni sulla specifica «The night bakery».*- riga 4 \(manca qui\) — Il sale\?$/);
  });
});

describe('one Send returns every remark so far (#105)', () => {
  it('sends the draft with the page\'s language, and shows what was sent read-only', async () => {
    const user = userEvent.setup();
    const draft = { generalNote: '', remarks: [{ version: 1, from: 4, to: 4, passage: 'loses water', text: 'Why?' }] };
    const server = fakeServer({ specs: [version()], remarks: { ...noRemarks(), draft }, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await source();
    await user.click(screen.getByRole('button', { name: 'Remarks · 1' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'General note' }), 'Thin.');
    await user.click(within(panel()).getByRole('button', { name: 'Send' }));
    expect(server.requests.find(x => x.method === 'POST')).toEqual({ method: 'POST', url: `/api/specs/${V1}/remarks/send`, body: { draft: { ...draft, generalNote: 'Thin.' }, language: 'en' } });
    expect(await within(panel()).findByText('Sent. The agent receives exactly this message.')).toBeInTheDocument();
    const sent = within(panel()).getByRole('region', { name: 'Already sent' });
    expect(sent).toHaveTextContent('Sent on their own');
    expect(sent).toHaveTextContent('line 4 «loses water»');
    expect(sent).toHaveTextContent('Why?');
    expect(within(sent).queryByRole('textbox')).toBeNull();
    expect(within(panel()).queryByRole('textbox', { name: 'Remark on line 4 «loses water»' })).toBeNull();
  });

  it('lets a save still on its way land before Send, and saves nothing after it', async () => {
    const user = userEvent.setup();
    const draft = { generalNote: '', remarks: [{ version: 1, from: 4, to: 4, passage: 'loses water', text: 'Why?' }] };
    const server = fakeServer({ specs: [version()], remarks: { ...noRemarks(), draft }, explorations: [await explored('x-one')], holdSaves: true });
    render(<LocalPage fetch={server.fetch}/>);
    await source();
    await user.click(screen.getByRole('button', { name: 'Remarks · 1' }));
    // The first letter's save is on its way; the later ones wait behind it.
    await user.type(within(panel()).getByRole('textbox', { name: 'General note' }), 'Thin.');
    await user.click(within(panel()).getByRole('button', { name: 'Send' }));
    expect(server.requests.some(x => x.method === 'POST')).toBe(false);
    server.landSaves();
    expect(await within(panel()).findByText('Sent. The agent receives exactly this message.')).toBeInTheDocument();
    server.landSaves();
    await new Promise(done => setTimeout(done, 20));
    const writes = server.requests.filter(x => x.method !== 'GET').map(x => x.method);
    expect(writes.at(-1)).toBe('POST');
    expect(server.requests.find(x => x.method === 'POST')?.body).toEqual({ draft: { ...draft, generalNote: 'Thin.' }, language: 'en' });
  });

  it('shows remarks sent to an ended session as queued, with the command that resumes it', async () => {
    const user = userEvent.setup();
    const sent = [{ at: '2026-11-24T11:00:00.000Z', generalNote: '', remarks: [{ version: 1, from: 4, to: 4, passage: 'loses water', text: 'Why?' }], round: 2, session: SESSION, queued: true }];
    const server = fakeServer({ specs: [version()], remarks: { ...noRemarks(), sent }, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await source();
    await user.click(screen.getByRole('button', { name: 'Remarks' }));
    const region = within(panel()).getByRole('region', { name: 'Already sent' });
    expect(region).toHaveTextContent('Sent with the answers to round 2');
    expect(within(region).getByRole('status')).toHaveTextContent(`claude --resume ${SESSION}`);
  });

  it('gives way to the round that awaits answers: no Send, the remarks ride in its message', async () => {
    const user = userEvent.setup();
    const draft = { generalNote: '', remarks: [{ version: 1, from: 4, to: 4, passage: 'loses water', text: 'Why?' }] };
    const server = fakeServer({ specs: [version()], remarks: { ...noRemarks(), draft, rides: 3 }, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await source();
    await user.click(screen.getByRole('button', { name: 'Remarks · 1' }));
    expect(within(panel()).getByText('Round 3 awaits your answers: these remarks ride in its message, after the answers.')).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: 'Send' })).toBeNull();
  });
});

describe('remarks on a superseded version (#105)', () => {
  it('takes no new remark on it, and lists the unsent ones grouped by version', async () => {
    const user = userEvent.setup();
    const draft = { generalNote: '', remarks: [
      { version: 1, from: 12, to: 12, passage: 'drifts', text: 'Still true?' },
      { version: 2, from: 19, to: 19, passage: 'Loaf', text: 'Dearer?' },
    ] };
    const specs = [version({ id: V2, number: 2, latest: V2, location: './docs/spec.md', handedOverAt: '2026-11-24T09:00:00.000Z' }), version({ superseded: true, latest: V2 })];
    const server = fakeServer({ specs, remarks: { ...noRemarks(), draft }, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    // The newest handover opens: here, version 1 was handed over last only on the clock, so open it by hand.
    await source();
    expect(screen.getByText('Version 1 · docs/spec.md')).toBeInTheDocument();
    selectText(document.querySelector<HTMLElement>('.xp-source')!, 'loses water');
    expect(screen.queryByRole('button', { name: 'Remark' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remarks · 2' }));
    expect(within(panel()).getByText(/This version is superseded: it takes no new remarks/)).toBeInTheDocument();
    const groups = within(panel()).getAllByRole('group').map(x => [within(x).getByRole('heading').textContent, within(x).getAllByRole('textbox').map(y => y.getAttribute('aria-label'))]);
    expect(groups).toEqual([
      ['Version 1 · docs/spec.md', ['Remark on line 12 «drifts»']],
      ['Version 2 · ./docs/spec.md', ['Remark on line 19 «Loaf»']],
    ]);
  });
});

const ROUND: RoundView = {
  session: SESSION, number: 3, receivedAt: '2026-11-24T12:00:00.000Z', turnText: '',
  questions: [{ number: 1, title: 'Where does the opening time live?', body: 'In the spec or the till.', options: [], recommended: null, recommendation: 'In the spec.' }],
  draft: { generalNote: '', answers: {} }, sent: null, superseded: false,
};

describe('remarks ride in the round that awaits answers (#105)', () => {
  it('shows them after the answers under "what the agent receives"', async () => {
    const riding: SpecRemarksSection[] = [{ title: 'The night bakery', location: 'docs/spec.md', versions: [{ number: 1, location: 'docs/spec.md', handedOverAt: HANDED_OVER }], draft: { generalNote: '', remarks: [{ version: 1, from: 4, to: 4, passage: 'loses water', text: 'Why?' }] } }];
    const server = fakeServer({ specs: [version()], round: ROUND, riding, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    const message = await screen.findByTestId('return-message');
    expect(message.textContent).toMatch(/^\*\*Q1 · Where does the opening time live\?\*\* no answer\n\nRemarks on the spec «The night bakery» \(docs\/spec\.md\).*\n\n- line 4 «loses water» — Why\?$/s);
  });

  it('opens the spec again from the round, to write remarks while the round waits', async () => {
    const user = userEvent.setup();
    const server = fakeServer({ specs: [version()], round: ROUND, explorations: [await explored('x-one')] });
    render(<LocalPage fetch={server.fetch}/>);
    await user.click(await screen.findByRole('button', { name: 'Spec · The night bakery' }));
    selectText(await source(), 'loses water');
    expect(screen.getByRole('button', { name: 'Remark' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to your library' }));
    expect(await screen.findByTestId('return-message')).toBeInTheDocument();
  });
});

/** The handover time as the message words it, on this machine's clock. */
function minute(iso: string) {
  const d = new Date(iso), two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
