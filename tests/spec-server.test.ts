// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit, ClaudeRun } from '../src/desktop/claude/completer';
import type { GhRun } from '../src/server/gh';
import { BAKERY, bakery, toAnswer } from './explorations';
import { serverClient, SESSION, useLocalServers } from './local-server-harness';

/**
 * A spec handed over with `Spec: <location>` (#104), driven over the server's HTTP API (seam ① of #92) with fake `gh`
 * and `claude` runners: read as handed over, a new version on each handover, explored through the `claude` route.
 */
const { start, folder } = useLocalServers();

/** `claude -p --output-format json` answering with the bakery's structure, the shape the exploration acceptance takes. */
async function structureAnswer(): Promise<ClaudeExit> {
  return { code: 0, stderr: '', stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: toAnswer(await bakery()) }) };
}
function fakeClaude(answer: (run: ClaudeRun) => Promise<ClaudeExit> = structureAnswer) {
  const runs: ClaudeRun[] = [];
  const runner = vi.fn(async (run: ClaudeRun) => { runs.push(run); return answer(run); });
  return { runner, runs };
}
function fakeGh(issues: Record<string, { title: string; body: string; url: string }>) {
  const runs: GhRun[] = [];
  const runner = vi.fn(async (run: GhRun) => {
    runs.push(run);
    const issue = issues[run.args[2]];
    if (!issue) return { code: 1, stdout: '', stderr: 'GraphQL: Could not resolve to an issue' };
    return { code: 0, stdout: JSON.stringify(issue), stderr: '' };
  });
  return { runner, runs };
}
/** A session's working folder with the spec written into it. */
function project(files: Record<string, string> = {}) {
  const cwd = folder();
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(cwd, path, '..'), { recursive: true });
    writeFileSync(join(cwd, path), text);
  }
  return cwd;
}
const handover = (location: string, before = 'The spec is written.') => `${before}\n\nSpec: ${location}`;
const OTHER = 'c0ffee00-0000-4000-8000-000000000002';

describe('a spec handed over from a local file (#104)', () => {
  it('reads the file the agent named, relative to the session\'s folder, as it was at handover', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const server = await start({ runners: { claude: fakeClaude().runner } });
    const client = serverClient(server);
    expect(await (await client.turn(handover('docs/spec.md'), SESSION, cwd)).json()).toMatchObject({ round: null, spec: expect.any(String) });
    // Later edits of the file do not shift what the person reads.
    writeFileSync(join(cwd, 'docs/spec.md'), '# Rewritten\n\nSomething else.');
    const [spec] = await client.specs();
    expect(spec).toMatchObject({ location: 'docs/spec.md', title: 'The night bakery', number: 1, session: SESSION, superseded: false });
    expect(await client.specText(spec.id)).toBe(BAKERY.trimEnd());
  });
});

describe('the handover ends the round phase (#104)', () => {
  it('ends the session\'s round phase, and the handover turn is no free block', async () => {
    const cwd = project({ 'spec.md': BAKERY });
    const server = await start();
    const client = serverClient(server);
    await client.startPhase(SESSION, cwd);
    await client.turn('A clarifying turn, shown as a free block.', SESSION, cwd);
    expect((await client.current()).phaseOpen).toBe(true);
    expect(await (await client.turn(handover('spec.md'), SESSION, cwd)).json()).not.toHaveProperty('free');
    expect(await client.current()).toMatchObject({ kind: 'free', phaseOpen: false, block: { number: 1 } });
    // The phase stays ended: the next turn without a round stays in the terminal.
    expect(await (await client.turn('Ordinary work again.', SESSION, cwd)).json()).toEqual({ round: null });
  });
});

