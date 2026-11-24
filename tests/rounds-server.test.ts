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
      { number: 1, title: 'Keep the old store?', body: 'It still holds drafts from the app.', options: [], recommended: null, recommendation: '' },
      { number: 2, title: 'Rename it?', body: 'Optional.', options: [], recommended: null, recommendation: 'Yes.' },
    ]);
  });

  it('numbers a session\'s rounds in the order they arrive, and shows the latest one', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn('❓ **Q1** - **One more thing?**: Last one.\n\n➡️ No.');
    expect(await api.round()).toMatchObject({ session: SESSION, number: 2, questions: [{ title: 'One more thing?' }] });
  });

  it('ignores a subagent\'s report and a turn that did not end with an answer, even in the skill\'s format', async () => {
    const api = client(await start());
    expect(await (await api.turn(ROUND, SESSION, CWD, { agent: 'agent-7' })).json()).toEqual({ round: null });
    for (const reason of ['aborted', 'refusal', 'error']) expect(await (await api.turn(ROUND, SESSION, CWD, { reason })).json()).toEqual({ round: null });
    expect(await api.round()).toBeNull();
    expect((await api.turn(ROUND, SESSION, CWD, { reason: 'later' })).status).toBe(400);
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
    expect(taken).toMatchObject({ id: 'round-1', message: expect.stringContaining('Both look right') });
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
    expect((await client(first).confirm(taken.id!)).status).toBe(204);
    await new Promise(done => setTimeout(done, quick.deliveryLeaseMs + 50));
    expect(await client(first).delivery()).toBeUndefined();
    await first.stop();
    const second = await start({ dataDir, ...quick });
    expect(await client(second).delivery()).toBeUndefined();
  });

  it('refuses a confirmation for a round that sent nothing', async () => {
    const api = client(await start(quick));
    await api.turn(ROUND);
    expect((await api.confirm('round-1')).status).toBe(404);
    expect((await api.confirm('round-5')).status).toBe(404);
    expect((await api.confirm('free-1')).status).toBe(404);
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

const WITH_OPTIONS = `❓ **Q1** - **Where does the question live?**: The page needs one place to read it from.

- **(a)** In the turn: nothing to store, but gone after a restart.
- **(b)** **On disk**: survives a restart; one more folder to clean.
  Old rounds stay until history is cleared.
- **(c)** In the session: the agent keeps it.

⚠ Pick before the side chat lands.

➡️ **(b)**, since the page outlives the session.`;

describe('a question\'s options sit side by side (#96)', () => {
  it('reads the options list out of the body, each with its letter, label and consequence, and marks the recommended one', async () => {
    const api = client(await start());
    await api.turn(WITH_OPTIONS);
    expect((await api.round()).questions).toEqual([{
      number: 1,
      title: 'Where does the question live?',
      body: 'The page needs one place to read it from.\n\n⚠ Pick before the side chat lands.',
      options: [
        { letter: 'a', label: 'In the turn', consequence: 'nothing to store, but gone after a restart.' },
        { letter: 'b', label: 'On disk', consequence: 'survives a restart; one more folder to clean.\nOld rounds stay until history is cleared.' },
        { letter: 'c', label: 'In the session', consequence: 'the agent keeps it.' },
      ],
      recommended: 'b',
      recommendation: '**(b)**, since the page outlives the session.',
    }]);
  });

  it('reads a label the agent made bold together with its letter', async () => {
    const api = client(await start());
    await api.turn('❓ **Q1** - **Which?**: Pick.\n\n- **(a) Keep**: as is.\n- **(b) Drop** — gone.');
    expect((await api.round()).questions[0].options).toEqual([
      { letter: 'a', label: 'Keep', consequence: 'as is.' },
      { letter: 'b', label: 'Drop', consequence: 'gone.' },
    ]);
  });

  it('leaves a lone lettered line, a list with a repeated letter, and one inside a code block in the body', async () => {
    const api = client(await start());
    const lone = '❓ **Q1** - **One?**: Only this:\n\n- **(a)** Keep it: as is.\n\n➡️ (a).';
    const repeated = '❓ **Q2** - **Two?**: Twice:\n\n- **(a)** First: one.\n- **(a)** Again: two.';
    const fenced = '❓ **Q3** - **Three?**: Quoted:\n\n```\n- **(a)** First: one.\n- **(b)** Second: two.\n```';
    await api.turn([lone, repeated, fenced].join('\n\n---\n\n'));
    const questions = (await api.round()).questions;
    expect(questions.map((q: { options: unknown[]; recommended: unknown }) => [q.options, q.recommended])).toEqual([[[], null], [[], null], [[], null]]);
    expect(questions[0].body).toBe('Only this:\n\n- **(a)** Keep it: as is.');
    expect(questions[2].body).toBe('Quoted:\n\n```\n- **(a)** First: one.\n- **(b)** Second: two.\n```');
  });

  it('puts the picked option\'s letter on the question\'s title line', async () => {
    const api = client(await start());
    await api.turn(WITH_OPTIONS);
    await api.send(1, { generalNote: '', answers: { '1': { choice: 'c', note: 'The agent forgets less than I think.' } } });
    expect(await api.delivery()).toBe('**Q1 · Where does the question live?** (c)\n  The agent forgets less than I think.');
  });

  it('still reads a round kept before options existed, as a round without a list', async () => {
    const dataDir = folder();
    const kept = join(dataDir, 'projects', 'feedfacefeedface', SESSION);
    mkdirSync(kept, { recursive: true });
    writeFileSync(join(kept, 'round-1.json'), JSON.stringify({
      version: 1, session: SESSION, cwd: CWD, number: 1, receivedAt: '2026-11-20T10:00:00.000Z',
      round: { turnText: '', questions: [{ number: 1, title: 'Old?', body: 'Kept by #95.', recommendation: 'Yes.' }] },
      draft: { generalNote: '', answers: {} }, sent: null,
    }));
    const api = client(await start({ dataDir }));
    expect((await api.round()).questions).toEqual([{ number: 1, title: 'Old?', body: 'Kept by #95.', options: [], recommended: null, recommendation: 'Yes.' }]);
    expect((await api.saveDraft(1, { generalNote: '', answers: { '1': { choice: 'recommendation', note: '' } } })).status).toBe(204);
  });

  it('refuses a letter the question does not offer, and any letter on a question without options', async () => {
    const api = client(await start());
    await api.turn(WITH_OPTIONS);
    expect((await api.saveDraft(1, { generalNote: '', answers: { '1': { choice: 'd', note: '' } } })).status).toBe(400);
    expect((await api.send(1, { generalNote: '', answers: { '1': { choice: 'd', note: '' } } })).status).toBe(400);
    await api.turn(ROUND);
    expect((await api.saveDraft(2, { generalNote: '', answers: { '1': { choice: 'a', note: '' } } })).status).toBe(400);
    expect((await api.saveDraft(2, ANSWERED)).status).toBe(204);
  });
});

describe('remarks on a question\'s passage (#98)', () => {
  const remark = (part: string, start: number, passage: string, text: string) => ({ part, start, end: start + passage.length, passage, text });

  it('returns each remark indented under its question as «passage» — text, in the order the passages stand, after the note', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.send(1, {
      generalNote: '',
      answers: {
        '1': {
          choice: 'recommendation', note: 'Fine by me.',
          remarks: [
            remark('recommendation', 3, 'the per-user data folder', 'Which one on Linux?'),
            remark('body', 4, 'server keeps every round', 'Every one, forever?\nEven the superseded ones?'),
          ],
        },
        // Remarks are not an answer: the title line still reads "no answer". A remark with no words yet stays out.
        '2': { note: '', remarks: [remark('body', 4, 'mod  or\nthe server', 'Or both?'), remark('body', 0, 'The', '  \n ')] },
      },
    });
    expect(await api.delivery()).toBe([
      '**Q1 · Where do rounds live?** recommendation',
      '  Fine by me.',
      '  - «server keeps every round» — Every one, forever?',
      '    Even the superseded ones?',
      '  - «the per-user data folder» — Which one on Linux?',
      '**Q2 · Who recognises a round?** no answer',
      // A passage across lines reads as one line.
      '  - «mod or the server» — Or both?',
    ].join('\n'));
  });

  it('keeps remarks in the draft, across a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    const draft = { generalNote: '', answers: { '1': { note: '', remarks: [remark('body', 4, 'server', 'Which server?')] } } };
    expect((await client(first).saveDraft(1, draft)).status).toBe(204);
    await first.stop();
    expect((await client(await start({ dataDir })).round()).draft).toEqual(draft);
  });

  it('refuses a remark without a passage, one whose end is not after its start, and one on a question the round does not have', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    const refused = async (remarks: unknown[], question = '1') => (await api.saveDraft(1, { generalNote: '', answers: { [question]: { note: '', remarks } } })).status;
    expect(await refused([remark('body', 4, '  ', 'Blank.')])).toBe(400);
    expect(await refused([{ ...remark('body', 4, 'server', 'Backwards.'), end: 4 }])).toBe(400);
    expect(await refused([remark('title', 0, 'Where', 'Not a part.')])).toBe(400);
    expect(await refused([remark('body', 4, 'server', 'No such question.')], '9')).toBe(400);
    expect(await refused([remark('body', 4, 'server', 'Fine.')])).toBe(204);
  });
});

