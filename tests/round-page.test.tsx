import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoundView } from '../src/core/round-answers';
import { LocalPage } from '../src/renderer/LocalPage';

// jsdom cannot lay out a Mermaid diagram: the renderer is replaced, and a diagram whose code says "broken" fails.
const renderDiagram = vi.hoisted(() => vi.fn(async (code: string) => {
  if (code.includes('broken')) throw new Error('Parse error');
  return `<svg role="img" aria-label="drawn: ${code.split('\n')[0]}"><text>diagram</text></svg>`;
}));
vi.mock('../src/renderer/diagrams', () => ({ renderDiagram }));

const SECRET = 'a'.repeat(43);
const SESSION = 'c0ffee00-0000-4000-8000-000000000001';

const ROUND: RoundView = {
  session: SESSION,
  number: 1,
  receivedAt: '2026-11-23T10:00:00.000Z',
  turnText: 'I read the server and the plugin. Two decisions are open.',
  questions: [
    { number: 1, title: 'Where do rounds live?', body: 'The server keeps every round it receives.', options: [], recommended: null, recommendation: 'In the per-user data folder.' },
    { number: 2, title: 'Who recognises a round?', body: 'The mod or the server.', options: [], recommended: null, recommendation: 'The server, where tests reach it.' },
  ],
  draft: { generalNote: '', answers: {} },
  sent: null,
  superseded: false,
};
type View = RoundView;

interface Request { method: string; url: string; body: unknown }

/** The local server as the page sees it, with one round and a poll that answers when the round changes. */
function fakeServer(initial: View | null = ROUND) {
  let round = initial;
  const requests: Request[] = [];
  const polls = new Set<(reply: Response) => void>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input), method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ method, url, body });
    if (new Headers(init?.headers).get('x-btw-secret') !== SECRET) return new Response('{}', { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
    if (url === '/api/round') return Response.json({ round });
    if (url === '/api/page/poll') return new Promise<Response>((done, fail) => {
      polls.add(done);
      init?.signal?.addEventListener('abort', () => fail(new DOMException('aborted', 'AbortError')));
    });
    if (method === 'PUT' && url === `/api/rounds/${SESSION}/1/draft`) return new Response(null, { status: 204 });
    if (method === 'POST' && url === `/api/rounds/${SESSION}/1/send`) {
      // The server words the message; the page must show the server's words, not its own preview.
      const message = `as delivered by the server (${(body as { language: string }).language})`;
      round = round && { ...round, draft: (body as { draft: View['draft'] }).draft, sent: { message, at: '2026-11-23T10:05:00.000Z' } };
      return Response.json({ message });
    }
    return new Response('{}', { status: 404 });
  });
  const changeRound = (next: View) => { round = next; for (const done of polls) done(Response.json({ changed: true })); polls.clear(); };
  return { fetch: fetch as unknown as typeof window.fetch, requests, changeRound };
}

const setLanguage = (value: string) => Object.defineProperty(navigator, 'language', { value, configurable: true });
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', `/#t=${SECRET}`); setLanguage('en-GB'); });
afterEach(() => setLanguage('it-IT'));

const outline = () => screen.getByRole('navigation', { name: 'Questions' });
const receives = () => screen.getByRole('region', { name: 'What the agent receives' });
const returnText = () => within(receives()).getByTestId('return-message').textContent;

