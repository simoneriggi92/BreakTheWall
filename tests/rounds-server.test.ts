// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CWD, serverClient as client, SESSION, useLocalServers } from './local-server-harness';

const { folder, start } = useLocalServers();

const ROUND = `I read the server and the plugin. Two decisions are open.

❓ **Q1** - **Where do rounds live?**: The server keeps every round it receives.

It needs a folder that survives the plugin.

➡️ In the per-user data folder, outside the repository.

---

❓ **Q2** - **Who recognises a round?**: The mod or the server.

\`\`\`mermaid
graph LR
  mod --- server
\`\`\`

➡️ The server, where tests reach it.

Answer when you are ready.`;

describe('a round reaches the page (#95)', () => {
  it('recognises a round in the skill\'s format and shows its questions, recommendations and the turn\'s text', async () => {
    const api = client(await start());
    expect((await api.turn(ROUND)).status).toBe(200);
    const round = await api.round();
    expect(round).toMatchObject({
      session: SESSION,
      number: 1,
      turnText: 'I read the server and the plugin. Two decisions are open.\n\nAnswer when you are ready.',
      questions: [
        { number: 1, title: 'Where do rounds live?', body: 'The server keeps every round it receives.\n\nIt needs a folder that survives the plugin.', recommendation: 'In the per-user data folder, outside the repository.' },
        { number: 2, title: 'Who recognises a round?', body: 'The mod or the server.\n\n```mermaid\ngraph LR\n  mod --- server\n```', recommendation: 'The server, where tests reach it.' },
      ],
      sent: null,
    });
  });
});

describe('an open page learns of a new round at once (#95)', () => {
  it('answers the page\'s held poll as soon as a round arrives, not when the hold runs out', async () => {
    const api = client(await start({ pollHoldMs: 10_000 }));
    const poll = api.call('/api/page/poll');
    await new Promise(done => setTimeout(done, 50));
    const started = Date.now();
    await api.turn(ROUND);
    expect(await (await poll).json()).toEqual({ changed: true });
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('what is and is not a round (#95)', () => {
  it('shows nothing for a turn that asks no question in the skill\'s format', async () => {
    const api = client(await start());
    const reply = await api.turn('I changed the server. Q1 is settled: **Q1** was about storage.');
    expect(await reply.json()).toEqual({ round: null });
    expect(await api.round()).toBeNull();
  });

  it('does not take the format quoted inside a code block for a question', async () => {
    const api = client(await start());
    await api.turn('The skill asks this way:\n\n```\n❓ **Q1** - **<title>**: <body>\n\n➡️ <recommendation>\n```');
    expect(await api.round()).toBeNull();
  });

  it('still takes a question the agent gave no recommendation, so a missed format degrades the round and never breaks it', async () => {
    const api = client(await start());
    await api.turn('❓ **Q1** - **Keep the old store?**: It still holds drafts from the app.\n\n❓ **Q2** - **Rename it?**: Optional.\n\n➡️ Yes.');
    expect((await api.round()).questions).toEqual([
      { number: 1, title: 'Keep the old store?', body: 'It still holds drafts from the app.', recommendation: '' },
      { number: 2, title: 'Rename it?', body: 'Optional.', recommendation: 'Yes.' },
    ]);
  });

  it('numbers a session\'s rounds in the order they arrive, and shows the latest one', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn('❓ **Q1** - **One more thing?**: Last one.\n\n➡️ No.');
    expect(await api.round()).toMatchObject({ session: SESSION, number: 2, questions: [{ title: 'One more thing?' }] });
  });

  it('refuses a turn that names no valid session, or one whose session id could name another folder', async () => {
    const api = client(await start());
    expect((await api.call('/api/turns', { method: 'POST', body: { session: SESSION, text: ROUND } })).status).toBe(400);
    expect((await api.turn(ROUND, '../../escape')).status).toBe(400);
    expect((await api.call('/api/turns', { method: 'POST', body: 'not an object' })).status).toBe(400);
    expect(await api.round()).toBeNull();
  });

  it('refuses a turn without the secret', async () => {
    const server = await start();
    const reply = await fetch(`http://127.0.0.1:${server.port}/api/turns`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: SESSION, cwd: CWD, text: ROUND }) });
    expect(reply.status).toBe(401);
    expect(await client(server).round()).toBeNull();
  });
});

describe('rounds are kept on disk (#95)', () => {
  it('shows the same round after the server restarts on the same data folder', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    const before = await client(first).round();
    await first.stop();
    const second = await start({ dataDir });
    expect(await client(second).round()).toEqual(before);
  });

  it('ignores a round file that does not parse, and keeps serving the others', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    await first.stop();
    const broken = join(dataDir, 'projects', 'feedfacefeedface', SESSION);
    mkdirSync(broken, { recursive: true });
    writeFileSync(join(broken, 'round-9.json'), '{"version":1,"session":"x"}');
    const second = await start({ dataDir });
    const round = await client(second).round();
    expect(round.number).toBe(1);
    expect(round.questions[0].title).toBe('Where do rounds live?');
  });
});

const ANSWERED = {
  generalNote: 'Both look right; keep the first version small.',
  answers: {
    '1': { choice: 'recommendation', note: '' },
    '2': { choice: 'none', note: 'The mod should stay thin.\nIt cannot be tested.' },
  },
};

