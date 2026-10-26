import { app, safeStorage } from 'electron';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { allParts, divisible, linesOf, type Disassembly } from '../src/core/disassembly';
import { localModelSchema, type GenerationRoute, type GenerationSetup } from '../src/core/provider';
import { ChatGPTAccount } from '../src/desktop/chatgpt/account';
import { Generator } from '../src/desktop/generator';
import { localCompleter } from '../src/desktop/local/runtimes';
import { hostIdFile, SafeStorageVault } from '../src/desktop/secure-files';
import { SettingsStore } from '../src/desktop/settings-store';
import { loadCases } from './cases';
import { disassemblyMetrics, summarize, type AttemptRecord, type ExpansionRecord } from './metrics';
import { chatgptRunRefusal, LEDGER, type LedgerEntry } from './policy';
import { reviewTemplate } from './review';

const USAGE = `npm run eval -- [--route local|chatgpt] [--cases id,id] [--runs 2]
  local:   [--runtime ollama|lmstudio|llamacpp|openai --base http://127.0.0.1:PORT --model NAME]
           (without them, the local model chosen in the app)
  chatgpt: --allow-chatgpt --setups A,B,C --strong SLUG --cheap SLUG
           A = strong on every phase · B = cheap on every phase · C = strong structure, cheap parts and runs
           or --structure-model SLUG [--content-model SLUG] for one custom setup
           [--private-to-chatgpt] only after the owner has confirmed that a private case may go to OpenAI
  --expand        then take apart one divisible part per case, on the first valid attempt of the first setup
  --list-models   list the account's models (no generation)
Public cases run by default; a private case runs only when named in --cases.`;

// Same name and data folder as the app, so the chosen local model and the ChatGPT session are the app's own.
app.setName('Break the Wall');
if (process.env.BTW_USER_DATA_DIR) app.setPath('userData', resolve(process.env.BTW_USER_DATA_DIR));