describe('side-chat replies attached to an answer (#101)', () => {
  const REPLY = 'Beside the rounds:\n\n```ts\nsessionFolder(projects, x)\n```\n\n  - one folder per session';

  it('returns each attached exchange whole and verbatim under its question, after the note and the remarks', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.send(1, {
      generalNote: '',
      answers: {
        '1': {
          choice: 'recommendation', note: 'Fine by me.',
          remarks: [{ part: 'body', start: 4, end: 28, passage: 'server keeps every round', text: 'Every one?' }],
          // Attached in any order, they return in the order they were asked.
          attached: [
            { turn: 3, ask: 'And on Linux?', passage: 'the per-user\ndata folder', reply: '`~/.config/Break the Wall`.' },
            { turn: 1, ask: 'Where exactly?\nIn the repository?', reply: REPLY },
          ],
        },
        // An attached reply alone is not an answer: the title line still reads "no answer".
        '2': { note: '', attached: [{ turn: 1, ask: 'Why the server?', reply: 'Tests reach it.' }] },
      },
    }, 'en');
    expect(await api.delivery()).toBe([
      '**Q1 · Where do rounds live?** recommendation',
      '  Fine by me.',
      '  - «server keeps every round» — Every one?',
      '  - Side chat — question: Where exactly?',
      '    In the repository?',
      '    reply: Beside the rounds:',
      '',
      '    ```ts',
      '    sessionFolder(projects, x)',
      '    ```',
      '',
      '      - one folder per session',
      '  - Side chat — question: «the per-user data folder» — And on Linux?',
      '    reply: `~/.config/Break the Wall`.',
      '**Q2 · Who recognises a round?** no answer',
      '  - Side chat — question: Why the server?',
      '    reply: Tests reach it.',
    ].join('\n'));
  });

  it('words the exchange in the page\'s language', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.send(1, { generalNote: '', answers: { '2': { note: '', attached: [{ turn: 1, ask: 'Perché il server?', reply: 'I test lo raggiungono.' }] } } }, 'it');
    expect(await api.delivery()).toBe([
      '**Q1 · Where do rounds live?** nessuna risposta',
      '**Q2 · Who recognises a round?** nessuna risposta',
      '  - Chat laterale — domanda: Perché il server?',
      '    risposta: I test lo raggiungono.',
    ].join('\n'));
  });

  it('keeps attached exchanges in the draft across a restart, and refuses one on a question the round does not have, or one turn twice', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    const draft = { generalNote: '', answers: { '1': { note: '', attached: [{ turn: 1, ask: 'Where?', reply: 'Here.' }] } } };
    expect((await client(first).saveDraft(1, draft)).status).toBe(204);
    await first.stop();
    const api = client(await start({ dataDir }));
    expect((await api.round()).draft).toEqual(draft);
    const refused = async (attached: unknown[], question = '1') => (await api.saveDraft(1, { generalNote: '', answers: { [question]: { note: '', attached } } })).status;
    expect(await refused([{ turn: 1, ask: 'Where?', reply: 'Here.' }], '9')).toBe(400);
    expect(await refused([{ turn: 1, ask: 'Where?', reply: 'Here.' }, { turn: 1, ask: 'Where?', reply: 'Here.' }])).toBe(400);
    expect(await refused([{ turn: 0, ask: 'Where?', reply: 'Here.' }])).toBe(400);
  });
});

