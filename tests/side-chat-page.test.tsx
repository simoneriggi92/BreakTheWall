import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundView } from '../src/core/round-answers';
import type { SideChat, SideChatTurn } from '../src/core/side-chat';
import { LocalPage } from '../src/renderer/LocalPage';

vi.mock('../src/renderer/diagrams', () => ({ renderDiagram: vi.fn(async () => '<svg role="img"></svg>') }));

const SECRET = 'a'.repeat(43);
const SESSION = 'c0ffee00-0000-4000-8000-000000000001';

const ROUND: RoundView = {
  session: SESSION,
  number: 1,
  receivedAt: '2026-11-24T10:00:00.000Z',
  turnText: '',
  questions: [
    { number: 1, title: 'Where do side chats live?', body: 'Beside the rounds, or in their own folder.', options: [], recommended: null, recommendation: 'Beside the rounds.' },
    { number: 2, title: 'Who runs the fork?', body: 'The server or the mod.', options: [], recommended: null, recommendation: 'The server.' },
  ],
  draft: { generalNote: '', answers: {} },
  sent: null,
  superseded: false,
};

/**
 * The local server as the page sees it, with side chats: an ask starts a turn that the test then streams into, and
 * the page's held read of the side chats answers as soon as they change.
 */
function fakeServer(initial: SideChat[] = []) {
  let chats = initial;
  let version = 1;
  const asked: { question: number; ask: string }[] = [];
  const waiting = new Set<() => void>();
  const view = () => Response.json({ version, sideChats: chats });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current') return Response.json({ current: { kind: 'round', round: ROUND, phaseOpen: true } });
    if (url === '/api/page/poll') return new Promise<Response>(() => {});
    if (method === 'PUT') return new Response(null, { status: 204 });
    const read = /^\/api\/side-chats\/([^/]+)\/1(?:\?after=(\d+))?$/.exec(url);
    if (method === 'GET' && read) {
      if (read[2] === undefined || Number(read[2]) < version) return view();
      return new Promise<Response>((done, fail) => {
        const wake = () => { waiting.delete(wake); done(view()); };
        waiting.add(wake);
        init?.signal?.addEventListener('abort', () => { waiting.delete(wake); fail(new DOMException('aborted', 'AbortError')); });
      });
    }
    const ask = /^\/api\/side-chats\/([^/]+)\/1\/(\d+)$/.exec(url);
    if (method === 'POST' && ask) {
      const question = Number(ask[2]);
      const text = JSON.parse(String(init?.body)).ask as string;
      asked.push({ question, ask: text });
      const thread = chats.find(x => x.question === question) ?? { question, turns: [] };
      const turn: SideChatTurn = { number: thread.turns.length + 1, ask: text, reply: '', files: [], status: 'running', route: 'fork', at: '2026-11-24T10:01:00.000Z' };
      change(question, [...thread.turns, turn]);
      return Response.json({ turn: turn.number }, { status: 202 });
    }
    return new Response('{}', { status: 404 });
  });
  function change(question: number, turns: SideChatTurn[]) {
    chats = [...chats.filter(x => x.question !== question), { question, turns }].sort((a, b) => a.question - b.question);
    version++;
    for (const wake of [...waiting]) wake();
  }
  /** The fork's reply growing, or finished. */
  const stream = (question: number, patch: Partial<SideChatTurn>) => act(() => {
    const turns = chats.find(x => x.question === question)!.turns;
    change(question, turns.map((t, i) => i === turns.length - 1 ? { ...t, ...patch } : t));
  });
  return { fetch: fetch as unknown as typeof window.fetch, asked, stream };
}

const turn = (more: Partial<SideChatTurn>): SideChatTurn => ({ number: 1, ask: 'Why?', reply: 'Because.', files: [], status: 'done', route: 'fork', at: '2026-11-24T09:00:00.000Z', ...more });

const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', `/#t=${SECRET}`); setLanguage('en-GB'); });
afterEach(() => { cleanup(); setLanguage('it-IT'); });

const outline = () => screen.getByRole('navigation', { name: 'Questions' });
const chat = () => screen.getByRole('region', { name: /^Side chat · Q/ });