describe('a spec handed over from a GitHub issue or pasted (#104)', () => {
  it('reads an issue through gh in the session\'s folder, by URL, owner/repo#n or #n, keyed by the issue\'s URL', async () => {
    const cwd = project();
    const issue = { title: 'Spec: a calmer way through rounds', body: BAKERY, url: 'https://github.com/owner/repo/issues/92' };
    const gh = fakeGh({ '92': issue, 'https://github.com/owner/repo/issues/92': issue });
    const server = await start({ runners: { gh: gh.runner } });
    const client = serverClient(server);
    await client.turn(handover('#92'), SESSION, cwd);
    await client.turn(handover('owner/repo#92'), SESSION, cwd);
    await client.turn(handover('`https://github.com/owner/repo/issues/92`'), SESSION, cwd);
    expect(gh.runs.map(run => [run.args, run.cwd])).toEqual([
      [['issue', 'view', '92', '--json', 'title,body,url'], cwd],
      [['issue', 'view', 'https://github.com/owner/repo/issues/92', '--json', 'title,body,url'], cwd],
      [['issue', 'view', 'https://github.com/owner/repo/issues/92', '--json', 'title,body,url'], cwd],
    ]);
    const specs = await client.specs();
    // Three handovers of one issue are three versions of one spec, newest first.
    expect(specs.map(x => [x.number, x.location, x.title])).toEqual([
      [3, 'https://github.com/owner/repo/issues/92', issue.title],
      [2, 'owner/repo#92', issue.title],
      [1, '#92', issue.title],
    ]);
    expect(await client.specText(specs[2].id)).toBe(BAKERY.trimEnd());
  });

  it('takes a pasted spec from the turn\'s own text above the line', async () => {
    const server = await start();
    const client = serverClient(server);
    await client.turn(handover('pasted', BAKERY));
    const [spec] = await client.specs();
    expect(spec).toMatchObject({ location: 'pasted', title: 'The night bakery', number: 1 });
    expect(await client.specText(spec.id)).toBe(BAKERY.trimEnd());
  });

  it('leaves a turn whose spec cannot be read as an ordinary turn: an unknown issue, a missing file, a file outside the folder, an empty paste', async () => {
    const outside = project({ 'secret.md': '# Not the spec' });
    const cwd = project();
    const server = await start({ runners: { gh: fakeGh({}).runner } });
    const client = serverClient(server);
    for (const location of ['#7', 'missing.md', join(outside, 'secret.md'), `../${outside.split('/').at(-1)}/secret.md`, 'https://example.com/spec.md', 'pasted']) {
      await client.startPhase(SESSION, cwd);
      expect(await (await client.turn(location === 'pasted' ? 'Spec: pasted' : handover(location), SESSION, cwd)).json()).toMatchObject({ round: null, free: expect.any(Number) });
    }
    expect(await client.specs()).toEqual([]);
  });

  it('reads only the last line: a Spec line inside the turn is no handover', async () => {
    const cwd = project({ 'spec.md': BAKERY });
    const server = await start();
    const client = serverClient(server);
    await client.turn('Spec: spec.md\n\nI will hand it over once you agree.', SESSION, cwd);
    expect(await client.specs()).toEqual([]);
  });
});

describe('a new handover of the same location is a new version (#104)', () => {
  it('keeps the earlier version as it was, superseded by the new one, and keeps versions across a restart', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const dataDir = folder();
    const first = await start({ dataDir });
    const client = serverClient(first);
    await client.turn(handover('docs/spec.md'), SESSION, cwd);
    writeFileSync(join(cwd, 'docs/spec.md'), BAKERY.replace('Loaf 2, roll 1.', 'Loaf 3, roll 1.'));
    await client.turn(handover('./docs/spec.md'), OTHER, cwd);
    await first.stop();

    const again = serverClient(await start({ dataDir }));
    const [newer, older] = await again.specs();
    expect(newer).toMatchObject({ number: 2, superseded: false, latest: newer.id, session: OTHER, location: './docs/spec.md' });
    expect(older).toMatchObject({ number: 1, superseded: true, latest: newer.id });
    expect(await again.specText(older.id)).toContain('Loaf 2, roll 1.');
    expect(await again.specText(newer.id)).toContain('Loaf 3, roll 1.');
  });

  it('versions a pasted spec within its session, and a file by where it is, not how it is written', async () => {
    const cwd = project({ 'a.md': '# A\n\nOne.', 'b.md': '# B\n\nTwo.' });
    const server = await start();
    const client = serverClient(server);
    await client.turn(handover('pasted', '# P\n\nFirst.'), SESSION, cwd);
    await client.turn(handover('pasted', '# P\n\nSecond.'), SESSION, cwd);
    await client.turn(handover('pasted', '# P\n\nOther session.'), OTHER, cwd);
    await client.turn(handover('a.md'), SESSION, cwd);
    await client.turn(handover('b.md'), SESSION, cwd);
    expect((await client.specs()).map(x => [x.location, x.title, x.number]).sort()).toEqual([
      ['a.md', 'A', 1], ['b.md', 'B', 1], ['pasted', 'P', 1], ['pasted', 'P', 1], ['pasted', 'P', 2],
    ]);
  });
});

/** The version once its structure is no longer being written. */
async function settled(client: ReturnType<typeof serverClient>, id: string) {
  for (let i = 0; i < 200; i++) {
    const spec = (await client.specs()).find(x => x.id === id);
    if (spec && spec.run?.state !== 'running') return spec;
    await new Promise(done => setTimeout(done, 10));
  }
  throw new Error('the structure is still being written');
}
const handedOver = async (client: ReturnType<typeof serverClient>, text: string) => (await (await client.turn(text)).json()).spec as string;

