// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BAKERY } from './explorations';
import { serverClient, SESSION, useLocalServers } from './local-server-harness';

/**
 * Remarks on a handed-over spec (#105), driven over the server's HTTP API (seam ① of #92): one Send returns them to
 * the session as the person's words asking for a round, a round awaiting answers carries them, and a superseded
 * version's unsent remarks go out in their own group.
 */
const { start, folder } = useLocalServers();

type Api = ReturnType<typeof serverClient>;
const OTHER = 'c0ffee00-0000-4000-8000-000000000002';

function project(files: Record<string, string>) {
  const cwd = folder();
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(cwd, path, '..'), { recursive: true });
    writeFileSync(join(cwd, path), text);
  }
  return cwd;
}
const handover = (location: string) => `The spec is written.\n\nSpec: ${location}`;
/** The handover time as the message words it: the day and the minute, on this machine's clock. */
function minute(iso: string) {
  const d = new Date(iso), two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
/** A session that handed over `docs/spec.md` and is live: the spec's newest version. */
async function handedOver(api: Api, cwd: string, session = SESSION) {
  await api.register(session, cwd);
  await api.turn(handover('docs/spec.md'), session, cwd);
  return (await api.specs())[0];
}
const quote = (version: number, from: number, to: number, passage: string, text: string) => ({ version, from, to, passage, text });
const gap = (version: number, from: number, to: number, text: string) => ({ version, from, to, missing: true, text });

describe('one Send returns every remark on the spec as a request for a round (#105)', () => {
  it('starts with the fixed lines, then the general note, then each remark by line, a gap as "(missing here)"', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start({ deliveryHoldMs: 50 }));
    const spec = await handedOver(api, cwd);
    const draft = {
      generalNote: 'The selling half is thin.',
      remarks: [
        quote(1, 12, 12, 'The oven thermometer drifts by ten degrees.', 'Who recalibrates it?'),
        gap(1, 15, 16, 'Nothing says when the shop opens.'),
        quote(1, 4, 4, 'Bread left out loses water', 'Is this needed?\nIt reads as background.'),
        quote(1, 6, 6, 'The dough', ''),
      ],
    };
    expect((await api.saveRemarks(spec.id, draft)).status).toBe(204);
    const sent = await api.sendRemarks(spec.id, draft);
    expect(sent.status).toBe(200);
    const message = [
      `Remarks on the spec «The night bakery» (docs/spec.md), version handed over on ${minute(spec.handedOverAt)}. Don't edit it yet: ask me what you need, in a round. When you revise the spec, end with the line \`Spec: docs/spec.md\` and keep each statement's backing.`,
      '',
      'The selling half is thin.',
      '',
      '- line 4 «Bread left out loses water» — Is this needed?',
      '  It reads as background.',
      '- line 12 «The oven thermometer drifts by ten degrees.» — Who recalibrates it?',
      '- lines 15–16 (missing here) — Nothing says when the shop opens.',
    ].join('\n');
    expect(await sent.json()).toEqual({ message });
    expect(await api.take()).toEqual({ id: 'remarks-1', message });
    expect((await api.confirm('remarks-1')).status).toBe(204);
    expect(await api.take()).toEqual({});
  });

  it('words the fixed lines in Italian when the page is in Italian', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const spec = await handedOver(api, cwd);
    const draft = { generalNote: '', remarks: [quote(1, 4, 5, 'loses water', 'Perché?'), gap(1, 9, 9, 'Manca il sale.')] };
    expect(await (await api.sendRemarks(spec.id, draft, 'it')).json()).toEqual({ message: [
      `Osservazioni sulla specifica «The night bakery» (docs/spec.md), versione consegnata il ${minute(spec.handedOverAt)}. Non modificarla ancora: chiedimi ciò che ti serve, in un round. Quando rivedi la specifica, chiudi con la riga \`Spec: docs/spec.md\` e mantieni il fondamento di ogni affermazione.`,
      '',
      '- righe 4–5 «loses water» — Perché?',
      '- riga 9 (manca qui) — Manca il sale.',
    ].join('\n') });
  });
});