describe('a side chat on the focused question (#100)', () => {
  it('opens in the right column beside the whole question, marks the question, and folds the return to a strip', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer().fetch}/>);
    const question = await screen.findByRole('article');
    expect(screen.queryByRole('region', { name: /^Side chat/ })).toBeNull();
    expect(screen.getByRole('region', { name: 'What the agent receives' })).toBeVisible();

    await user.click(within(question).getByRole('button', { name: 'Ask about this question' }));
    expect(chat()).toHaveAccessibleName('Side chat · Q1');
    expect(question).toHaveTextContent('Beside the rounds, or in their own folder.');
    expect(question).toHaveClass('is-chatting');
    // The return stays one click away, folded.
    const strip = screen.getByRole('group', { name: 'What the agent receives' });
    expect(strip.tagName).toBe('DETAILS');
    expect(strip).not.toHaveAttribute('open');
    expect(within(strip).getByTestId('return-message')).toHaveTextContent('Q1 · Where do side chats live?');

    await user.click(within(chat()).getByRole('button', { name: 'Close the side chat' }));
    expect(screen.queryByRole('region', { name: /^Side chat/ })).toBeNull();
    expect(question).not.toHaveClass('is-chatting');
    expect(screen.getByRole('region', { name: 'What the agent receives' })).toBeInTheDocument();
  });

  it('sends what the person asks and streams the reply with the files it read listed under it', async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    await user.click(await screen.findByRole('button', { name: 'Ask about this question' }));
    await user.type(within(chat()).getByRole('textbox', { name: 'Ask in the side chat' }), 'Why not their own folder?');
    await user.click(within(chat()).getByRole('button', { name: 'Ask' }));
    expect(server.asked).toEqual([{ question: 1, ask: 'Why not their own folder?' }]);
    expect(await within(chat()).findByText('Why not their own folder?')).toBeInTheDocument();
    expect(within(chat()).getByRole('textbox', { name: 'Ask in the side chat' })).toHaveValue('');
    // While the reply runs, the thread takes no second question.
    expect(within(chat()).getByRole('button', { name: 'Ask' })).toBeDisabled();

    server.stream(1, { reply: 'Deleting a session ', files: ['src/server/rounds.ts'] });
    expect(await within(chat()).findByText(/Deleting a session/)).toBeInTheDocument();
    server.stream(1, { reply: 'Deleting a session deletes its side chats.', files: ['src/server/rounds.ts', 'grep "sessionDir" in src'], status: 'done' });
    expect(await within(chat()).findByText('Deleting a session deletes its side chats.')).toBeInTheDocument();
    const read = within(chat()).getByRole('list', { name: 'What the reply read' });
    expect(within(read).getAllByRole('listitem').map(x => x.textContent)).toEqual(['src/server/rounds.ts', 'grep "sessionDir" in src']);
    expect(within(chat()).getByRole('button', { name: 'Ask' })).toBeEnabled();
  });

  it('follows the focus: each question shows its own thread, and the outline marks questions with one', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer([{ question: 2, turns: [turn({ ask: 'Why the server?', reply: 'Tests reach it.' }), turn({ number: 2, ask: 'And the mod?', reply: 'It stays thin.' })] }]).fetch}/>);
    await screen.findByRole('article');
    const second = await within(outline()).findByRole('button', { name: /Q2/ });
    await waitFor(() => expect(second).toHaveTextContent('💬 2'));
    expect(within(outline()).getByRole('button', { name: /Q1/ })).not.toHaveTextContent('💬');

    await user.click(screen.getByRole('button', { name: 'Ask about this question' }));
    expect(chat()).toHaveAccessibleName('Side chat · Q1');
    expect(chat()).not.toHaveTextContent('Tests reach it.');
    await user.click(second);
    expect(chat()).toHaveAccessibleName('Side chat · Q2');
    expect(chat()).toHaveTextContent('Why the server?');
    expect(chat()).toHaveTextContent('Tests reach it.');
    expect(chat()).toHaveTextContent('It stays thin.');
  });

  it('opens from the keyboard with c, ready to type, and Escape hands the keys back', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer().fetch}/>);
    await screen.findByRole('article');
    await user.keyboard('c');
    const field = within(chat()).getByRole('textbox', { name: 'Ask in the side chat' });
    expect(field).toHaveFocus();
    // Typing in the side chat never moves between questions or answers one.
    await user.type(field, 'jky');
    expect(field).toHaveValue('jky');
    expect(screen.getByRole('article')).toHaveTextContent('Q1 · Where do side chats live?');
  });

  it('opens in the drawer below ~860 px, where the right column is one', async () => {
    // A window 760 px wide, as `matchMedia` reports it.
    window.matchMedia = ((query: string) => ({
      matches: /max-width:\s*(\d+)px/.test(query) && 760 <= Number(/max-width:\s*(\d+)px/.exec(query)![1]), media: query,
      addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      const user = userEvent.setup();
      render(<LocalPage fetch={fakeServer().fetch}/>);
      await screen.findByRole('article');
      expect(screen.queryByRole('region', { name: 'What the agent receives' })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Ask about this question' }));
      expect(chat()).toHaveAccessibleName('Side chat · Q1');
      expect(screen.getByRole('group', { name: 'What the agent receives' })).toBeInTheDocument();
      // Escape out of the field, then Escape closes the drawer with the chat in it.
      await user.keyboard('{Escape}{Escape}');
      expect(screen.queryByRole('region', { name: /^Side chat/ })).toBeNull();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('says when the reply came from a fresh claude that could not see the conversation, and when it failed', async () => {
    render(<LocalPage fetch={fakeServer([{ question: 1, turns: [turn({ route: 'fresh', reply: 'From the round alone.' }), turn({ number: 2, ask: 'Again?', reply: '', status: 'failed' })] }]).fetch}/>);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ask about this question' }));
    expect(await within(chat()).findByText('From the round alone.')).toBeInTheDocument();
    expect(chat()).toHaveTextContent('The session could not be forked: this reply knows the round, not the conversation.');
    expect(within(chat()).getByRole('alert')).toHaveTextContent('No reply. Ask again.');
  });
});