describe('a round in the page (#95)', () => {
  it('shows the turn\'s text, an outline of the questions with their state, and the first question in focus', async () => {
    render(<LocalPage fetch={fakeServer().fetch}/>);
    expect(await screen.findByRole('region', { name: 'The turn’s text' })).toHaveTextContent('Two decisions are open.');
    const items = within(outline()).getAllByRole('button');
    expect(items.map(x => x.textContent)).toEqual(['Q1 · Where do rounds live?no answer', 'Q2 · Who recognises a round?no answer']);
    expect(within(screen.getByRole('banner')).getByText('0/2 answered')).toBeInTheDocument();
    const question = screen.getByRole('article');
    expect(within(question).getByRole('heading', { level: 2 })).toHaveTextContent('Q1 · Where do rounds live?');
    expect(question).toHaveTextContent('The server keeps every round it receives.');
    expect(question).toHaveTextContent('In the per-user data folder.');
    expect(question).not.toHaveTextContent('The mod or the server.');
    // Without an options list the question takes "yes" or a note, as before #96.
    expect(within(question).queryByRole('group', { name: 'Options' })).toBeNull();
  });

  it('updates what the agent receives live, and saves the draft on every change', async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    expect(returnText()).toBe('**Q1 · Where do rounds live?** no answer\n**Q2 · Who recognises a round?** no answer');

    await user.click(screen.getByRole('button', { name: 'Accept the recommendation' }));
    expect(screen.getByRole('button', { name: 'Accept the recommendation' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('banner')).getByText('1/2 answered')).toBeInTheDocument();
    expect(returnText()).toBe('**Q1 · Where do rounds live?** recommendation\n**Q2 · Who recognises a round?** no answer');

    await user.click(within(outline()).getByRole('button', { name: /Q2/ }));
    expect(screen.getByRole('article')).toHaveTextContent('The mod or the server.');
    await user.click(screen.getByRole('button', { name: 'No choice' }));
    await user.click(screen.getByRole('button', { name: 'Write a note' }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Keep the mod thin.');
    await user.click(screen.getByRole('button', { name: 'Add a general note' }));
    await user.type(screen.getByRole('textbox', { name: 'General note' }), 'Small first version.');
    expect(returnText()).toBe([
      'Small first version.',
      '',
      '**Q1 · Where do rounds live?** recommendation',
      '**Q2 · Who recognises a round?** no choice',
      '  Keep the mod thin.',
    ].join('\n'));

    await waitFor(() => {
      const saves = server.requests.filter(x => x.method === 'PUT');
      expect(saves.at(-1)?.body).toEqual({
        generalNote: 'Small first version.',
        answers: { '1': { choice: 'recommendation', note: '' }, '2': { choice: 'none', note: 'Keep the mod thin.' } },
      });
    });
  });

  it('keeps the note when the choice is taken back, and when focus moves away and back', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer().fetch}/>);
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'Write a note' }));
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Outside the plugin folder.');
    await user.click(screen.getByRole('button', { name: 'Accept the recommendation' }));
    await user.click(screen.getByRole('button', { name: 'Accept the recommendation' }));
    expect(returnText()).toContain('**Q1 · Where do rounds live?**\n  Outside the plugin folder.');
    await user.click(within(outline()).getByRole('button', { name: /Q2/ }));
    expect(screen.getByRole('article')).toHaveTextContent('Who recognises a round?');
    await user.click(within(outline()).getByRole('button', { name: /Q1/ }));
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Outside the plugin folder.');
  });

  it('sends the round with one Send, in the page\'s language, then shows it read-only with the message as delivered', async () => {
    const user = userEvent.setup();
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'Accept the recommendation' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const sent = server.requests.find(x => x.method === 'POST');
    expect(sent?.body).toEqual({ draft: { generalNote: '', answers: { '1': { choice: 'recommendation', note: '' } } }, language: 'en' });
    expect(await within(receives()).findByText('as delivered by the server (en)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept the recommendation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens a round already sent as read-only, with its message as delivered', async () => {
    render(<LocalPage fetch={fakeServer({ ...ROUND, sent: { message: 'the delivered words', at: '2026-11-23T10:05:00.000Z' } }).fetch}/>);
    expect(await within(await screen.findByRole('region', { name: 'What the agent receives' })).findByText('the delivered words')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('picks up the draft the server kept', async () => {
    render(<LocalPage fetch={fakeServer({ ...ROUND, draft: { generalNote: 'Kept.', answers: { '2': { choice: 'none', note: '' } } } }).fetch}/>);
    await screen.findByRole('article');
    expect(screen.getByRole('textbox', { name: 'General note' })).toHaveValue('Kept.');
    expect(within(screen.getByRole('banner')).getByText('1/2 answered')).toBeInTheDocument();
    // The first question still waiting for an answer is the one in focus.
    expect(screen.getByRole('article')).toHaveTextContent('Where do rounds live?');
  });

  it('shows a round that arrives while the page is open, by itself', async () => {
    const server = fakeServer(null);
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByText('CLAUDE CODE · LOCAL');
    await waitFor(() => expect(server.requests.some(x => x.url === '/api/page/poll')).toBe(true));
    server.changeRound(ROUND);
    expect(await screen.findByRole('article')).toHaveTextContent('Where do rounds live?');
  });

  it('speaks Italian when the browser does, and words the message in Italian', async () => {
    setLanguage('it-IT');
    const user = userEvent.setup();
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: 'Accetta la raccomandazione' }));
    expect(within(screen.getByRole('region', { name: 'Cosa riceve l’agente' })).getByTestId('return-message').textContent)
      .toBe('**Q1 · Where do rounds live?** raccomandazione\n**Q2 · Who recognises a round?** nessuna risposta');
    await user.click(screen.getByRole('button', { name: 'Invia' }));
    expect(server.requests.find(x => x.method === 'POST')?.body).toMatchObject({ language: 'it' });
  });
});

const WITH_OPTIONS: RoundView = {
  ...ROUND,
  questions: [
    {
      number: 1, title: 'Where does the question live?', body: 'The page needs one place to read it from.',
      options: [
        { letter: 'a', label: 'In the turn', consequence: 'nothing to store, but gone after a restart.' },
        { letter: 'b', label: 'On disk', consequence: 'survives a restart; one more folder to clean.' },
        { letter: 'c', label: 'In the session', consequence: 'the agent keeps it.' },
      ],
      recommended: 'b', recommendation: '(b), since the page outlives the session.',
    },
    ROUND.questions[1],
  ],
};

describe('a question\'s options side by side (#96)', () => {
  it('shows each option with its consequence, and marks the recommended one', async () => {
    render(<LocalPage fetch={fakeServer(WITH_OPTIONS).fetch}/>);
    const options = within(await screen.findByRole('article')).getByRole('group', { name: 'Options' });
    const cards = within(options).getAllByRole('button');
    expect(cards.map(x => x.textContent)).toEqual([
      '(a)In the turnnothing to store, but gone after a restart.',
      '(b)On diskRecommendedsurvives a restart; one more folder to clean.',
      '(c)In the sessionthe agent keeps it.',
    ]);
    expect(cards.map(x => x.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
  });

  it('puts the picked option\'s letter on the title line, saves it, and takes it back when picked again', async () => {
    const user = userEvent.setup();
    const server = fakeServer(WITH_OPTIONS);
    render(<LocalPage fetch={server.fetch}/>);
    const options = within(await screen.findByRole('article')).getByRole('group', { name: 'Options' });
    await user.click(within(options).getByRole('button', { name: /In the session/ }));
    expect(within(options).getByRole('button', { name: /In the session/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(outline()).getAllByRole('button')[0]).toHaveTextContent('option (c)');
    expect(returnText()).toBe('**Q1 · Where does the question live?** (c)\n**Q2 · Who recognises a round?** no answer');
    await waitFor(() => expect(server.requests.filter(x => x.method === 'PUT').at(-1)?.body).toEqual({ generalNote: '', answers: { '1': { choice: 'c', note: '' } } }));

    // Accepting the recommendation is its own answer, and replaces the option.
    await user.click(screen.getByRole('button', { name: 'Accept the recommendation' }));
    expect(within(options).getByRole('button', { name: /In the session/ })).toHaveAttribute('aria-pressed', 'false');
    expect(returnText()).toContain('**Q1 · Where does the question live?** recommendation');

    await user.click(within(options).getByRole('button', { name: /On disk/ }));
    await user.click(within(options).getByRole('button', { name: /On disk/ }));
    expect(returnText()).toContain('**Q1 · Where does the question live?** no answer');
  });
});

const WITH_DIAGRAM: RoundView = {
  ...ROUND,
  questions: [
    { ...ROUND.questions[0], body: ['The server keeps every round it receives.', '', '```mermaid', 'flowchart LR', '  Mod --> Server', '```', '', '```mermaid', 'broken diagram', '```'].join('\n') },
    ROUND.questions[1],
  ],
};

describe('reading one question comfortably (#97)', () => {
  it('draws a Mermaid diagram inside the question, and keeps the code of one that does not draw', async () => {
    render(<LocalPage fetch={fakeServer(WITH_DIAGRAM).fetch}/>);
    const question = await screen.findByRole('article');
    await waitFor(() => expect(within(question).getByRole('img', { name: 'drawn: flowchart LR' })).toBeInTheDocument());
    expect(renderDiagram).toHaveBeenCalledWith('flowchart LR\n  Mod --> Server\n', expect.stringMatching(/^(paper|blueprint)$/));
    expect(await within(question).findByText('This diagram does not draw: its code is shown instead.')).toBeInTheDocument();
    expect(question).toHaveTextContent('broken diagram');
  });

  it('keeps "n/m answered" in the top bar, and collapses an answered question in the outline once focus moves on', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer(WITH_OPTIONS).fetch}/>);
    await screen.findByRole('article');
    const bar = screen.getByRole('banner');
    expect(within(bar).getByText('0/2 answered')).toBeInTheDocument();

    await user.click(within(screen.getByRole('group', { name: 'Options' })).getByRole('button', { name: /On disk/ }));
    expect(within(bar).getByText('1/2 answered')).toBeInTheDocument();
    // The question in focus stays whole in the outline, answered or not.
    const first = () => within(outline()).getAllByRole('button')[0];
    expect(first()).toHaveTextContent('Q1 · Where does the question live?option (b)');

    await user.click(within(outline()).getByRole('button', { name: /Q2/ }));
    // Collapsed: one line with its number and answer; the title stays in its name and its tooltip.
    expect(first()).toHaveTextContent(/^Q1option \(b\)$/);
    expect(first()).toHaveAccessibleName('Q1 · Where does the question live? · option (b)');
    expect(first()).toHaveAttribute('title', 'Where does the question live?');
    // A question still waiting for its answer never collapses.
    expect(within(outline()).getAllByRole('button')[1]).toHaveTextContent('Q2 · Who recognises a round?no answer');
  });

  it('answers a round from the keyboard: move, pick an option, accept the recommendation, write a note, send', async () => {
    const user = userEvent.setup();
    const server = fakeServer(WITH_OPTIONS);
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    const heading = () => within(screen.getByRole('article')).getByRole('heading', { level: 2 });

    // Digits pick options in their order, so no option letter ever collides with a key below.
    await user.keyboard('3');
    expect(returnText()).toBe('**Q1 · Where does the question live?** (c)\n**Q2 · Who recognises a round?** no answer');
    await user.keyboard('j');
    expect(heading()).toHaveTextContent('Q2 · Who recognises a round?');
    // "y" accepts, and pressing it again keeps the answer: it never takes it back.
    await user.keyboard('yy');
    await user.keyboard('k');
    expect(heading()).toHaveTextContent('Q1 · Where does the question live?');
    await user.keyboard('k');
    expect(heading()).toHaveTextContent('Q1 · Where does the question live?');

    // "n" opens the note; inside it, keys are text, and Escape hands them back to the round.
    await user.keyboard('n');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus();
    await user.keyboard('jky');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', { name: 'Note' })).not.toHaveFocus();
    await user.keyboard('j');
    expect(heading()).toHaveTextContent('Q2 · Who recognises a round?');
    expect(returnText()).toBe('**Q1 · Where does the question live?** (c)\n  jky\n**Q2 · Who recognises a round?** recommendation');

    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(server.requests.find(x => x.method === 'POST')?.body).toMatchObject({ draft: { answers: { '1': { choice: 'c', note: 'jky' }, '2': { choice: 'recommendation' } } } });
    expect(await within(receives()).findByText('as delivered by the server (en)')).toBeInTheDocument();
  });

  it('shows few commands at first, and the rest on the question in focus as they are needed', async () => {
    const user = userEvent.setup();
    render(<LocalPage fetch={fakeServer(WITH_OPTIONS).fetch}/>);
    const question = await screen.findByRole('article');
    // At first: the options, the recommendation, no choice, two small "write" buttons, and Send. No text fields.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Previous question|Next question/ })).toBeNull();
    expect(within(question).getAllByRole('button').map(x => x.textContent)).toEqual([
      expect.stringContaining('(a)'), expect.stringContaining('(b)'), expect.stringContaining('(c)'),
      'Accept the recommendation', 'No choice', 'Write a note',
    ]);

    await user.click(within(question).getByRole('button', { name: 'Write a note' }));
    expect(within(question).getByRole('textbox', { name: 'Note' })).toHaveFocus();
    expect(within(question).queryByRole('button', { name: 'Write a note' })).toBeNull();

    // Once the question is answered, the step to the next one appears on it.
    await user.click(within(question).getByRole('button', { name: 'Accept the recommendation' }));
    await user.click(within(question).getByRole('button', { name: 'Next question' }));
    expect(screen.getByRole('article')).toHaveTextContent('Who recognises a round?');
    // The note field belongs to the question it was opened on.
    expect(screen.queryByRole('textbox', { name: 'Note' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add a general note' }));
    expect(screen.getByRole('textbox', { name: 'General note' })).toHaveFocus();
  });

  it('shows the keys on the question in focus, in both languages', async () => {
    render(<LocalPage fetch={fakeServer(WITH_OPTIONS).fetch}/>);
    expect(within(await screen.findByRole('article')).getByText('j/k move · 1–3 pick · y accept · n note · Ctrl+Enter send')).toBeInTheDocument();
    cleanup();
    setLanguage('it-IT');
    render(<LocalPage fetch={fakeServer(WITH_OPTIONS).fetch}/>);
    expect(within(await screen.findByRole('article')).getByText('j/k sposta · 1–3 scegli · y accetta · n nota · Ctrl+Invio invia')).toBeInTheDocument();
  });
});

/** A window `width` pixels wide, as `matchMedia` reports it; resizing tells the listeners, as a browser does. */
function viewport(width: number) {
  const lists = new Set<{ query: string; listeners: Set<() => void> }>();
  let subscribed = 0;
  const matches = (query: string) => { const max = /max-width:\s*(\d+)px/.exec(query); return max ? width <= Number(max[1]) : false; };
  window.matchMedia = ((query: string) => {
    const list = { query, listeners: new Set<() => void>() };
    lists.add(list);
    return {
      get matches() { return matches(query); }, media: query,
      addEventListener: (_: string, f: () => void) => { subscribed++; list.listeners.add(f); }, removeEventListener: (_: string, f: () => void) => list.listeners.delete(f),
    };
  }) as unknown as typeof window.matchMedia;
  return { resize: (next: number) => { width = next; act(() => lists.forEach(l => l.listeners.forEach(f => f()))); }, subscriptions: () => subscribed };
}

describe('the round beside a terminal (#97)', () => {
  afterEach(() => { delete (window as { matchMedia?: unknown }).matchMedia; });

  it('folds the outline into a rail below ~1180 px, keeping every question reachable by name', async () => {
    const user = userEvent.setup();
    const browser = viewport(1400);
    render(<LocalPage fetch={fakeServer().fetch}/>);
    await screen.findByRole('article');
    expect(within(outline()).getAllByRole('button')[1]).toHaveTextContent('Q2 · Who recognises a round?no answer');

    browser.resize(1100);
    const rail = within(outline()).getAllByRole('button');
    expect(rail.map(x => x.textContent)).toEqual(['Q1', 'Q2']);
    expect(rail[1]).toHaveAccessibleName('Q2 · Who recognises a round? · no answer');
    await user.click(screen.getByRole('button', { name: 'Accept the recommendation' }));
    expect(within(outline()).getAllByRole('button')[0]).toHaveTextContent('Q1 ✓');
    await user.click(within(outline()).getByRole('button', { name: /Who recognises a round/ }));
    expect(screen.getByRole('article')).toHaveTextContent('The mod or the server.');
    // The right column is still a column at this width.
    expect(receives()).toBeInTheDocument();
  });

  it('listens to the window\'s width once, not again on every answer', async () => {
    const user = userEvent.setup();
    const browser = viewport(1400);
    render(<LocalPage fetch={fakeServer().fetch}/>);
    await screen.findByRole('article');
    const before = browser.subscriptions();
    await user.keyboard('yjy');
    expect(browser.subscriptions()).toBe(before);
  });

  it('turns the right column into a drawer below ~860 px, opened from the top bar and closed with Escape', async () => {
    const user = userEvent.setup();
    viewport(700);
    const server = fakeServer();
    render(<LocalPage fetch={server.fetch}/>);
    await screen.findByRole('article');
    expect(screen.queryByRole('region', { name: 'What the agent receives' })).toBeNull();

    await user.keyboard('y');
    const toggle = within(screen.getByRole('banner')).getByRole('button', { name: 'What the agent receives' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(returnText()).toBe('**Q1 · Where do rounds live?** recommendation\n**Q2 · Who recognises a round?** no answer');
    expect(within(receives()).getByRole('button', { name: 'Send' })).toBeInTheDocument();

    // Escape closes it from inside, and the focus goes back to the button that opened it.
    await user.click(within(receives()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'What the agent receives' })).toBeNull();
    expect(toggle).toHaveFocus();
    await user.click(toggle);
    within(receives()).getByRole('button', { name: 'Send' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'What the agent receives' })).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();

    // Sending from the keyboard with the drawer closed opens it, so what was delivered is seen.
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(server.requests.some(x => x.method === 'POST')).toBe(true);
    expect(await within(receives()).findByText('as delivered by the server (en)')).toBeInTheDocument();
    expect(within(receives()).getByRole('status')).toHaveTextContent('Sent.');
  });
});