describe('sent remarks stay as sent (#105)', () => {
  it('keeps what was sent read-only, leaves remarks without words in the draft, and keeps both across a restart', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const dataDir = folder();
    const first = await start({ dataDir });
    const api = serverClient(first);
    const spec = await handedOver(api, cwd);
    const marked = quote(1, 8, 8, 'cold room', '');
    const draft = { generalNote: 'One more thing.', remarks: [quote(1, 4, 4, 'loses water', 'Why?'), marked] };
    await api.saveRemarks(spec.id, draft);
    await api.sendRemarks(spec.id, draft);
    await first.stop();

    const again = serverClient(await start({ dataDir }));
    expect(await again.remarks(spec.id)).toEqual({
      draft: { generalNote: '', remarks: [marked] },
      sent: [{ at: expect.any(String), generalNote: 'One more thing.', remarks: [draft.remarks[0]], round: null, session: SESSION, queued: true }],
      approvals: [],
      rides: null,
      transcriptGone: false,
    });
    // Nothing with words is left: there is nothing to send.
    expect((await again.sendRemarks(spec.id, { generalNote: '', remarks: [marked] })).status).toBe(400);
  });

  it('keeps a save that left before the Send from bringing sent remarks back into the draft', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const spec = await handedOver(api, cwd);
    const asked = quote(1, 4, 4, 'loses water', 'Why?');
    const draft = { generalNote: 'One more thing.', remarks: [asked] };
    expect((await api.sendRemarks(spec.id, draft)).status).toBe(200);
    // The page's save of the same draft, in flight when Send went out, lands after it.
    const late = quote(1, 8, 8, 'cold room', 'And this?');
    expect((await api.saveRemarks(spec.id, { generalNote: 'One more thing.', remarks: [asked, late] })).status).toBe(204);
    expect((await api.remarks(spec.id)).draft).toEqual({ generalNote: '', remarks: [late] });
    // What goes out next is only what was not sent yet.
    expect((await (await api.sendRemarks(spec.id, (await api.remarks(spec.id)).draft)).json()).message).not.toContain('loses water');
  });

  it('refuses a remark outside the version\'s lines, on a version the spec does not have, or on an id that names no spec', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const spec = await handedOver(api, cwd);
    expect((await api.saveRemarks(spec.id, { generalNote: '', remarks: [quote(1, 19, 20, 'Loaf', 'x')] })).status).toBe(400);
    expect((await api.saveRemarks(spec.id, { generalNote: '', remarks: [quote(2, 1, 1, 'The', 'x')] })).status).toBe(400);
    expect((await api.saveRemarks(spec.id, { generalNote: '', remarks: [{ version: 1, from: 1, to: 1, passage: 'x', missing: true, text: '' }] })).status).toBe(400);
    expect((await api.saveRemarks('spec-0000000000000000-1', { generalNote: '', remarks: [] })).status).toBe(404);
  });
});

const ROUND = `One decision before I revise it.

❓ **Q1** - **Where does the shop's opening time live?**: In the spec or in the till's settings.

➡️ In the spec.`;