const CLARIFICATION = 'Before the next round: do you mean the page or the terminal when you say "the view"?';

describe('a turn without a round, in the round phase, is a free block (#99)', () => {
  it('shows the turn\'s text after a round, and returns its response as one message', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null, free: 1 });
    expect(await api.current()).toMatchObject({ kind: 'free', phaseOpen: true });
    expect(await api.free()).toMatchObject({ session: SESSION, number: 1, text: CLARIFICATION, response: '', sent: null, superseded: false });
    const sent = await api.respond(1, 'The page.\nThe terminal stays for code.');
    expect(await sent.json()).toEqual({ message: 'The page.\nThe terminal stays for code.' });
    expect(await api.delivery()).toBe('The page.\nThe terminal stays for code.');
  });

  it('leaves a turn without a round in the terminal before the phase starts', async () => {
    const api = client(await start());
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null });
    expect(await api.current()).toBeNull();
  });

  it('ignores a subagent\'s report, an interrupted turn and an empty one: none is shown, none counts toward the end', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    expect(await (await api.turn(CLARIFICATION, SESSION, CWD, { agent: 'agent-7' })).json()).toEqual({ round: null });
    expect(await (await api.turn(CLARIFICATION, SESSION, CWD, { reason: 'aborted' })).json()).toEqual({ round: null });
    expect(await (await api.turn('  \n')).json()).toEqual({ round: null });
    expect(await api.round()).toMatchObject({ number: 1, superseded: false });
    for (const n of [1, 2, 3]) expect(await (await api.turn(`${CLARIFICATION} (${n})`)).json()).toEqual({ round: null, free: n });
  });

  it('keeps each session\'s phase apart', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    expect(await (await api.turn(CLARIFICATION, 'c0ffee00-0000-4000-8000-000000000002')).json()).toEqual({ round: null });
  });
});

