// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { spawnSideChat, type SideChatRun } from '../src/server/side-chats';
import { CWD, serverClient as client, SESSION, useLocalServers } from './local-server-harness';

const { folder, start } = useLocalServers();
const OTHER = 'c0ffee00-0000-4000-8000-000000000002';

const ROUND = `I read the server. Two decisions are open.

❓ **Q1** - **Where do side chats live?**: Beside the rounds, or in their own folder.

- **(a)** Beside the rounds: one session folder holds everything.
- **(b)** Their own folder: apart from what the agent receives.

➡️ (a), so deleting a session deletes its side chats.

---

❓ **Q2** - **Who runs the fork?**: The server or the mod.

➡️ The server, where tests reach it.`;

/** One line of `claude -p --output-format stream-json --verbose --include-partial-messages`, as witnessed on 2.1.331. */
const line = {
  delta: (text: string) => JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } } }),
  tool: (name: string, input: Record<string, unknown>) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: `toolu_${name}`, name, input }] } }),
  result: (text: string) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text }),
  failed: () => JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true }),
};

/**
 * `claude -p` in place: records what each run was told and allowed, and answers with the lines its script writes.
 * By default it reads a file and answers at once.
 */
function fakeClaude(script: (run: SideChatRun, index: number) => Promise<number> = async run => {
  run.onLine(line.tool('Read', { file_path: `${run.cwd}/src/server/rounds.ts` }));
  run.onLine(line.delta('Beside the rounds.'));
  run.onLine(line.result('Beside the rounds.'));
  return 0;
}) {
  const runs: SideChatRun[] = [];
  const runner = async (run: SideChatRun) => {
    runs.push(run);
    return { code: await script(run, runs.length - 1), stderr: '' };
  };
  return { runs, runner };
}

/** A run that streams only when the test says so. */
function heldClaude() {
  const held: { run: SideChatRun; finish: (code?: number) => void }[] = [];
  const claude = fakeClaude(run => new Promise<number>(done => { held.push({ run, finish: (code = 0) => done(code) }); }));
  return { ...claude, held };
}

const until = async (check: () => boolean | Promise<boolean>) => {
  for (let i = 0; i < 200; i++) { if (await check()) return; await new Promise(done => setTimeout(done, 10)); }
  throw new Error('the condition never held');
};

/** The server's side chats of round 1, once no turn of them still runs. */
async function settled(api: ReturnType<typeof client>) {
  let chats: Awaited<ReturnType<typeof api.sideChats>>['sideChats'] = [];
  await until(async () => {
    chats = (await api.sideChats(1)).sideChats;
    return chats.length > 0 && chats.every(x => x.turns.every(t => t.status !== 'running'));
  });
  return chats;
}

