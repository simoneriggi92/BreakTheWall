// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CWD, serverClient as client, SESSION, useLocalServers } from './local-server-harness';

const { folder, start } = useLocalServers();

const OTHER = 'c0ffee00-0000-4000-8000-000000000002';
const OTHER_CWD = '/work/other-project';
const round = (title: string) => `Before you go on, one decision.

❓ **Q1** - **${title}**: It decides the rest.

➡️ The simple one.`;

describe('one page serves every session of every project (#102)', () => {
  it('lists each project with its sessions and their numbered rounds, and shows the latest round whatever its session', async () => {
    const api = client(await start());
    await api.register(SESSION, CWD);
    await api.register(OTHER, OTHER_CWD);
    await api.turn(round('Where do rounds live?'), SESSION, CWD);
    await api.turn(round('Who recognises a round?'), SESSION, CWD);
    await api.turn(round('Which page?'), OTHER, OTHER_CWD);
    expect(await api.round()).toMatchObject({ session: OTHER, number: 1 });
    const { projects } = await api.history();
    expect(projects).toEqual([
      { cwd: OTHER_CWD, sessions: [{ session: OTHER, startedAt: expect.any(String), live: true, skill: null, ticket: null, transcriptGone: false, rounds: [{ number: 1, receivedAt: expect.any(String), state: 'open' }] }] },
      { cwd: CWD, sessions: [{ session: SESSION, startedAt: expect.any(String), live: true, skill: null, ticket: null, transcriptGone: false, rounds: [
        { number: 1, receivedAt: expect.any(String), state: 'superseded' },
        { number: 2, receivedAt: expect.any(String), state: 'open' },
      ] }] },
    ]);
  });

  it('moves a session /clear or /resume replaced to history as ended, and follows the new id the mod registers', async () => {
    const api = client(await start());
    await api.register(SESSION, CWD);
    await api.turn(round('Where do rounds live?'), SESSION, CWD);
    expect((await api.end(SESSION, 'clear')).status).toBe(204);
    await api.register(OTHER, CWD);
    await api.turn(round('Which page?'), OTHER, CWD);
    expect(await api.round()).toMatchObject({ session: OTHER, number: 1 });
    const [project] = (await api.history()).projects;
    expect(project.sessions.map((x: { session: string; live: boolean }) => [x.session, x.live])).toEqual([[OTHER, true], [SESSION, false]]);
  });

  it('shows an ended session live again when it is resumed and registers once more', async () => {
    const api = client(await start());
    await api.register(SESSION, CWD);
    await api.turn(round('Where do rounds live?'), SESSION, CWD);
    await api.end(SESSION, 'prompt_input_exit');
    expect((await api.history()).projects[0].sessions[0].live).toBe(false);
    await api.register(SESSION, CWD);
    expect((await api.history()).projects[0].sessions[0].live).toBe(true);
  });

  it('refuses an end with no reason, or for a session id that could name another folder', async () => {
    const api = client(await start());
    expect((await api.end(SESSION, '')).status).toBe(400);
    expect((await api.call(`/api/sessions/${SESSION}/end`, { method: 'POST', body: {} })).status).toBe(400);
    expect((await api.end('..%2Fescape', 'clear')).status).toBe(404);
  });
});

describe('a past round from the history column (#102)', () => {
  it('opens an earlier round of a session read-only with its draft, and only the latest takes answers', async () => {
    const api = client(await start());
    await api.turn(round('Where do rounds live?'));
    const draft = { generalNote: 'Half way.', answers: { '1': { choice: 'recommendation', note: 'Fine by me.' } } };
    expect((await api.saveDraft(1, draft)).status).toBe(204);
    await api.turn(round('Who recognises a round?'));
    const reply = await api.pastRound(1);
    expect(reply.status).toBe(200);
    expect(await reply.json()).toMatchObject({ kind: 'round', phaseOpen: true, round: { session: SESSION, number: 1, draft, superseded: true, sent: null, questions: [{ title: 'Where do rounds live?' }] } });
    expect((await api.saveDraft(1, draft)).status).toBe(409);
    expect(await (await api.pastRound(2)).json()).toMatchObject({ round: { number: 2, superseded: false } });
    expect((await api.saveDraft(2, draft)).status).toBe(204);
  });

  it('answers 404 for a round that does not exist, or a session id that could name another folder', async () => {
    const api = client(await start());
    await api.turn(round('Where do rounds live?'));
    expect((await api.pastRound(2)).status).toBe(404);
    expect((await api.pastRound(1, 'c0ffee00-0000-4000-8000-00000000dead')).status).toBe(404);
    expect((await api.pastRound(1, '..%2Fescape')).status).toBe(404);
  });
});

