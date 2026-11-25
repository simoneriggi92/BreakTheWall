// @vitest-environment node
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SideChatRun } from '../src/server/side-chats';
import { CWD, serverClient as client, SESSION, useLocalServers } from './local-server-harness';

const { folder, start } = useLocalServers();

const round = (title: string) => `Before you go on, one decision.

❓ **Q1** - **${title}**: It decides the rest.

➡️ The simple one.`;
const DRAFT = { generalNote: 'Answered after the terminal closed.', answers: { '1': { choice: 'recommendation', note: '' } } };

type Api = ReturnType<typeof client>;
const roundStates = async (api: Api) => (await api.history()).projects[0].sessions[0].rounds.map((x: { state: string }) => x.state);

/** A file standing for Claude Code's transcript of the session, which the mod names when it registers. */
function transcript() {
  const path = join(folder(), `${SESSION}.jsonl`);
  writeFileSync(path, '{}\n');
  return path;
}

const until = async (check: () => boolean | Promise<boolean>) => {
  for (let i = 0; i < 200; i++) { if (await check()) return; await new Promise(done => setTimeout(done, 10)); }
  throw new Error('the condition never held');
};

describe('answering a round of an ended session (#103)', () => {
  it('queues the answers for the session\'s id, shows them queued, and delivers them once it is resumed', async () => {
    const api = client(await start({ deliveryHoldMs: 50 }));
    await api.register();
    await api.turn(round('Where do rounds live?'));
    await api.end(SESSION, 'prompt_input_exit');
    expect((await api.send(1, DRAFT)).status).toBe(200);
    expect(await api.current()).toMatchObject({ kind: 'round', queued: true });
    expect(await roundStates(api)).toEqual(['queued']);

    // `claude --resume <id>` starts the session again under the same id: the mod registers it and polls for it.
    await api.register();
    expect(await api.current()).toMatchObject({ queued: false });
    const delivery = await api.take();
    expect(delivery).toEqual({ id: 'round-1', message: expect.stringContaining('Answered after the terminal closed.') });
    expect((await api.confirm('round-1')).status).toBe(204);
    expect(await roundStates(api)).toEqual(['sent']);
    expect(await api.take()).toEqual({});
  });

  it('keeps a queued answer across a restart, and delivers it when the session registers again', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    const api = client(first);
    await api.register();
    await api.turn(round('Where do rounds live?'));
    await api.end(SESSION, 'prompt_input_exit');
    await api.send(1, DRAFT);
    await first.stop();
    const again = client(await start({ dataDir, deliveryHoldMs: 50 }));
    expect(await roundStates(again)).toEqual(['queued']);
    await again.register();
    expect((await again.take()).id).toBe('round-1');
  });

  it('offers a message the ended session took but never confirmed at once when it is resumed', async () => {
    const api = client(await start({ deliveryHoldMs: 50 }));
    await api.register();
    await api.turn(round('Where do rounds live?'));
    await api.send(1, DRAFT);
    // The mod took it, then the terminal closed while `$.prompt.submit` still waited for the session.
    expect((await api.take()).id).toBe('round-1');
    await api.end(SESSION, 'prompt_input_exit');
    await api.register();
    expect((await api.take()).id).toBe('round-1');
  });

  it('queues a response to a free block of an ended session the same way', async () => {
    const api = client(await start({ deliveryHoldMs: 50 }));
    await api.register();
    await api.startPhase();
    await api.turn('Which folder did you mean?');
    await api.end(SESSION, 'prompt_input_exit');
    expect((await api.respond(1, 'The plugin folder.')).status).toBe(200);
    expect(await api.current()).toMatchObject({ kind: 'free', queued: true });
    await api.register();
    expect(await api.take()).toEqual({ id: 'free-1', message: 'The plugin folder.' });
  });

  it('opens and continues a side chat on a round of an ended session, forking it by its id', async () => {
    const runs: SideChatRun[] = [];
    const sideChat = async (run: SideChatRun) => {
      runs.push(run);
      run.onLine(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'From the session.' }));
      return { code: 0, stderr: '' };
    };
    const api = client(await start({ runners: { sideChat } }));
    await api.register();
    await api.turn(round('Where do rounds live?'));
    await api.end(SESSION, 'prompt_input_exit');
    expect((await api.ask(1, 1, 'Why there?')).status).toBe(202);
    await until(async () => (await api.sideChats(1)).sideChats[0]?.turns[0].status === 'done');
    expect((await api.ask(1, 1, 'And later?')).status).toBe(202);
    await until(() => runs.length === 2);
    expect(runs.map(x => x.args.slice(1, 4))).toEqual([['--resume', SESSION, '--fork-session'], ['--resume', SESSION, '--fork-session']]);
  });
});

