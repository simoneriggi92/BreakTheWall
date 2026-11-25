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