describe('the person decides what is kept (#102)', () => {
  it('deletes a session from the page, with its rounds, drafts and waiting messages, for good', async () => {
    const dataDir = folder();
    const first = await start({ dataDir, deliveryHoldMs: 50 });
    const api = client(first);
    await api.turn(round('Where do rounds live?'), SESSION, CWD);
    await api.send(1, { generalNote: 'Waiting for the session.', answers: {} });
    await api.turn(round('Which page?'), OTHER, OTHER_CWD);
    expect((await api.deleteSession(SESSION)).status).toBe(204);
    expect((await api.history()).projects.map((x: { cwd: string }) => x.cwd)).toEqual([OTHER_CWD]);
    expect((await api.pastRound(1, SESSION)).status).toBe(404);
    expect(await api.take(SESSION)).toEqual({});
    await first.stop();
    const again = client(await start({ dataDir }));
    expect((await again.history()).projects.map((x: { cwd: string }) => x.cwd)).toEqual([OTHER_CWD]);
    expect((await again.pastRound(1, SESSION)).status).toBe(404);
    expect(await again.round()).toMatchObject({ session: OTHER });
  });

  it('shows nothing once the only session is deleted, and answers 404 for a session it does not keep', async () => {
    const api = client(await start());
    await api.turn(round('Where do rounds live?'));
    expect((await api.deleteSession()).status).toBe(204);
    expect(await api.current()).toBeNull();
    expect((await api.deleteSession()).status).toBe(404);
    expect((await api.deleteSession('..%2Fescape')).status).toBe(404);
  });

  it('cleans nothing up by itself: an ended session keeps its rounds and drafts across idle time and a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir, sessionTtlMs: 20 });
    const api = client(first);
    await api.register();
    await api.turn(round('Where do rounds live?'));
    const draft = { generalNote: 'Kept.', answers: {} };
    await api.saveDraft(1, draft);
    await api.turn(round('Who recognises a round?'));
    await new Promise(done => setTimeout(done, 60));
    const before = await api.history();
    expect(before.projects[0].sessions[0]).toMatchObject({ live: false, rounds: [{ number: 1, state: 'superseded' }, { number: 2, state: 'open' }] });
    await first.stop();
    const again = client(await start({ dataDir }));
    expect(await again.history()).toEqual(before);
    expect(await (await again.pastRound(1)).json()).toMatchObject({ round: { draft, superseded: true } });
  });
});

describe('what a session began with (#102)', () => {
  it('names a session by the round skill that first marked it, and the ticket its arguments name, across a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    const api = client(first);
    expect((await api.startPhase(SESSION, CWD, { skill: 'mattpocock-skills:grill-with-docs', args: 'the history column, #102' })).status).toBe(204);
    await api.turn(round('Where do rounds live?'));
    await api.startPhase(SESSION, CWD, { skill: 'grilling', args: '#7' });
    await api.startPhase(OTHER, OTHER_CWD, { skill: '/grill-me', args: '' });
    await api.turn(round('Which page?'), OTHER, OTHER_CWD);
    const labels = async (x: typeof api) => (await x.history()).projects.flatMap((p: { sessions: { session: string; skill: string | null; ticket: number | null }[] }) => p.sessions.map(y => [y.session, y.skill, y.ticket]));
    expect(await labels(api)).toEqual([[OTHER, 'grill-me', null], [SESSION, 'grill-with-docs', 102]]);
    await first.stop();
    expect(await labels(client(await start({ dataDir })))).toEqual([[OTHER, 'grill-me', null], [SESSION, 'grill-with-docs', 102]]);
  });

  it('leaves a session without a marker unnamed, and refuses a skill name that is not one', async () => {
    const api = client(await start());
    await api.startPhase();
    await api.turn(round('Where do rounds live?'));
    expect((await api.history()).projects[0].sessions[0]).toMatchObject({ skill: null, ticket: null });
    expect((await api.startPhase(SESSION, CWD, { skill: 'x'.repeat(300) })).status).toBe(400);
  });

  it('forgets the name of a deleted session', async () => {
    const api = client(await start());
    await api.startPhase(SESSION, CWD, { skill: 'grilling', args: '#9' });
    await api.turn(round('Where do rounds live?'));
    await api.deleteSession();
    await api.turn(round('Where do rounds live?'));
    expect((await api.history()).projects[0].sessions[0]).toMatchObject({ skill: null, ticket: null });
  });
});

describe('an update that waits for the other sessions (#102)', () => {
  it('tells an open page at once that a newer version waits, and names it in the history', async () => {
    const api = client(await start({ pollHoldMs: 10_000 }));
    expect((await api.history()).update).toBeNull();
    const poll = api.call('/api/page/poll');
    await new Promise(done => setTimeout(done, 50));
    expect((await api.updateWaits('0.7.0')).status).toBe(204);
    expect(await (await poll).json()).toEqual({ changed: true });
    expect((await api.history()).update).toBe('0.7.0');
    expect((await api.updateWaits('')).status).toBe(400);
  });

  it('lists the live sessions in its status, so a newer launcher knows whether others still use it', async () => {
    const api = client(await start());
    await api.register(SESSION, CWD);
    await api.register(OTHER, OTHER_CWD);
    await api.end(OTHER);
    expect(await (await api.call('/api/status')).json()).toMatchObject({ sessions: [SESSION] });
  });
});