describe('remarks written while a round awaits answers ride in its message (#105)', () => {
  it('shows them under "what the agent receives", sends them after the answers, and marks them sent with the round', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start({ deliveryHoldMs: 50 }));
    const spec = await handedOver(api, cwd);
    await api.turn(ROUND, SESSION, cwd);
    const draft = { generalNote: '', remarks: [gap(1, 15, 16, 'When does the shop open?')] };
    await api.saveRemarks(spec.id, draft);
    // The spec's own Send gives way to the round's.
    expect(await (await api.sendRemarks(spec.id, draft)).json()).toEqual({ error: 'rides', round: 1 });
    expect((await api.remarks(spec.id)).rides).toBe(1);
    const section = `Remarks on the spec «The night bakery» (docs/spec.md), version handed over on ${minute(spec.handedOverAt)}. Don't edit it yet: ask me what you need, in a round. When you revise the spec, end with the line \`Spec: docs/spec.md\` and keep each statement's backing.

- lines 15–16 (missing here) — When does the shop open?`;
    expect((await api.current()).riding).toEqual([expect.objectContaining({ title: 'The night bakery', draft })]);

    const sent = await (await api.send(1, { generalNote: '', answers: { '1': { choice: 'recommendation', note: '' } } })).json();
    expect(sent.message).toBe(`**Q1 · Where does the shop's opening time live?** recommendation\n\n${section}`);
    expect(await api.take()).toEqual({ id: 'round-1', message: sent.message });
    expect(await api.remarks(spec.id)).toMatchObject({ draft: { generalNote: '', remarks: [] }, sent: [{ round: 1, remarks: draft.remarks }], rides: null });
  });

  it('rides only with a round of the session that handed the spec over', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const spec = await handedOver(api, cwd);
    await api.register(OTHER, cwd);
    await api.turn(ROUND, OTHER, cwd);
    const draft = { generalNote: 'Alone.', remarks: [] };
    expect((await api.sendRemarks(spec.id, draft)).status).toBe(200);
    expect((await api.send(1, { generalNote: '', answers: {} }, 'en', OTHER).then(x => x.json())).message).not.toContain('Remarks on the spec');
  });
});

describe('remarks on a superseded version (#105)', () => {
  it('take no new remark, stay sendable, and go out grouped by version, each group with its own header', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const older = await handedOver(api, cwd);
    const onOlder = quote(1, 12, 12, 'drifts by ten degrees', 'Still true?');
    await api.saveRemarks(older.id, { generalNote: '', remarks: [onOlder] });
    writeFileSync(join(cwd, 'docs/spec.md'), BAKERY.replace('Loaf 2, roll 1.', 'Loaf 3, roll 1.'));
    await api.turn(handover('./docs/spec.md'), SESSION, cwd);
    const [newer] = await api.specs();
    expect(newer.number).toBe(2);

    // The same draft is read from either version.
    expect((await api.remarks(newer.id)).draft.remarks).toEqual([onOlder]);
    expect((await api.saveRemarks(newer.id, { generalNote: '', remarks: [onOlder, quote(1, 4, 4, 'loses water', 'New on old text')] })).status).toBe(409);
    const draft = { generalNote: 'Read both.', remarks: [quote(2, 19, 19, 'Loaf 3', 'Why dearer?'), { ...onOlder, text: 'Still true now?' }] };
    expect((await api.saveRemarks(newer.id, draft)).status).toBe(204);
    expect(await (await api.sendRemarks(newer.id, draft)).json()).toEqual({ message: [
      `Remarks on the spec «The night bakery» (docs/spec.md), version handed over on ${minute(older.handedOverAt)}. Don't edit it yet: ask me what you need, in a round. When you revise the spec, end with the line \`Spec: ./docs/spec.md\` and keep each statement's backing.`,
      '',
      'Read both.',
      '',
      '- line 12 «drifts by ten degrees» — Still true now?',
      '',
      `Remarks on the spec «The night bakery» (./docs/spec.md), version handed over on ${minute(newer.handedOverAt)}.`,
      '',
      '- line 19 «Loaf 3» — Why dearer?',
    ].join('\n') });
  });
});

describe('remarks to an ended session (#105)', () => {
  it('are queued like answers, shown queued, and delivered once the session is resumed', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start({ deliveryHoldMs: 50 }));
    const spec = await handedOver(api, cwd);
    await api.end(SESSION, 'prompt_input_exit');
    const draft = { generalNote: '', remarks: [quote(1, 4, 4, 'loses water', 'Why?')] };
    expect((await api.sendRemarks(spec.id, draft)).status).toBe(200);
    expect((await api.remarks(spec.id)).sent).toEqual([expect.objectContaining({ queued: true })]);

    await api.register(SESSION, cwd);
    expect((await api.remarks(spec.id)).sent).toEqual([expect.objectContaining({ queued: false })]);
    const delivery = await api.take();
    expect(delivery).toEqual({ id: 'remarks-1', message: expect.stringContaining('- line 4 «loses water» — Why?') });
    expect((await api.confirm('remarks-1')).status).toBe(204);
    expect(await api.take()).toEqual({});
  });
});

