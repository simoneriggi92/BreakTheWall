import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
function fakeServer(initial: SideChat[] = [], round: RoundView = ROUND) {
  let chats = initial;
  let version = 1;
  const asked: { question: number; ask: string; passage?: unknown }[] = [];
  /** Every draft the page saved, and the draft it sent. */
  const drafts: unknown[] = [];
  const sent: unknown[] = [];
  const waiting = new Set<() => void>();
  const view = () => Response.json({ version, sideChats: chats });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/current') return Response.json({ current: { kind: 'round', round, phaseOpen: true } });
    if (url === '/api/page/poll') return new Promise<Response>(() => {});
    if (method === 'PUT') return drafts.push(JSON.parse(String(init?.body))), new Response(null, { status: 204 });
    if (method === 'POST' && url.endsWith('/send')) return sent.push(JSON.parse(String(init?.body)).draft), Response.json({ message: 'the delivered words' });
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
      const body = JSON.parse(String(init?.body)) as { ask: string; passage?: SideChatTurn['passage'] };
      const text = body.ask;
      asked.push({ question, ask: text, ...(body.passage ? { passage: body.passage } : {}) });
      const thread = chats.find(x => x.question === question) ?? { question, turns: [] };
      const turn: SideChatTurn = { number: thread.turns.length + 1, ask: text, ...(body.passage ? { passage: body.passage } : {}), reply: '', files: [], status: 'running', route: 'fork', at: '2026-11-24T10:01:00.000Z' };
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
  return { fetch: fetch as unknown as typeof window.fetch, asked, drafts, sent, stream };
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
const marked = (kind: string) => Array.from(screen.getByRole('article').querySelectorAll(`mark.${kind}`)).map(x => x.textContent);
const receives = () => screen.getByTestId('return-message').textContent;
const SENT = { message: 'the delivered words', at: '2026-11-24T10:05:00.000Z' };

describe('asking about a passage (#101)', () => {
  afterEach(() => document.getSelection()?.removeAllRanges());

  it('offers "Ask here" beside "Remark"; the side chat quotes the passage, and the passage is marked apart from remarks', async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    selectText(await screen.findByRole('article'), 'their own folder');
    expect(screen.getByRole('button', { name: 'Remark' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ask here' }));
    expect(screen.queryByRole('button', { name: 'Ask here' })).toBeNull();
    expect(chat()).toHaveAccessibleName('Side chat · Q1');
    expect(within(chat()).getByRole('figure', { name: 'Asking about' })).toHaveTextContent('«their own folder»');
    const field = within(chat()).getByRole('textbox', { name: 'Ask in the side chat' });
    expect(field).toHaveFocus();
    await user.type(field, 'Why would they?{Enter}');
    expect(server.asked).toEqual([{ question: 1, ask: 'Why would they?', passage: { part: 'body', start: 25, end: 41, passage: 'their own folder' } }]);
    const asked = (await within(chat()).findByText('Why would they?')).closest('.side-chat-ask')!;
    expect(asked).toHaveTextContent('«their own folder»');
    // Once asked, the passage leaves the composer and stays marked in the question, in the side chat's colour.
    expect(within(chat()).queryByRole('figure', { name: 'Asking about' })).toBeNull();
    expect(marked('round-ask-mark')).toEqual(['their own folder']);
    expect(marked('round-remark-mark')).toEqual([]);
  });

  it('asks about the whole question again once the quoted passage is taken away', async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    selectText(await screen.findByRole('article'), 'Beside the rounds');
    await user.click(screen.getByRole('button', { name: 'Ask here' }));
    expect(marked('round-ask-mark')).toEqual(['Beside the rounds']);
    await user.click(within(chat()).getByRole('button', { name: 'Ask about the whole question' }));
    expect(marked('round-ask-mark')).toEqual([]);
    await user.type(within(chat()).getByRole('textbox', { name: 'Ask in the side chat' }), 'Why?{Enter}');
    expect(server.asked).toEqual([{ question: 1, ask: 'Why?' }]);
  });

  it('offers "Ask here" on a sent round, where "Remark" no longer is', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer([], { ...ROUND, sent: SENT }).fetch}/>);
    selectText(await screen.findByRole('article'), 'their own folder');
    expect(screen.queryByRole('button', { name: 'Remark' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ask here' }));
    expect(within(chat()).getByRole('figure', { name: 'Asking about' })).toHaveTextContent('«their own folder»');
  });
});

describe('attaching side-chat replies to the answer (#101)', () => {
  const PASSAGE = { part: 'body' as const, start: 25, end: 41, passage: 'their own folder' };
  const threads = (): SideChat[] => [
    { question: 1, turns: [turn({ ask: 'Why not their own folder?', passage: PASSAGE, reply: 'Deleting a session\ndeletes its side chats.' }), turn({ number: 2, ask: 'Still running?', reply: 'Half', status: 'running' })] },
    { question: 2, turns: [turn({ ask: 'Why the server?', reply: 'Tests reach it.' })] },
  ];
  const attach = () => within(chat()).getAllByRole('button', { name: '📎 Attach to answer' });

  it('attaches a finished reply with 📎: the exchange shows verbatim under its question in what the agent receives, and Send carries it', async () => {
    const user = userEvent.setup();
    const server = fakeServer(threads());
    render(<LocalPage fetch={server.fetch}/>);
    await user.click(await screen.findByRole('button', { name: 'Ask about this question' }));
    await within(chat()).findByText('Why not their own folder?');
    // A reply still running cannot be attached yet.
    expect(attach()).toHaveLength(1);
    await user.click(attach()[0]);
    expect(attach()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(receives()).toBe([
      '**Q1 · Where do side chats live?** no answer',
      '  - Side chat — question: «their own folder» — Why not their own folder?',
      '    reply: Deleting a session',
      '    deletes its side chats.',
      '**Q2 · Who runs the fork?** no answer',
    ].join('\n'));
    await waitFor(() => expect(server.drafts.at(-1)).toEqual({
      generalNote: '', answers: { '1': { note: '', attached: [{ turn: 1, ask: 'Why not their own folder?', passage: 'their own folder', reply: 'Deleting a session\ndeletes its side chats.' }] } },
    }));
    await user.click(screen.getByText(/^What the agent receives ·/));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(server.sent).toEqual([server.drafts.at(-1)]);
  });

  it('takes an attached reply back with a second press, and attaches nothing on a sent round', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer(threads()).fetch}/>);
    await user.click(await screen.findByRole('button', { name: 'Ask about this question' }));
    await within(chat()).findByText('Why not their own folder?');
    await user.click(attach()[0]);
    await user.click(attach()[0]);
    expect(attach()[0]).toHaveAttribute('aria-pressed', 'false');
    expect(receives()).not.toContain('Side chat');
    cleanup();
    render(<LocalPage fetch={fakeServer(threads(), { ...ROUND, sent: SENT }).fetch}/>);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ask about this question' }));
    await within(chat()).findByText('Why not their own folder?');
    expect(within(chat()).queryByRole('button', { name: '📎 Attach to answer' })).toBeNull();
  });

  it('counts, before Send, the side chats with no reply attached', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer(threads()).fetch}/>);
    const review = await screen.findByRole('region', { name: 'What the agent receives' });
    expect(await within(review).findByText('2 side chats with no reply attached')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ask about this question' }));
    await within(chat()).findByText('Why not their own folder?');
    await user.click(attach()[0]);
    const strip = screen.getByRole('group', { name: 'What the agent receives' });
    expect(within(strip).getByText('1 side chat with no reply attached')).toBeInTheDocument();
    await user.click(within(outline()).getByRole('button', { name: /Q2/ }));
    await user.click(attach()[0]);
    expect(within(strip).queryByText(/no reply attached/)).toBeNull();
  });

  it('words "Ask here", 📎 and the count in Italian when the page is in Italian', async () => {
    setLanguage('it-IT');
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer(threads()).fetch}/>);
    const review = await screen.findByRole('region', { name: 'Cosa riceve l’agente' });
    expect(await within(review).findByText('2 chat laterali senza una risposta allegata')).toBeInTheDocument();
    selectText(screen.getByRole('article'), 'their own folder');
    await user.click(screen.getByRole('button', { name: 'Chiedi qui' }));
    const side = screen.getByRole('region', { name: 'Chat laterale · Q1' });
    expect(within(side).getByRole('figure', { name: 'Chiedi su' })).toHaveTextContent('«their own folder»');
    expect(within(side).getByRole('button', { name: 'Chiedi sull’intera domanda' })).toBeInTheDocument();
    await user.click(await within(side).findByRole('button', { name: '📎 Allega alla risposta' }));
    expect(screen.getByTestId('return-message')).toHaveTextContent('- Chat laterale — domanda: «their own folder» — Why not their own folder?');
    expect(screen.getByText('1 chat laterale senza una risposta allegata')).toBeInTheDocument();
  });
});
