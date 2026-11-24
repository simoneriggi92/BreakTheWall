// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backingReportSchema } from '../src/core/backing';
import { serverClient, SESSION, useLocalServers } from './local-server-harness';

/**
 * The backing check of a handed-over spec (#106), driven over the server's HTTP API (seam ① of #92) with a fake `gh`:
 * every statement's references resolved without a model, unbacked and broken statements counted per section, and a
 * spec that declares no backing at all left without flags.
 */
const { start, folder } = useLocalServers();
type Api = ReturnType<typeof serverClient>;
const OTHER = 'c0ffee00-0000-4000-8000-000000000002';

function project(files: Record<string, string> = {}) {
  const cwd = folder();
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(cwd, path, '..'), { recursive: true });
    writeFileSync(join(cwd, path), text);
  }
  return cwd;
}
const ROUND_ONE = [
  'Two questions on the bakery.',
  '',
  '❓ **Q1** - **When is the bread baked?**: At night or at dawn.',
  '',
  '- **(a)** At night: the loaves are cold by morning',
  '- **(b)** At dawn: the loaves are warm when the shop opens',
  '',
  '➡️ **(b)**, because warm bread sells.',
  '',
  '❓ **Q2** - **Who sets the price?**: The baker or the owner.',
  '➡️ The baker.',
].join('\n');
const ROUND_TWO = '❓ **Q1** - **Where do customers pay?**: At the till or at the counter.\n➡️ At the till.';

/** A session that answered two rounds, a free block between them, then handed over `spec` pasted. */
async function answeredThenHandedOver(api: Api, spec: string, cwd = project()) {
  await api.startPhase(SESSION, cwd);
  await api.turn(ROUND_ONE, SESSION, cwd);
  await api.send(1, { generalNote: '', answers: { 1: { choice: 'b', note: 'Warm sells.' }, 2: { choice: 'recommendation', note: '' } } });
  await api.turn('Let me check the oven first.', SESSION, cwd);
  await api.turn(ROUND_TWO, SESSION, cwd);
  await api.turn(`${spec}\n\nSpec: pasted`, SESSION, cwd);
  return (await api.specs())[0].id;
}
const backing = async (api: Api, id: string) => {
  const reply = await api.call(`/api/specs/${id}/backing`);
  expect(reply.status).toBe(200);
  return backingReportSchema.parse(await reply.json());
};

describe('answers back a statement (#106)', () => {
  it('resolves [R1·Q2] against the session\'s rounds, numbered as the page shows them, and shows the cited answer', async () => {
    const api = serverClient(await start());
    const id = await answeredThenHandedOver(api, [
      '# The night bakery',
      '',
      '## Baking',
      'The bread is baked at dawn,',
      'when the oven is hot. [R1·Q1]',
      '',
      'Customers pay at the till. [R2·Q1]',
      '',
      '```',
      'oven.heat() // [R1·Q1]',
      '```',
      '',
      '## Selling',
      '- The baker sets the price. [R1·Q2]',
      '- The shop opens at seven.',
      '- Loaves are wrapped in paper. [R1·Q7]',
      '- Rolls are sold by the dozen. [R5·Q1]',
    ].join('\n'));
    const report = await backing(api, id);
    expect(report.declared).toBe(true);
    expect(report.statements.map(x => [x.from, x.to, x.state, x.quote])).toEqual([
      [4, 5, 'backed', 'The bread is baked at dawn, when the oven is hot.'],
      [7, 7, 'backed', 'Customers pay at the till.'],
      [14, 14, 'backed', 'The baker sets the price.'],
      [15, 15, 'unbacked', 'The shop opens at seven.'],
      [16, 16, 'broken', 'Loaves are wrapped in paper.'],
      [17, 17, 'broken', 'Rolls are sold by the dozen.'],
    ]);
    const [dawn, till, price] = report.statements;
    expect(dawn.references).toEqual([{ kind: 'answer', written: '[R1·Q1]', found: true, answer: {
      session: SESSION, round: 1, question: 1, title: 'When is the bread baked?', sent: true, choice: 'b', option: 'At dawn', note: 'Warm sells.',
    } }]);
    // The free block between the rounds is not a round: the second round is R2.
    expect(till.references).toEqual([{ kind: 'answer', written: '[R2·Q1]', found: true, answer: {
      session: SESSION, round: 2, question: 1, title: 'Where do customers pay?', sent: false, choice: null, option: null, note: '',
    } }]);
    expect(price.references).toEqual([{ kind: 'answer', written: '[R1·Q2]', found: true, answer: {
      session: SESSION, round: 1, question: 2, title: 'Who sets the price?', sent: true, choice: 'recommendation', option: 'The baker.', note: '',
    } }]);
    expect(report.statements[4].references).toEqual([{ kind: 'answer', written: '[R1·Q7]', found: false }]);
    expect(report.sections).toEqual([
      { title: 'Baking', line: 3, statements: 2, unbacked: 0, broken: 0 },
      { title: 'Selling', line: 13, statements: 4, unbacked: 1, broken: 2 },
    ]);
  });
});

