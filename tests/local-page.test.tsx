import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalPage } from '../src/renderer/LocalPage';

const SECRET = 'a'.repeat(43);
interface Call { url: string; secret: string | null }

/** The local server as the page sees it: it knows one secret and refuses every other. */
function fakeServer(known = SECRET) {
  const calls: Call[] = [];
  const held = new Set<(error: Error) => void>();
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const secret = new Headers(init?.headers).get('x-btw-secret');
    const url = String(input);
    calls.push({ url, secret });
    if (secret !== known) return new Response(JSON.stringify({ error: 'secret' }), { status: 401 });
    if (url === '/api/status') return Response.json({ app: 'break-the-wall', version: '0.6.0-test', pageConnected: true, platform: 'darwin' });
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