describe('a side chat on one question (#100)', () => {
  it('starts nothing until the person asks', async () => {
    const claude = fakeClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    expect(await api.sideChats(1)).toMatchObject({ sideChats: [] });
    expect(claude.runs).toHaveLength(0);
  });

  it('forks the session read-only, in the session\'s folder, with Read, Grep and Glob only', async () => {
    const claude = fakeClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    expect((await api.ask(1, 1, 'Why not their own folder?')).status).toBe(202);
    await settled(api);
    expect(claude.runs).toHaveLength(1);
    expect(claude.runs[0].cwd).toBe(CWD);
    expect(claude.runs[0].args).toEqual([
      '-p', '--resume', SESSION, '--fork-session', '--no-session-persistence',
      '--tools', 'Read,Grep,Glob', '--allowedTools', 'Read,Grep,Glob', '--strict-mcp-config',
      '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    ]);
  });

  it('tells the fork the question, the options, the recommendation and what the person asks', async () => {
    const claude = fakeClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'Why not their own folder?');
    await settled(api);
    const prompt = claude.runs[0].input;
    expect(prompt).toContain('Q1 · Where do side chats live?');
    expect(prompt).toContain('Beside the rounds, or in their own folder.');
    expect(prompt).toContain('(b) Their own folder: apart from what the agent receives.');
    expect(prompt).toContain('(a), so deleting a session deletes its side chats.');
    expect(prompt).toContain('Why not their own folder?');
    // Read-only and apart from the agent's conversation, and it says so.
    expect(prompt).toMatch(/read-only/i);
    expect(prompt).not.toContain('Who runs the fork?');
  });

  it('gives the fork its own earlier turns, and never another question\'s side chat or an unsent draft', async () => {
    const claude = fakeClaude(async (run, index) => {
      const reply = ['First reply on Q1.', 'Reply on Q2.', 'Second reply on Q1.'][index];
      run.onLine(line.delta(reply));
      run.onLine(line.result(reply));
      return 0;
    });
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.saveDraft(1, { generalNote: 'A general note still unsent.', answers: { '1': { choice: 'b', note: 'A note still unsent.' } } });
    await api.ask(1, 1, 'First ask on Q1.');
    await settled(api);
    await api.ask(1, 2, 'Ask on Q2.');
    await settled(api);
    await api.ask(1, 1, 'Second ask on Q1.');
    await settled(api);

    const third = claude.runs[2].input;
    expect(third).toContain('First ask on Q1.');
    expect(third).toContain('First reply on Q1.');
    expect(third).toContain('Second ask on Q1.');
    expect(third).not.toContain('Ask on Q2.');
    expect(third).not.toContain('Reply on Q2.');
    expect(third).not.toContain('still unsent');
    // Its own earlier turns come before what the person asks now.
    expect(third.indexOf('First reply on Q1.')).toBeLessThan(third.indexOf('Second ask on Q1.'));
  });

  it('keeps one side chat per question, each turn with its reply and the files the fork read', async () => {
    const claude = fakeClaude(async run => {
      run.onLine(line.tool('Read', { file_path: `${run.cwd}/src/server/rounds.ts`, offset: 60, limit: 40 }));
      run.onLine(line.tool('Grep', { pattern: 'sessionDir', path: `${run.cwd}/src` }));
      run.onLine(line.tool('Glob', { pattern: '**/*.test.ts' }));
      run.onLine(line.tool('Read', { file_path: '/elsewhere/notes.md' }));
      run.onLine(line.delta('Let me look. '));
      run.onLine(line.delta('Beside the rounds.'));
      run.onLine(line.result('Beside the rounds.'));
      return 0;
    });
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'Where exactly?');
    expect(await settled(api)).toEqual([{
      question: 1,
      turns: [{
        number: 1, ask: 'Where exactly?', reply: 'Beside the rounds.', route: 'fork', status: 'done', at: expect.any(String),
        files: ['src/server/rounds.ts:60-99', 'grep "sessionDir" in src', 'glob "**/*.test.ts"', '/elsewhere/notes.md'],
      }],
    }]);
  });

  it('streams the reply: the page sees it grow while the fork still runs', async () => {
    const claude = heldClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'Where exactly?');
    await until(() => claude.held.length === 1);
    const { version } = await api.sideChats(1);
    // A held poll answers as soon as the reply grows.
    const poll = api.sideChats(1, version);
    claude.held[0].run.onLine(line.delta('Beside '));
    const grown = await poll;
    expect(grown.version).toBeGreaterThan(version);
    expect(grown.sideChats[0].turns[0]).toMatchObject({ reply: 'Beside ', status: 'running' });
    claude.held[0].run.onLine(line.delta('the rounds.'));
    claude.held[0].run.onLine(line.result('Beside the rounds.'));
    claude.held[0].finish();
    expect((await settled(api))[0].turns[0]).toMatchObject({ reply: 'Beside the rounds.', status: 'done' });
  });

  it('runs side chats on several questions at once', async () => {
    const claude = heldClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'On Q1.');
    await api.ask(1, 2, 'On Q2.');
    // Both forks started before either answered.
    await until(() => claude.held.length === 2);
    for (const x of claude.held) { x.run.onLine(line.result('Done.')); x.finish(); }
    expect((await settled(api)).map(x => x.turns[0].status)).toEqual(['done', 'done']);
  });

  it('refuses a second question on a side chat whose reply still runs', async () => {
    const claude = heldClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'First.');
    expect((await api.ask(1, 1, 'Second.')).status).toBe(409);
    claude.held[0].finish();
  });

  it('answers with a fresh claude -p, given the round and the question, when forking the session fails', async () => {
    const claude = fakeClaude(async (run, index) => {
      if (index === 0) { run.onLine(line.failed()); return 1; }
      run.onLine(line.delta('From the round alone.'));
      run.onLine(line.result('From the round alone.'));
      return 0;
    });
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'Why not their own folder?');
    expect((await settled(api))[0].turns[0]).toMatchObject({ reply: 'From the round alone.', status: 'done', route: 'fresh' });
    expect(claude.runs).toHaveLength(2);
    expect(claude.runs[1].cwd).toBe(CWD);
    expect(claude.runs[1].args).toEqual([
      '-p', '--no-session-persistence',
      '--tools', 'Read,Grep,Glob', '--allowedTools', 'Read,Grep,Glob', '--strict-mcp-config',
      '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    ]);
    const prompt = claude.runs[1].input;
    // It cannot see the conversation, so it is given the round as the agent wrote it.
    expect(prompt).toContain('I read the server. Two decisions are open.');
    expect(prompt).toContain('Q1 · Where do side chats live?');
    expect(prompt).toContain('Q2 · Who runs the fork?');
    expect(prompt).toContain('Why not their own folder?');
  });

  it('falls back too when claude cannot be started for the fork', async () => {
    const runs: SideChatRun[] = [];
    const runner = async (run: SideChatRun) => {
      runs.push(run);
      if (runs.length === 1) throw Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
      run.onLine(line.result('Fresh.'));
      return { code: 0, stderr: '' };
    };
    const api = client(await start({ runners: { sideChat: runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'Why?');
    expect((await settled(api))[0].turns[0]).toMatchObject({ reply: 'Fresh.', status: 'done', route: 'fresh' });
  });

  it('marks the turn failed when the fresh run fails as well', async () => {
    const claude = fakeClaude(async run => { run.onLine(line.failed()); return 1; });
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.ask(1, 1, 'Why?');
    expect((await settled(api))[0].turns[0]).toMatchObject({ status: 'failed' });
    expect(claude.runs).toHaveLength(2);
  });

  it('uses the session\'s model, or the one set in the plugin', async () => {
    const claude = fakeClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.register(SESSION, CWD, { model: 'claude-opus-5-5' });
    await api.turn(ROUND);
    await api.ask(1, 1, 'Which model?');
    await settled(api);
    expect(claude.runs[0].args.slice(-2)).toEqual(['--model', 'claude-opus-5-5']);

    await api.register(SESSION, CWD, { model: 'claude-opus-5-5', sideChatModel: 'haiku' });
    await api.ask(1, 2, 'And now?');
    await settled(api);
    expect(claude.runs[1].args.slice(-2)).toEqual(['--model', 'haiku']);
  });

  it('keeps the models a session registered with across a restart', async () => {
    const dataDir = folder();
    const server = await start({ dataDir });
    const first = client(server);
    // Registered before the session's first round, as the mod does on `session.start`.
    await first.register(SESSION, CWD, { model: 'claude-opus-5-5', sideChatModel: 'haiku' });
    await first.turn(ROUND);
    await first.register(OTHER, CWD, { model: 'claude-opus-5-5' });
    await first.turn(ROUND, OTHER);
    await server.stop();

    const claude = fakeClaude();
    const again = client(await start({ dataDir, runners: { sideChat: claude.runner } }));
    await again.ask(1, 1, 'Which model?');
    await settled(again);
    await again.ask(1, 1, 'And here?', OTHER);
    await until(() => claude.runs.length === 2);
    expect(claude.runs.map(x => x.args.slice(-2))).toEqual([['--model', 'haiku'], ['--model', 'claude-opus-5-5']]);
  });

  it('never passes a model that would read as an option, and still registers the session', async () => {
    const claude = fakeClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    expect((await api.register(SESSION, CWD, { model: 'Default (recommended)', sideChatModel: '--dangerously-skip-permissions' })).status).toBe(204);
    await api.turn(ROUND);
    await api.ask(1, 1, 'Which model?');
    await settled(api);
    expect(claude.runs[0].args).not.toContain('--model');
    expect(claude.runs[0].args).not.toContain('--dangerously-skip-permissions');
  });

  it('keeps the side chats across a restart, and a reply cut short by it shows as failed', async () => {
    const dataDir = folder();
    const claude = heldClaude();
    const first = await start({ dataDir, runners: { sideChat: claude.runner } });
    const api = client(first);
    await api.turn(ROUND);
    await api.ask(1, 1, 'Before the restart.');
    await until(() => claude.held.length === 1);
    claude.held[0].run.onLine(line.delta('Half a re'));
    await until(async () => (await api.sideChats(1)).sideChats[0]?.turns[0].reply === 'Half a re');
    await first.stop();

    const again = client(await start({ dataDir, runners: { sideChat: fakeClaude().runner } }));
    expect((await again.sideChats(1)).sideChats).toEqual([
      { question: 1, turns: [expect.objectContaining({ ask: 'Before the restart.', status: 'failed' })] },
    ]);
  });

  it('refuses what names no question, an empty question, and a call without the secret', async () => {
    const api = client(await start({ runners: { sideChat: fakeClaude().runner } }));
    await api.turn(ROUND);
    expect((await api.ask(2, 1, 'No such round.')).status).toBe(404);
    expect((await api.ask(1, 3, 'No such question.')).status).toBe(404);
    expect((await api.ask(1, 1, '   ')).status).toBe(400);
    expect((await api.call('/api/side-chats/..%2Fescape/1')).status).toBe(404);
    const server = await start({ runners: { sideChat: fakeClaude().runner } });
    const anonymous = await fetch(`http://127.0.0.1:${server.port}/api/side-chats/${SESSION}/1`);
    expect(anonymous.status).toBe(401);
  });
});

describe('asking about a passage (#101)', () => {
  const PASSAGE = { part: 'body', start: 0, end: 17, passage: 'Beside the rounds' } as const;

  it('quotes the passage to the fork, and keeps it on the turn so the page marks it again', async () => {
    const claude = fakeClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    expect((await api.askAbout(1, 1, 'Why here?', PASSAGE)).status).toBe(202);
    const [sideChat] = await settled(api);
    expect(sideChat.turns[0]).toMatchObject({ ask: 'Why here?', passage: PASSAGE, status: 'done' });
    expect(claude.runs[0].input).toContain('The person asks about this passage of the question: «Beside the rounds»\nWhy here?');
  });

  it('gives the fork the passage of an earlier turn too', async () => {
    const claude = fakeClaude();
    const api = client(await start({ runners: { sideChat: claude.runner } }));
    await api.turn(ROUND);
    await api.askAbout(1, 1, 'Why here?', PASSAGE);
    await settled(api);
    await api.ask(1, 1, 'And then?');
    await until(async () => claude.runs.length === 2);
    expect(claude.runs[1].input).toContain('The person asked about this passage of the question: «Beside the rounds»\nWhy here?');
  });

  it('refuses a passage that is empty, ends before it starts, or sits in no part of a question', async () => {
    const api = client(await start({ runners: { sideChat: fakeClaude().runner } }));
    await api.turn(ROUND);
    expect((await api.askAbout(1, 1, 'Why?', { ...PASSAGE, passage: '  ' })).status).toBe(400);
    expect((await api.askAbout(1, 1, 'Why?', { ...PASSAGE, end: 0 })).status).toBe(400);
    expect((await api.askAbout(1, 1, 'Why?', { ...PASSAGE, part: 'title' })).status).toBe(400);
  });
});

describe('the side chat\'s process (#100)', () => {
  const fixture = fileURLToPath(new URL('./fixtures/fake-claude-stream.mjs', import.meta.url));
  const project = () => {
    const path = folder();
    writeFileSync(join(path, 'README.md'), '# project');
    return path;
  };

  it('runs claude in the session\'s folder and streams its lines into the reply', async () => {
    const api = client(await start({ runners: { sideChat: spawnSideChat(process.execPath, [fixture]) } }));
    await api.turn(ROUND, SESSION, project());
    await api.ask(1, 1, 'Where?');
    expect((await settled(api))[0].turns[0]).toMatchObject({ reply: 'Ran forked.', files: ['README.md'], status: 'done', route: 'fork' });
  });

  it('starts a fresh claude when the session cannot be forked', async () => {
    const api = client(await start({ runners: { sideChat: spawnSideChat(process.execPath, [fixture]) } }));
    await api.turn(ROUND, SESSION, project());
    await api.ask(1, 1, 'Ask about no such session.');
    expect((await settled(api))[0].turns[0]).toMatchObject({ reply: 'Ran fresh.', status: 'done', route: 'fresh' });
  });
});