describe('the structure is written through the claude route and saved with the exploration store (#104)', () => {
  it('starts at handover, with a fresh claude -p that sees only the spec, and saves the exploration the page then finds', async () => {
    const claude = fakeClaude();
    const client = serverClient(await start({ runners: { claude: claude.runner } }));
    const id = await handedOver(client, handover('pasted', BAKERY));
    const spec = await settled(client, id);
    expect(spec.run).toBeNull();
    expect(spec.exploration).toEqual({ id: expect.stringMatching(/^x-/), revision: 'v1' });

    const [run] = claude.runs;
    expect(claude.runs).toHaveLength(1);
    expect(run.input).toContain('Bread left out loses water');
    expect(run.input).not.toContain('The spec is written.');
    expect(run.args).toEqual(expect.arrayContaining(['-p', '--json-schema', '--tools', '', '--safe-mode', '--strict-mcp-config', '--no-session-persistence']));
    expect(run.args[run.args.indexOf('--model') + 1]).toBe('sonnet');

    const found = await (await client.exploration(spec.exploration!.id, spec.exploration!.revision)).json();
    expect(found.exploration).toMatchObject({ kind: 'generated', title: 'The night bakery', language: 'en', generation: { provider: 'claude', model: 'sonnet' } });
    expect(found.exploration.source.text).toBe(BAKERY.trimEnd());
    expect(await client.explorations()).toEqual([found.exploration]);
    expect((await client.exploration(spec.exploration!.id, 'v9')).status).toBe(404);
  });

  it('repairs a structure that misses the checks once, as every route does', async () => {
    const answers = [
      async () => { const a = toAnswer(await bakery()); a.parts[1].cites = [[40, 41]]; return { code: 0, stderr: '', stdout: JSON.stringify({ is_error: false, structured_output: a }) }; },
      structureAnswer,
    ];
    const claude = fakeClaude(() => answers.shift()!());
    const client = serverClient(await start({ runners: { claude: claude.runner } }));
    const spec = await settled(client, await handedOver(client, handover('pasted', BAKERY)));
    expect(claude.runs).toHaveLength(2);
    expect(claude.runs[1].input).toContain('Your previous answer');
    expect(spec.exploration).not.toBeNull();
  });

  it('says why a structure was not written, and writes it again when the page asks', async () => {
    let up = false;
    const claude = fakeClaude(async () => up ? structureAnswer() : { code: 1, stdout: '', stderr: 'Not logged in' });
    const client = serverClient(await start({ runners: { claude: claude.runner } }));
    const id = await handedOver(client, handover('pasted', BAKERY));
    expect(await settled(client, id)).toMatchObject({ exploration: null, run: { state: 'failed', failure: { code: 'unavailable', reason: 'claude-failed' } } });
    up = true;
    expect((await client.explore(id)).status).toBe(202);
    expect((await settled(client, id)).exploration).not.toBeNull();
    // A version explored once keeps its structure.
    expect((await client.explore(id)).status).toBe(409);
  });

  it('cancels a structure being written, and refuses a second start while one runs', async () => {
    const claude = fakeClaude(run => new Promise((_, fail) => run.signal.addEventListener('abort', () => fail(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    const client = serverClient(await start({ runners: { claude: claude.runner } }));
    const id = await handedOver(client, handover('pasted', BAKERY));
    await vi.waitFor(() => expect(claude.runs).toHaveLength(1));
    expect((await client.specs())[0].run).toEqual({ state: 'running', repairing: false });
    expect((await client.explore(id)).status).toBe(409);
    expect((await client.cancelExplore(id)).status).toBe(204);
    expect(await settled(client, id)).toMatchObject({ exploration: null, run: { state: 'failed', failure: { code: 'cancelled' } } });
    expect((await client.cancelExplore(id)).status).toBe(404);
  });

  it('wakes the page when a version arrives and when its structure is written', async () => {
    const client = serverClient(await start({ runners: { claude: fakeClaude().runner } }));
    const poll = client.call('/api/page/poll');
    await new Promise(done => setTimeout(done, 20));
    const id = await handedOver(client, handover('pasted', BAKERY));
    expect(await (await poll).json()).toEqual({ changed: true });
    await settled(client, id);
  });

  it('refuses an id that names no version, and anything without the secret', async () => {
    const server = await start();
    const client = serverClient(server);
    for (const id of ['spec-0000000000000000-1', '..%2F..%2Fsecret', 'x']) {
      expect((await client.spec(id)).status).toBe(404);
      expect((await client.explore(id)).status).toBe(404);
    }
    expect((await client.exploration('..', 'v1')).status).toBe(404);
    for (const path of ['/api/specs', '/api/explorations']) expect((await fetch(`http://127.0.0.1:${server.port}${path}`)).status).toBe(401);
  });
});