/** A spec that declares its backing: one statement backed, two unbacked, one whose file is not there. */
const FLAGGED = [
  '# The night bakery',
  '',
  '- The dough rests overnight. docs/notes.md:1',
  '- The thermometer drifts.',
  '- Customers pay at the till.',
  '- Loaf 2, roll 1. docs/prices.md:1-2',
  '',
].join('\n');

describe('Approve returns one fixed message to the session (#132)', () => {
  it('names the spec, its location and the version\'s handover time, and nothing else when nothing is flagged', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start({ deliveryHoldMs: 50 }));
    const spec = await handedOver(api, cwd);
    const approved = await api.approve(spec.id, 1);
    expect(approved.status).toBe(200);
    const message = `I approve the spec «The night bakery» (docs/spec.md), version handed over on ${minute(spec.handedOverAt)}: it is ready as it is. Don't start a next step: I will ask for it.`;
    expect(await approved.json()).toEqual({ message });
    expect(await api.take()).toEqual({ id: 'remarks-1', message });
  });

  it('adds the counts of unbacked and broken statements the backing check finds when approving', async () => {
    const cwd = project({ 'docs/spec.md': FLAGGED, 'docs/notes.md': 'Rest it overnight.\n' });
    const api = serverClient(await start({ deliveryHoldMs: 50 }));
    const spec = await handedOver(api, cwd);
    const message = (await (await api.approve(spec.id, 1)).json()).message;
    expect(message).toBe(`I approve the spec «The night bakery» (docs/spec.md), version handed over on ${minute(spec.handedOverAt)}: it is ready as it is, with 2 unbacked statements and 1 statement with broken backing. Don't start a next step: I will ask for it.`);
    expect((await api.take()).message).toBe(message);
  });

  it('words it in Italian when the page is in Italian, one of each flag in the singular', async () => {
    const cwd = project({ 'docs/spec.md': FLAGGED.replace('- The thermometer drifts.\n', ''), 'docs/notes.md': 'Rest it overnight.\n' });
    const api = serverClient(await start());
    const spec = await handedOver(api, cwd);
    expect(await (await api.approve(spec.id, 1, 'it')).json()).toEqual({
      message: `Approvo la specifica «The night bakery» (docs/spec.md), versione consegnata il ${minute(spec.handedOverAt)}: è pronta così com'è, con 1 affermazione senza fondamento e 1 affermazione con fondamento non trovato. Non avviare un passo successivo: te lo chiederò io.`,
    });
  });

  it('refuses a body that is not a version and a language', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const spec = await handedOver(api, cwd);
    for (const body of [{}, { version: 1 }, { version: 1, language: 'fr' }, { version: 0, language: 'en' }, { version: 1, language: 'en', note: 'and tickets' }]) {
      expect((await api.call(`/api/specs/${spec.id}/approval`, { method: 'POST', body })).status).toBe(400);
    }
    expect((await api.approve('spec-0000000000000000-1', 1)).status).toBe(404);
  });
});