describe('the answers return to the session (#95)', () => {
  it('delivers one plain Markdown message: the general note on top, each question by number and title, the choice on its line, the note indented', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    const sent = await api.send(1, ANSWERED);
    expect(sent.status).toBe(200);
    expect(await api.delivery()).toBe([
      'Both look right; keep the first version small.',
      '',
      '**Q1 · Where do rounds live?** recommendation',
      '**Q2 · Who recognises a round?** no choice',
      '  The mod should stay thin.',
      '  It cannot be tested.',
    ].join('\n'));
  });

  it('sends a partial round, the questions left out reading "no answer", and a question answered only with a note', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.send(1, { generalNote: '', answers: { '2': { note: 'Ask me again after the spike.' } } });
    expect(await api.delivery()).toBe([
      '**Q1 · Where do rounds live?** no answer',
      '**Q2 · Who recognises a round?**',
      '  Ask me again after the spike.',
    ].join('\n'));
  });

  it('words the message in Italian when the page is in Italian', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.send(1, { generalNote: '', answers: { '1': { choice: 'recommendation', note: '' }, '2': { choice: 'none', note: '' } } }, 'it');
    expect(await api.delivery()).toBe('**Q1 · Where do rounds live?** raccomandazione\n**Q2 · Who recognises a round?** nessuna scelta');
  });

  it('hands the message to a long-poll already waiting when Send is pressed, once', async () => {
    const api = client(await start({ deliveryHoldMs: 500 }));
    await api.turn(ROUND);
    const waiting = api.delivery();
    await new Promise(done => setTimeout(done, 50));
    await api.send(1, ANSWERED);
    expect(await waiting).toContain('**Q1 · Where do rounds live?** recommendation');
    expect(await api.delivery()).toBeUndefined();
  });

  it('gives another session nothing', async () => {
    const api = client(await start({ deliveryHoldMs: 100 }));
    await api.turn(ROUND);
    await api.send(1, ANSWERED);
    expect(await api.delivery('c0ffee00-0000-4000-8000-000000000002')).toBeUndefined();
    expect(await api.delivery()).toContain('Both look right');
  });

  it('answers a long-poll with nothing once its hold runs out, below the mod\'s 30-second fetch limit', async () => {
    const api = client(await start({ deliveryHoldMs: 100 }));
    const started = Date.now();
    expect(await api.delivery()).toBeUndefined();
    expect(Date.now() - started).toBeGreaterThanOrEqual(90);
  });

  it('keeps a message no session took yet across a restart, and delivers it then', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    await client(first).send(1, ANSWERED);
    await first.stop();
    const second = await start({ dataDir });
    expect(await client(second).delivery()).toContain('Both look right');
  });
});

describe('a message is lost only once the mod confirms it submitted it (#95)', () => {
  const quick = { deliveryHoldMs: 100, deliveryLeaseMs: 200 };

  it('offers a message the mod took but never confirmed again once its lease runs out, as when the submit failed', async () => {
    const api = client(await start(quick));
    await api.turn(ROUND);
    await api.send(1, ANSWERED);
    const taken = await api.take();
    expect(taken).toMatchObject({ round: 1, message: expect.stringContaining('Both look right') });
    expect(await api.delivery()).toBeUndefined();
    await new Promise(done => setTimeout(done, quick.deliveryLeaseMs + 50));
    expect(await api.delivery()).toBe(taken.message);
  });

  it('never offers a confirmed message again, not after its lease and not after a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir, ...quick });
    await client(first).turn(ROUND);
    await client(first).send(1, ANSWERED);
    const taken = await client(first).take();
    expect((await client(first).confirm(taken.round!)).status).toBe(204);
    await new Promise(done => setTimeout(done, quick.deliveryLeaseMs + 50));
    expect(await client(first).delivery()).toBeUndefined();
    await first.stop();
    const second = await start({ dataDir, ...quick });
    expect(await client(second).delivery()).toBeUndefined();
  });

  it('refuses a confirmation for a round that sent nothing', async () => {
    const api = client(await start(quick));
    await api.turn(ROUND);
    expect((await api.confirm(1)).status).toBe(404);
    expect((await api.confirm(5)).status).toBe(404);
  });
});

describe('a sent round is a record (#95)', () => {
  it('shows the message exactly as delivered, and refuses a new draft or a second Send', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.send(1, ANSWERED);
    const delivered = await api.delivery();
    const round = await api.round();
    expect(round.sent.message).toBe(delivered);
    expect(round.draft).toEqual(ANSWERED);
    expect((await api.saveDraft(1, { generalNote: 'changed', answers: {} })).status).toBe(409);
    expect((await api.send(1, { generalNote: 'again', answers: {} })).status).toBe(409);
    expect((await api.round()).sent.message).toBe(delivered);
  });

  it('refuses answers to a round a later round of its session superseded', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn('❓ **Q1** - **One more thing?**: Last one.\n\n➡️ No.');
    expect((await api.send(1, ANSWERED)).status).toBe(409);
    expect((await api.saveDraft(1, ANSWERED)).status).toBe(409);
  });

  it('refuses a draft that is not one, and a round that does not exist', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    expect((await api.saveDraft(1, { answers: { '1': { choice: 'maybe', note: '' } } })).status).toBe(400);
    expect((await api.send(1, ANSWERED, 'fr')).status).toBe(400);
    expect((await api.saveDraft(7, ANSWERED)).status).toBe(404);
  });
});

describe('drafts are kept as they change (#95)', () => {
  it('saves a draft on every change and shows it again after a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    expect((await client(first).saveDraft(1, { generalNote: '', answers: { '1': { choice: 'recommendation', note: '' } } })).status).toBe(204);
    expect((await client(first).saveDraft(1, ANSWERED)).status).toBe(204);
    expect((await client(first).round()).draft).toEqual(ANSWERED);
    await first.stop();
    const second = await start({ dataDir });
    expect((await client(second).round()).draft).toEqual(ANSWERED);
    expect((await client(second).round()).sent).toBeNull();
  });
});