describe('the round phase starts at the injection marker (#99)', () => {
  it('shows a turn without a round as a free block once the plugin asked a skill for rounds, before any round', async () => {
    const api = client(await start());
    expect((await api.startPhase()).status).toBe(204);
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null, free: 1 });
    expect(await api.current()).toMatchObject({ kind: 'free', phaseOpen: true, block: { text: CLARIFICATION } });
  });

  it('refuses a marker with no working directory, or for a session id that could name another folder', async () => {
    const api = client(await start());
    expect((await api.call(`/api/sessions/${SESSION}/phase`, { method: 'POST', body: {} })).status).toBe(400);
    expect((await api.startPhase('..')).status).toBe(404);
  });
});

describe('the round phase ends (#99)', () => {
  it('ends after three turns in a row without a round: the third is still a free block, the fourth stays in the terminal', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    for (const n of [1, 2]) {
      expect(await (await api.turn(`${CLARIFICATION} (${n})`)).json()).toEqual({ round: null, free: n });
      expect(await api.current()).toMatchObject({ phaseOpen: true });
    }
    expect(await (await api.turn(`${CLARIFICATION} (3)`)).json()).toEqual({ round: null, free: 3 });
    expect(await api.current()).toMatchObject({ kind: 'free', phaseOpen: false, block: { number: 3, superseded: false } });
    expect(await (await api.turn('Now I write the code.')).json()).toEqual({ round: null });
    // The last free block still takes its response: the agent is waiting on it.
    expect((await api.respond(3, 'Go on.')).status).toBe(200);
  });

  it('counts the turns in a row: a round in between starts the count again', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn(CLARIFICATION);
    await api.turn(CLARIFICATION);
    await api.turn(ROUND);
    for (const n of [3, 4, 5]) expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null, free: n });
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null });
  });

  it('opens again at the next round', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    for (let n = 0; n < 4; n++) await api.turn(CLARIFICATION);
    await api.turn(ROUND);
    expect(await api.current()).toMatchObject({ kind: 'round', phaseOpen: true });
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null, free: 4 });
  });

  it('ends when the person ends it from the page, and the next turn without a round stays in the terminal', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    expect((await api.endPhase()).status).toBe(204);
    expect(await api.current()).toMatchObject({ kind: 'round', phaseOpen: false });
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null });
    // The round shown is still the one the agent waits on.
    expect((await api.send(1, ANSWERED)).status).toBe(200);
  });

  it('tells an open page at once that the phase ended', async () => {
    const api = client(await start({ pollHoldMs: 10_000 }));
    await api.turn(ROUND);
    const poll = api.call('/api/page/poll');
    await new Promise(done => setTimeout(done, 50));
    await api.endPhase();
    expect(await (await poll).json()).toEqual({ changed: true });
  });

  it('refuses to end the phase of a session the page never showed', async () => {
    const api = client(await start());
    expect((await api.endPhase()).status).toBe(404);
  });

  it('keeps the phase and its count across a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    await client(first).turn(CLARIFICATION);
    await client(first).turn(CLARIFICATION);
    await first.stop();
    const api = client(await start({ dataDir }));
    expect(await api.current()).toMatchObject({ kind: 'free', phaseOpen: true, block: { number: 2 } });
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null, free: 3 });
    expect(await (await api.turn(CLARIFICATION)).json()).toEqual({ round: null });
  });
});