describe('versions of one spec handed over by two sessions (#106)', () => {
  it('looks [R1·Q1] up first in the session that handed this version over, then in the sessions of the other versions', async () => {
    const cwd = project({ 'spec.md': '# Bakery\n\nThe bread is baked at dawn. [R1·Q1]\n\nCustomers pay at the till. [R2·Q1]\n' });
    const api = serverClient(await start());
    await api.turn(ROUND_ONE, SESSION, cwd);
    await api.send(1, { generalNote: '', answers: { 1: { choice: 'b', note: '' } } });
    await api.turn(ROUND_TWO, SESSION, cwd);
    await api.turn('Written.\n\nSpec: spec.md', SESSION, cwd);
    // The work went on under a new id (`/clear`), which asked one round of its own before handing the spec over again.
    await api.turn('❓ **Q1** - **Wrapped in paper?**: Yes or no.\n➡️ Yes.', OTHER, cwd);
    await api.turn('Revised.\n\nSpec: spec.md', OTHER, cwd);
    const [newer] = await api.specs();
    expect(newer).toMatchObject({ number: 2, session: OTHER });
    const report = await backing(api, newer.id);
    expect(report.statements.map(x => x.references[0])).toEqual([
      { kind: 'answer', written: '[R1·Q1]', found: true, answer: expect.objectContaining({ session: OTHER, title: 'Wrapped in paper?', sent: false }) },
      { kind: 'answer', written: '[R2·Q1]', found: true, answer: expect.objectContaining({ session: SESSION, title: 'Where do customers pay?' }) },
    ]);
  });
});

type GhRun = { args: string[]; cwd: string };
/** `gh` answering for the issues and comments it knows, as the person's own login would; anything else is not found. */
function fakeGh(known: Record<string, unknown>) {
  const runs: GhRun[] = [];
  const runner = async (run: GhRun & { signal: AbortSignal }) => {
    runs.push({ args: run.args, cwd: run.cwd });
    const target = run.args[0] === 'api' ? run.args[1] : `${run.args[0]} ${run.args[2]}`;
    const found = known[target];
    return found ? { code: 0, stdout: JSON.stringify(found), stderr: '' } : { code: 1, stdout: '', stderr: 'GraphQL: Could not resolve to an issue' };
  };
  return { runner, runs };
}
const pasted = async (api: Api, spec: string, cwd: string) => {
  await api.turn(`${spec}\n\nSpec: pasted`, SESSION, cwd);
  return (await api.specs())[0].id;
};