describe('a session whose transcript Claude Code no longer keeps (#103)', () => {
  it('turns its rounds and side chats read-only, and keeps its history readable', async () => {
    const api = client(await start());
    const path = transcript();
    await api.register(SESSION, CWD, { transcript: path });
    await api.turn(round('Where do rounds live?'));
    await api.end(SESSION, 'prompt_input_exit');
    expect(await api.current()).toMatchObject({ transcriptGone: false });
    expect((await api.saveDraft(1, DRAFT)).status).toBe(204);

    rmSync(path);
    expect(await api.current()).toMatchObject({ kind: 'round', transcriptGone: true, round: { draft: DRAFT } });
    expect((await api.saveDraft(1, DRAFT)).status).toBe(409);
    expect((await api.send(1, DRAFT)).status).toBe(409);
    expect((await api.ask(1, 1, 'Why there?')).status).toBe(409);
    expect((await api.history()).projects[0].sessions[0]).toMatchObject({ transcriptGone: true, rounds: [{ number: 1, state: 'open' }] });
    expect(await (await api.pastRound(1)).json()).toMatchObject({ transcriptGone: true, round: { draft: DRAFT } });
    expect((await api.sideChats(1)).sideChats).toEqual([]);
  });

  it('remembers where the transcript was across a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    const api = client(first);
    const path = transcript();
    await api.register(SESSION, CWD, { transcript: path });
    await api.turn(round('Where do rounds live?'));
    await first.stop();
    rmSync(path);
    const again = client(await start({ dataDir }));
    expect(await again.current()).toMatchObject({ transcriptGone: true });
    expect((await again.saveDraft(1, DRAFT)).status).toBe(409);
  });

  it('leaves a session it was never told the transcript of answerable', async () => {
    const api = client(await start());
    await api.register(SESSION, CWD, { transcript: '' });
    await api.turn(round('Where do rounds live?'));
    expect(await api.current()).toMatchObject({ transcriptGone: false });
    expect((await api.saveDraft(1, DRAFT)).status).toBe(204);
  });
});

describe('deleting a session with a side chat still replying (#103)', () => {
  it('stops the reply and writes nothing back into the deleted folder', async () => {
    const dataDir = folder();
    const held: { run: SideChatRun; finish: () => void }[] = [];
    const sideChat = (run: SideChatRun) => new Promise<{ code: number; stderr: string }>(done => { held.push({ run, finish: () => done({ code: 0, stderr: '' }) }); });
    const api = client(await start({ dataDir, runners: { sideChat } }));
    await api.turn(round('Where do rounds live?'));
    await api.ask(1, 1, 'Why there?');
    await until(() => held.length === 1);
    expect((await api.deleteSession()).status).toBe(204);
    expect(held[0].run.signal.aborted).toBe(true);
    // A runner that does not stop at once still writes its last lines and exits.
    held[0].run.onLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: `${CWD}/a.ts` } }] } }));
    held[0].run.onLine(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Too late.' }));
    held[0].finish();
    await new Promise(done => setTimeout(done, 100));
    expect(readdirSync(dataDir, { recursive: true }).map(String).filter(x => x.includes('side-chat-'))).toEqual([]);
    // The same session and round number arriving again starts with no side chat.
    await api.turn(round('Where do rounds live?'));
    expect((await api.sideChats(1)).sideChats).toEqual([]);
  });
});
