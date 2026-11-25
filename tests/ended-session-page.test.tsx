import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundView } from '../src/core/round-answers';
import type { FreeBlockView } from '../src/core/round-phase';
import type { History } from '../src/core/session-history';
import { LocalPage } from '../src/renderer/LocalPage';

vi.mock('../src/renderer/diagrams', () => ({ renderDiagram: vi.fn(async () => '<svg role="img"></svg>') }));

const SECRET = 'a'.repeat(43);
const SESSION = 'c0ffee00-0000-4000-8000-000000000001';
const RESUME = `claude --resume ${SESSION}`;

const ROUND: RoundView = {
  session: SESSION, project: 'BreakTheWall', turnFolded: false,
  number: 1,
  receivedAt: '2026-11-24T10:00:00.000Z',
  turnText: '',
  questions: [{ number: 1, title: 'Where do rounds live?', body: 'The server keeps every round.', options: [], recommended: null, recommendation: 'In the data folder.' }],
  draft: { generalNote: '', answers: { '1': { choice: 'recommendation', note: '' } } },
  sent: null,
  superseded: false,
};
const SENT: RoundView = { ...ROUND, sent: { message: '**Q1 · Where do rounds live?** recommendation', at: '2026-11-24T10:05:00.000Z' } };
const FREE: FreeBlockView = {
  session: SESSION, project: 'BreakTheWall', turnFolded: false, number: 1, receivedAt: '2026-11-24T10:06:00.000Z', text: 'Which folder did you mean?', response: 'The plugin folder.',
  sent: { message: 'The plugin folder.', at: '2026-11-24T10:07:00.000Z' }, superseded: false,
};

type Standing = { queued?: boolean; transcriptGone?: boolean };
const HISTORY: History = {
  projects: [{ cwd: '/work/alpha', sessions: [{
    session: SESSION, startedAt: '2026-11-24T10:00:00.000Z', live: false, skill: null, ticket: null, transcriptGone: true,
    rounds: [{ number: 1, receivedAt: '2026-11-24T10:00:00.000Z', state: 'queued' }],
  }] }],
  update: null,
};

/** The local server as the page sees it: one round or free block of an ended session, where it stands, and its side chats. */
function fakeServer(shown: { round: RoundView } | { block: FreeBlockView }, standing: Standing = {}) {
  const current = 'round' in shown ? { kind: 'round', round: shown.round, phaseOpen: false, ...standing } : { kind: 'free', block: shown.block, phaseOpen: false, ...standing };
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current') return Response.json({ current });
    if (url === '/api/history') return Response.json(HISTORY);
    if (url === '/api/specs') return Response.json({ specs: [] });
    if (url === '/api/page/poll') return new Promise<Response>(() => {});
    if (method === 'GET' && url.startsWith(`/api/side-chats/${SESSION}/1`)) {
      if (url.includes('?after=')) return new Promise<Response>(() => {});
      return Response.json({ version: 1, sideChats: [{ question: 1, turns: [{ number: 1, ask: 'Why there?', reply: 'Because it outlives the plugin.', files: [], status: 'done', route: 'fork', at: '2026-11-24T10:01:00.000Z' }] }] });
    }
    if (method === 'PUT') return new Response(null, { status: 204 });
    return new Response('{}', { status: 404 });
  }) as unknown as typeof window.fetch;
}

const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', `/#t=${SECRET}`); setLanguage('en-GB'); });
afterEach(() => setLanguage('it-IT'));

const receives = () => screen.getByRole('region', { name: 'What the agent receives' });

describe('a round of an ended session (#103)', () => {
  it('shows answers sent to an ended session as queued, with the claude --resume command to copy', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ round: SENT }, { queued: true })}/>);
    const queued = await within(await screen.findByRole('region', { name: 'What the agent receives' })).findByRole('status');
    expect(queued).toHaveTextContent('Queued: it reaches the agent when you resume the session with');
    expect(within(queued).getByText(RESUME).tagName).toBe('CODE');
    await user.click(within(queued).getByRole('button', { name: 'Copy the command' }));
    expect(await navigator.clipboard.readText()).toBe(RESUME);
    expect(within(queued).getByText('Copied.')).toBeInTheDocument();
  });

  it('says only "sent" once the session took the answers', async () => {
    render(<LocalPage fetch={fakeServer({ round: SENT })}/>);
    expect(await within(await screen.findByRole('region', { name: 'What the agent receives' })).findByRole('status')).toHaveTextContent(/^Sent\./);
    expect(screen.queryByText(RESUME)).toBeNull();
  });

  it('copies a round as Markdown, open or sent: the message exactly as the agent receives it', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<LocalPage fetch={fakeServer({ round: ROUND })}/>);
    await screen.findByRole('article');
    await user.click(within(receives()).getByRole('button', { name: 'Copy as Markdown' }));
    expect(await navigator.clipboard.readText()).toBe('**Q1 · Where do rounds live?** recommendation');
    unmount();

    render(<LocalPage fetch={fakeServer({ round: { ...SENT, sent: { message: 'As delivered.', at: SENT.sent!.at } } }, { queued: true })}/>);
    await screen.findByRole('article');
    await user.click(within(receives()).getByRole('button', { name: 'Copy as Markdown' }));
    expect(await navigator.clipboard.readText()).toBe('As delivered.');
  });

  it('shows a response queued for an ended session with the same command', async () => {
    render(<LocalPage fetch={fakeServer({ block: FREE }, { queued: true })}/>);
    expect(await screen.findByText(RESUME)).toBeInTheDocument();
  });

  it('says it in Italian too', async () => {
    setLanguage('it-IT');
    render(<LocalPage fetch={fakeServer({ round: SENT }, { queued: true })}/>);
    expect(await screen.findByText(/In coda: arriva all’agente quando riprendi la sessione con/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copia come Markdown' })).toBeInTheDocument();
  });
});

describe('a session whose transcript Claude Code no longer keeps (#103)', () => {
  it('shows its round read-only, still readable and copyable, and its side chats without a field to ask', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ round: ROUND }, { transcriptGone: true })}/>);
    await screen.findByRole('article');
    expect(within(receives()).getByRole('note')).toHaveTextContent('Claude Code no longer keeps this session’s conversation');
    expect(within(receives()).queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept the recommendation' })).toBeNull();
    expect(within(receives()).getByRole('button', { name: 'Copy as Markdown' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ask about this question' }));
    const chat = await screen.findByRole('region', { name: 'Side chat · Q1' });
    expect(await within(chat).findByText('Because it outlives the plugin.')).toBeInTheDocument();
    expect(within(chat).queryByRole('textbox')).toBeNull();
    expect(chat).toHaveTextContent('the side chat can be read, not continued');
  });

  it('names the queued round and the read-only session in the history column', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer({ round: SENT }, { queued: true, transcriptGone: true })}/>);
    await user.click(await screen.findByRole('button', { name: 'History' }));
    const column = screen.getByRole('complementary', { name: 'History' });
    expect(within(column).getByRole('button', { name: 'Round 1 · queued' })).toBeInTheDocument();
    expect(column).toHaveTextContent('ended · read-only');
  });
});