function chatgptAccount(userData: string) {
  return new ChatGPTAccount({
    vault: new SafeStorageVault(join(userData, 'credentials', 'chatgpt.bin'), safeStorage), hostId: hostIdFile(join(userData, 'credentials', 'agent-host.json')),
    fetch: globalThis.fetch.bind(globalThis), openExternal: async () => { throw new Error('Sign in from the app before evaluating ChatGPT.'); },
  });
}
async function readLedger(root: string): Promise<LedgerEntry[]> {
  try { return (await readFile(join(root, LEDGER), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as LedgerEntry); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
}

interface NamedSetup { name: string; setup: GenerationSetup }
/** The comparison's setups, by letter. Model slugs come from the account's list at run time and are never assumed. */
function chatgptSetups(values: { setups?: string; strong?: string; cheap?: string; 'structure-model'?: string; 'content-model'?: string }): NamedSetup[] {
  const gpt = (model: string): GenerationRoute => ({ provider: 'chatgpt', model });
  if (values['structure-model']) return [{ name: 'custom', setup: { structure: gpt(values['structure-model']), content: gpt(values['content-model'] ?? values['structure-model']) } }];
  const need = (slug: string | undefined, flag: string) => { if (!slug) throw new Error(`${flag} is required for this setup (see --list-models).`); return slug; };
  return (values.setups ?? 'A').split(',').map(x => x.trim().toUpperCase()).map(name => {
    if (name === 'A') return { name, setup: { structure: gpt(need(values.strong, '--strong')), content: gpt(need(values.strong, '--strong')) } };
    if (name === 'B') return { name, setup: { structure: gpt(need(values.cheap, '--cheap')), content: gpt(need(values.cheap, '--cheap')) } };
    if (name === 'C') return { name, setup: { structure: gpt(need(values.strong, '--strong')), content: gpt(need(values.cheap, '--cheap')) } };
    throw new Error(`Unknown setup ${name}: use A, B or C.`);
  });
}

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: {
    route: { type: 'string', default: 'local' }, runtime: { type: 'string' }, base: { type: 'string' }, model: { type: 'string' },
    setups: { type: 'string' }, strong: { type: 'string' }, cheap: { type: 'string' }, 'structure-model': { type: 'string' }, 'content-model': { type: 'string' },
    cases: { type: 'string' }, runs: { type: 'string', default: '2' }, 'allow-chatgpt': { type: 'boolean', default: false },
    'private-to-chatgpt': { type: 'boolean', default: false }, expand: { type: 'boolean', default: false },
    'list-models': { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  } });
  if (values.help) { console.log(USAGE); return 0; }
  const root = process.cwd();
  const userData = app.getPath('userData');
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');

  if (values['list-models']) {
    // Reads the account's model list; it sends no source and costs no generation.
    const models = await chatgptAccount(userData).models();
    console.log(models.map(m => `${m.slug}\t${m.name}`).join('\n'));
    return 0;
  }

  const all = await loadCases(root, { includePrivate: true });
  const wanted = values.cases?.split(',').map(x => x.trim()).filter(Boolean);
  const unknown = wanted?.filter(id => !all.some(c => c.id === id)) ?? [];
  if (unknown.length) throw new Error(`Unknown case: ${unknown.join(', ')}. Available: ${all.map(c => c.id).join(', ')}`);
  const cases = wanted ? all.filter(c => wanted.includes(c.id)) : all.filter(c => !c.private);

  let setups: NamedSetup[];
  const chatgpt = values.route === 'chatgpt';
  const used = await readLedger(root);
  if (chatgpt) {
    setups = chatgptSetups(values);
    const per = setups.length * runs;
    const refusal = chatgptRunRefusal({
      allowed: values['allow-chatgpt'], privateAllowed: values['private-to-chatgpt'], attempts: runs, used,
      publicPlanned: cases.filter(c => !c.private).length * per, privatePlanned: cases.filter(c => c.private).length * per,
      expansionsPlanned: values.expand ? cases.length : 0,
    });
    if (refusal) throw new Error(refusal);
    // A slug the account does not list is refused here, before any source is sent.
    const listed = new Set((await chatgptAccount(userData).models()).map(m => m.slug));
    const unknownModels = [...new Set(setups.flatMap(s => [s.setup.structure.model, s.setup.content.model]))].filter(slug => !listed.has(slug));
    if (unknownModels.length) throw new Error(`The account does not list ${unknownModels.join(', ')}. See --list-models.`);
  } else {
    let route: GenerationRoute;
    if (values.runtime || values.base || values.model) route = { provider: 'local', ...localModelSchema.parse({ runtime: values.runtime, baseUrl: values.base, model: values.model }) };
    else {
      const local = (await new SettingsStore(join(userData, 'settings.json')).read()).local;
      if (!local) throw new Error('No local model chosen in the app. Choose one in the app or pass --runtime, --base and --model.');
      route = { provider: 'local', runtime: local.runtime, baseUrl: local.baseUrl, model: local.model };
    }
    setups = [{ name: 'local', setup: { structure: route, content: route } }];
  }

  // Generated disassemblies are kept in memory and in the report folder only; the app's own library is not touched.
  const kept = new Map<string, Disassembly>();
  const store = { save: async (d: Disassembly) => { kept.set(`${d.id}:${d.revision}`, d); return d; }, find: async (id: string, revision: string) => kept.get(`${id}:${revision}`) };
  const generator = new Generator({ chatgpt: chatgptAccount(userData), local: target => localCompleter(globalThis.fetch.bind(globalThis), target) }, store);
  const run = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(root, '.local', 'eval', 'runs', `${run}-${values.route}`);
  await mkdir(dir, { recursive: true });
  // The models behind each letter stay in their own file, so the review sheets can be read blind.
  await writeFile(join(dir, 'setups.json'), JSON.stringify(Object.fromEntries(setups.map(s => [s.name, s.setup])), null, 1));
  const report = join(dir, 'attempts.jsonl');
  const records: AttemptRecord[] = [];
  console.log(`Run ${run}: ${cases.length} cases × ${setups.length} setups × ${runs} on ${values.route}`);

  const ledger = async (entry: LedgerEntry) => { await mkdir(join(root, '.local', 'eval'), { recursive: true }); await appendFile(join(root, LEDGER), JSON.stringify(entry) + '\n'); };
  outer: for (const c of cases) {
    const reviewed = new Set<string>();
    let firstValid: Disassembly | undefined;
    // Setups alternate within a case, so a usage limit leaves every setup measured on the same cases.
    for (let attempt = 1; attempt <= runs; attempt++) for (const { name, setup } of setups) {
      const started = Date.now();
      const result = await generator.generate({ sources: c.sources, goal: c.goal, language: c.language, setup }, () => {});
      const record: AttemptRecord = { run, case: c.id, private: c.private, setup: name, attempt, language: c.language, ok: result.ok, seconds: Math.round((Date.now() - started) / 1000), stats: result.stats };
      if (result.ok) {
        if (name === setups[0].name && !firstValid) firstValid = result.disassembly;
        record.metrics = disassemblyMetrics(result.disassembly);
        record.file = `${c.id}-${name}-${attempt}.disassembly.json`;
        await writeFile(join(dir, record.file), JSON.stringify(result.disassembly, null, 1));
        // One review sheet per case and setup: reviewing every attempt would make the manual step the bottleneck.
        if (!reviewed.has(name)) { await writeFile(join(dir, `${c.id}-${name}.review.md`), reviewTemplate(result.disassembly, { case: c.id, setup: name, run })); reviewed.add(name); }
      } else {
        record.failure = result.failure.reason ?? result.failure.code;
        record.issues = result.failure.issues?.slice(0, 8);
      }
      records.push(record);
      await appendFile(report, JSON.stringify(record) + '\n');
      const sent = result.stats ? result.stats.structure.requests + result.stats.content.requests + result.stats.runs.requests : 0;
      // A request refused at admission (model, account) runs no model; only an attempt that reached one spends the budget.
      const admitted = sent && !(!result.ok && ['model-unavailable', 'signed-out', 'session-expired', 'plan-disabled', 'not-eligible', 'forbidden'].includes(result.failure.code));
      if (chatgpt && admitted) await ledger({ run, case: c.id, private: c.private, setup: name, at: new Date().toISOString() });
      console.log(`${c.id} ${name} #${attempt}: ${record.ok ? 'valid' : `failed (${record.failure})`}, ${sent} requests, ${record.seconds} s`);
      if (!result.ok && result.failure.code === 'usage-limit') { console.log('Stopped: the ChatGPT usage limit was reached.'); break outer; }
      if (!result.ok && ['signed-out', 'session-expired', 'plan-disabled', 'model-unavailable', 'local-unreachable', 'local-model-missing'].includes(result.failure.code)) { console.log(`Stopped: ${result.failure.message}`); break outer; }
    }
    // D14: the leaf with the most lines of its own is the one with the most left to take apart.
    const leaf = firstValid && allParts(firstValid).filter(x => !x.part.parts && divisible(firstValid!, x.part)).sort((a, b) => linesOf(firstValid!, b.part.cites).size - linesOf(firstValid!, a.part.cites).size)[0]?.part;
    if (values.expand && firstValid && leaf) {
      const started = Date.now();
      const result = await generator.expand({ disassemblyId: firstValid.id, revision: firstValid.revision, part: leaf.id, route: setups[0].setup.structure }, () => {});
      const record: ExpansionRecord = { run, case: c.id, setup: setups[0].name, part: leaf.id, ok: result.ok, seconds: Math.round((Date.now() - started) / 1000), stats: result.stats };
      if (result.ok) {
        record.metrics = disassemblyMetrics(result.disassembly);
        record.file = `${c.id}-${setups[0].name}.expanded.disassembly.json`;
        await writeFile(join(dir, record.file), JSON.stringify(result.disassembly, null, 1));
        await writeFile(join(dir, `${c.id}-${setups[0].name}.expanded.review.md`), reviewTemplate(result.disassembly, { case: c.id, setup: setups[0].name, run }));
      } else { record.failure = result.failure.reason ?? result.failure.code; record.issues = result.failure.issues?.slice(0, 8); }
      await appendFile(join(dir, 'expansions.jsonl'), JSON.stringify(record) + '\n');
      if (chatgpt && result.stats?.requests) await ledger({ run, case: c.id, private: c.private, setup: setups[0].name, at: new Date().toISOString(), kind: 'expansion' });
      console.log(`${c.id} ${setups[0].name} expand ${leaf.id}: ${result.ok ? 'valid' : `failed (${record.failure})`}, ${result.stats?.requests ?? 0} requests, ${record.seconds} s`);
      if (!result.ok && result.failure.code === 'usage-limit') { console.log('Stopped: the ChatGPT usage limit was reached.'); break outer; }
    }
  }
  const summary = summarize(records);
  await writeFile(join(dir, 'summary.json'), JSON.stringify({ run, route: values.route, setups: setups.map(s => s.name), cases: cases.map(c => ({ id: c.id, private: c.private })), summary }, null, 1));
  console.table(summary.map(s => ({ case: s.case, setup: s.setup, valid: `${s.valid}/${s.attempts}`, repairs: `${s.repairs.structure}/${s.repairs.content}/${s.repairs.runs}`, 'median s': s.medianSeconds, requests: s.medianRequests, 'sent k': s.medianSentChars && Math.round(s.medianSentChars / 1000), 'received k': s.medianReceivedChars && Math.round(s.medianReceivedChars / 1000), forgotten: s.maxForgottenLines, layout: s.maxLayoutFindings, 'language ≠': s.languageMismatches, 'answer length ×': s.maxAnswerLengthRatio })));
  if (chatgpt) console.log(`ChatGPT budget: ${(await readLedger(root)).length} of 30 generations used.`);
  console.log(`Report: ${dir}`);
  return 0;
}

app.dock?.hide();
void app.whenReady()
  .then(() => main(process.argv.slice(process.argv.indexOf('--') + 1)))
  .then(code => app.exit(code))
  .catch(error => { console.error((error as Error).message); console.error(USAGE); app.exit(1); });