describe('links to an issue or a comment back a statement through gh (#106)', () => {
  it('resolves an issue\'s URL, owner/repo#n and #n in the session\'s folder, a comment only on its own issue', async () => {
    const cwd = project();
    const gh = fakeGh({
      'issue https://github.com/owner/repo/issues/82': { url: 'https://github.com/owner/repo/issues/82', title: 'Backing on a spec' },
      'issue 80': { url: 'https://github.com/owner/repo/issues/80', title: 'Spec intake' },
      'pr https://github.com/owner/repo/pull/7': { url: 'https://github.com/owner/repo/pull/7', title: 'First loop' },
      'repos/owner/repo/issues/comments/555': { issue_url: 'https://api.github.com/repos/owner/repo/issues/92', body: 'Decided.' },
    });
    const api = serverClient(await start({ runners: { gh: gh.runner } }));
    const id = await pasted(api, [
      '# Links',
      '',
      '- Each statement ends with its backing. https://github.com/owner/repo/issues/82',
      '- The server reads a spec through gh. (#80, owner/repo#82)',
      '- The loop ships first. [the PR](https://github.com/owner/repo/pull/7)',
      '- The return message follows the page. https://github.com/owner/repo/issues/92#issuecomment-555',
      '- A comment of another issue. https://github.com/owner/repo/issues/91#issuecomment-555',
      '- An issue nobody opened. #4040',
    ].join('\n'), cwd);
    const report = await backing(api, id);
    expect(report.statements.map(x => [x.quote, x.state, x.references.map(r => [r.written, r.found, 'title' in r ? r.title : undefined])])).toEqual([
      ['Each statement ends with its backing.', 'backed', [['https://github.com/owner/repo/issues/82', true, 'Backing on a spec']]],
      ['The server reads a spec through gh.', 'backed', [['#80', true, 'Spec intake'], ['owner/repo#82', true, 'Backing on a spec']]],
      ['The loop ships first.', 'backed', [['[the PR](https://github.com/owner/repo/pull/7)', true, 'First loop']]],
      ['The return message follows the page.', 'backed', [['https://github.com/owner/repo/issues/92#issuecomment-555', true, undefined]]],
      ['A comment of another issue.', 'broken', [['https://github.com/owner/repo/issues/91#issuecomment-555', false, undefined]]],
      ['An issue nobody opened.', 'broken', [['#4040', false, undefined]]],
    ]);
    // Every run in the session's folder, so #80 names an issue of its repository; one issue asked once.
    expect(gh.runs.every(run => run.cwd === cwd)).toBe(true);
    expect(gh.runs.filter(run => run.args.includes('https://github.com/owner/repo/issues/82'))).toHaveLength(1);
    // A lone first heading is the spec's title, not a section: its statements stand in the opening, untitled.
    expect(report.sections).toEqual([{ title: '', line: 1, statements: 6, unbacked: 0, broken: 2 }]);
  });
});

describe('lines of a file back a statement (#106)', () => {
  it('resolves path:a-b against the session\'s folder, and refuses lines past the end, a missing file and a path outside it', async () => {
    const outside = project({ 'secret.ts': 'one\ntwo\nthree\n' });
    const cwd = project({ 'src/oven.ts': 'export const heat = 220;\nexport const drift = 10;\nexport const dawn = 5;\n' });
    const api = serverClient(await start());
    const id = await pasted(api, [
      '| Fact | Where |',
      '| --- | --- |',
      '| The oven heats to 220 degrees. | `src/oven.ts:1` |',
      '| Its thermometer drifts. | src/oven.ts:2-3 |',
      '| Bread is baked at noon. | src/oven.ts:3-4 |',
      '| The oven has a timer. | src/timer.ts:1 |',
      `| A secret. | ../${outside.split(/[\\/]/).at(-1)}/secret.ts:1-2 |`,
      `| Another secret. | ${join(outside, 'secret.ts')}:1 |`,
    ].join('\n'), cwd);
    const report = await backing(api, id);
    // The header and its delimiter are no statements; each row is one.
    expect(report.statements.map(x => [x.from, x.quote, x.state])).toEqual([
      [3, 'The oven heats to 220 degrees.', 'backed'],
      [4, 'Its thermometer drifts.', 'backed'],
      [5, 'Bread is baked at noon.', 'broken'],
      [6, 'The oven has a timer.', 'broken'],
      [7, 'A secret.', 'broken'],
      [8, 'Another secret.', 'broken'],
    ]);
    expect(report.statements[0].references).toEqual([{ kind: 'lines', written: '`src/oven.ts:1`', found: true }]);
  });
});

describe('a spec with no reference at all declares no backing (#106)', () => {
  it('reports no statement and no flag, whatever its statements say', async () => {
    const api = serverClient(await start());
    const id = await pasted(api, '# Older spec\n\n## Goal\n\nBread at dawn.\n\n- Rolls too.\n\n| a | b |\n| - | - |\n| c | d |', project());
    expect(await backing(api, id)).toEqual({ declared: false, statements: [], sections: [] });
  });

  it('answers 404 for an id that names no version, and 401 without the secret', async () => {
    const server = await start();
    const api = serverClient(server);
    for (const id of ['spec-0000000000000000-1', 'x', '..%2Fsecret']) expect((await api.call(`/api/specs/${id}/backing`)).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${server.port}/api/specs/spec-0000000000000000-1/backing`)).status).toBe(401);
  });
});