describe('an approval is kept with the spec\'s remarks (#132)', () => {
  it('is shown in the view, sent to a live session, and kept across a restart', async () => {
    const cwd = project({ 'docs/spec.md': FLAGGED, 'docs/notes.md': 'Rest it overnight.\n' });
    const dataDir = folder();
    const first = await start({ dataDir });
    const api = serverClient(first);
    const spec = await handedOver(api, cwd);
    await api.approve(spec.id, 1);
    const approvals = [{ version: 1, at: expect.any(String), session: SESSION, queued: false, unbacked: 2, broken: 1 }];
    expect((await api.remarks(spec.id)).approvals).toEqual(approvals);
    await first.stop();
    expect((await serverClient(await start({ dataDir })).remarks(spec.id)).approvals).toEqual([{ ...approvals[0], queued: true }]);
  });

  it('to an ended session is queued, shown queued, and delivered once the session is resumed', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start({ deliveryHoldMs: 50 }));
    const spec = await handedOver(api, cwd);
    await api.end(SESSION, 'prompt_input_exit');
    expect((await api.approve(spec.id, 1)).status).toBe(200);
    expect((await api.remarks(spec.id)).approvals).toEqual([expect.objectContaining({ queued: true })]);

    await api.register(SESSION, cwd);
    expect((await api.remarks(spec.id)).approvals).toEqual([expect.objectContaining({ queued: false })]);
    expect(await api.take()).toEqual({ id: 'remarks-1', message: expect.stringContaining('I approve the spec «The night bakery»') });
    expect((await api.confirm('remarks-1')).status).toBe(204);
    expect(await api.take()).toEqual({});
  });
});

describe('an approved version is closed to remarks; a later one starts unapproved (#132)', () => {
  it('refuses new remarks and a second approval on the approved version', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start({ deliveryHoldMs: 50 }));
    const spec = await handedOver(api, cwd);
    expect((await api.approve(spec.id, 1)).status).toBe(200);
    expect(await api.take()).toMatchObject({ id: 'remarks-1' });
    expect((await api.saveRemarks(spec.id, { generalNote: '', remarks: [quote(1, 4, 4, 'loses water', 'Why?')] })).status).toBe(409);
    expect((await api.approve(spec.id, 1)).status).toBe(409);
    expect((await api.remarks(spec.id)).draft).toEqual({ generalNote: '', remarks: [] });
    expect((await api.remarks(spec.id)).approvals).toHaveLength(1);
  });

  it('leaves a later version unapproved, open to remarks, with the earlier approval still in the view', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const older = await handedOver(api, cwd);
    await api.approve(older.id, 1);
    writeFileSync(join(cwd, 'docs/spec.md'), BAKERY.replace('Loaf 2, roll 1.', 'Loaf 3, roll 1.'));
    await api.turn(handover('docs/spec.md'), SESSION, cwd);
    const [newer] = await api.specs();
    expect(newer.number).toBe(2);

    expect((await api.remarks(newer.id)).approvals).toEqual([expect.objectContaining({ version: 1 })]);
    expect((await api.saveRemarks(newer.id, { generalNote: '', remarks: [quote(2, 19, 19, 'Loaf 3', 'Why dearer?')] })).status).toBe(204);
    // The approved version is superseded now: it takes no approval again, the newest takes its own.
    expect((await api.approve(newer.id, 1)).status).toBe(409);
    expect((await api.saveRemarks(newer.id, { generalNote: '', remarks: [] })).status).toBe(204);
    expect((await api.approve(newer.id, 2)).status).toBe(200);
    expect((await api.remarks(older.id)).approvals.map((x: { version: number }) => x.version)).toEqual([1, 2]);
  });
});

describe('an approval goes with the version a deleted session handed over (#132)', () => {
  it('leaves a version handed over again under the same number unapproved', async () => {
    const cwd = project({ 'docs/spec.md': BAKERY });
    const api = serverClient(await start());
    const older = await handedOver(api, cwd, OTHER);
    await api.approve(older.id, 1);
    writeFileSync(join(cwd, 'docs/spec.md'), BAKERY.replace('Loaf 2, roll 1.', 'Loaf 3, roll 1.'));
    await handedOver(api, cwd);
    const [second] = await api.specs();
    expect((await api.approve(second.id, 2)).status).toBe(200);

    expect((await api.deleteSession(SESSION)).status).toBe(204);
    expect((await api.remarks(older.id)).approvals).toEqual([expect.objectContaining({ version: 1, session: OTHER })]);
    await api.turn(handover('docs/spec.md'), OTHER, cwd);
    const [again] = await api.specs();
    expect(again.number).toBe(2);
    expect((await api.saveRemarks(again.id, { generalNote: '', remarks: [quote(2, 19, 19, 'Loaf 3', 'Why dearer?')] })).status).toBe(204);
  });
});