describe('a free block takes one response (#99)', () => {
  it('keeps the response as it is typed, across a restart', async () => {
    const dataDir = folder();
    const first = await start({ dataDir });
    await client(first).turn(ROUND);
    await client(first).turn(CLARIFICATION);
    expect((await client(first).saveResponse(1, 'The page, I think')).status).toBe(204);
    await first.stop();
    expect(await client(await start({ dataDir })).free()).toMatchObject({ number: 1, response: 'The page, I think', sent: null });
  });

  it('shows the message as delivered once sent, and refuses a new response or a second Send', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn(CLARIFICATION);
    await api.respond(1, '  The page.  ');
    expect(await api.free()).toMatchObject({ response: '  The page.  ', sent: { message: 'The page.' } });
    expect((await api.saveResponse(1, 'again')).status).toBe(409);
    expect((await api.respond(1, 'again')).status).toBe(409);
  });

  it('refuses an empty response, a response that is not one, and a free block that does not exist', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn(CLARIFICATION);
    expect((await api.respond(1, ' \n ')).status).toBe(400);
    expect((await api.call(`/api/free/${SESSION}/1/send`, { method: 'POST', body: { response: 3 } })).status).toBe(400);
    expect((await api.respond(2, 'Yes.')).status).toBe(404);
    expect((await api.saveResponse(2, 'Yes.')).status).toBe(404);
  });

  it('is superseded by the session\'s next round or free block, and a free block supersedes the round before it', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn(CLARIFICATION);
    expect((await api.send(1, ANSWERED)).status).toBe(409);
    await api.turn('And one more thing: is the terminal ever the main surface?');
    expect((await api.respond(1, 'Yes.')).status).toBe(409);
    await api.turn(ROUND);
    expect(await api.round()).toMatchObject({ number: 2, superseded: false });
    expect((await api.respond(2, 'No.')).status).toBe(409);
  });

  it('goes out in the order the session asked, and is confirmed by its own id', async () => {
    const api = client(await start({ deliveryHoldMs: 100, deliveryLeaseMs: 200 }));
    await api.turn(ROUND);
    await api.turn(CLARIFICATION);
    await api.respond(1, 'The page.');
    const taken = await api.take();
    expect(taken).toEqual({ id: 'free-1', message: 'The page.' });
    expect((await api.confirm('free-1')).status).toBe(204);
    await new Promise(done => setTimeout(done, 250));
    expect(await api.delivery()).toBeUndefined();
  });
});

describe('a response is sent as text, never as a command (#99)', () => {
  it('escapes a leading / or ! in a free block\'s response, so Claude Code runs no command, skill or shell', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.turn(CLARIFICATION);
    expect(await (await api.respond(1, '/clear the old notes first')).json()).toEqual({ message: '\\/clear the old notes first' });
    await api.turn(CLARIFICATION);
    expect(await (await api.respond(2, '  !rm is not what I meant')).json()).toEqual({ message: '\\!rm is not what I meant' });
  });

  it('escapes a round\'s message that would start with /, and leaves a / inside the text alone', async () => {
    const api = client(await start());
    await api.turn(ROUND);
    await api.send(1, { generalNote: '/grilling again after this', answers: { '1': { choice: 'recommendation', note: '' } } });
    const message = await api.delivery();
    expect(message?.split('\n')[0]).toBe('\\/grilling again after this');
    await api.turn(ROUND);
    await api.send(2, { generalNote: 'Use /grilling again', answers: {} });
    expect((await api.delivery())?.split('\n')[0]).toBe('Use /grilling again');
  });
});
