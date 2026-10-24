import { app, safeStorage } from 'electron';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Lesson } from '../src/core/lesson';
import { localModelSchema, type GenerationRoute } from '../src/core/provider';
import { ChatGPTAccount } from '../src/desktop/chatgpt/account';
import { Generator } from '../src/desktop/generator';
import { localCompleter } from '../src/desktop/local/runtimes';
import { hostIdFile, SafeStorageVault } from '../src/desktop/secure-files';
import { SettingsStore } from '../src/desktop/settings-store';
import { loadCases } from './cases';
import { lessonMetrics, summarize, type AttemptRecord } from './metrics';
import { chatgptRunRefusal } from './policy';
import { reviewTemplate } from './review';

const USAGE = `npm run eval -- [--route local|chatgpt] [--runtime ollama|lmstudio|llamacpp|openai --base http://127.0.0.1:PORT --model NAME]
                    [--cases id,id] [--runs 3] [--public-only] [--allow-chatgpt] [--list-models]
Without --runtime/--base/--model the local route uses the model chosen in the app.`;

// Same name and data folder as the app, so the chosen local model and the ChatGPT session are the app's own.
app.setName('Break the Wall');
if (process.env.BTW_USER_DATA_DIR) app.setPath('userData', resolve(process.env.BTW_USER_DATA_DIR));

function chatgptAccount(userData: string) {
  return new ChatGPTAccount({
    vault: new SafeStorageVault(join(userData, 'credentials', 'chatgpt.bin'), safeStorage), hostId: hostIdFile(join(userData, 'credentials', 'agent-host.json')),
    fetch: globalThis.fetch.bind(globalThis), openExternal: async () => { throw new Error('Sign in from the app before evaluating ChatGPT.'); },
  });
}

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({ args: argv, options: {
    route: { type: 'string', default: 'local' }, runtime: { type: 'string' }, base: { type: 'string' }, model: { type: 'string' },
    cases: { type: 'string' }, runs: { type: 'string', default: '3' }, 'public-only': { type: 'boolean', default: false },
    'allow-chatgpt': { type: 'boolean', default: false }, 'list-models': { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
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
  let route: GenerationRoute;
  if (values.route === 'chatgpt') {
    const refusal = chatgptRunRefusal({ allowed: values['allow-chatgpt'], runs });
    if (refusal) throw new Error(refusal);
    if (!values.model) throw new Error('--model is required for ChatGPT (see the model list in the app).');
    route = { provider: 'chatgpt', model: values.model };
  } else if (values.runtime || values.base || values.model) {
    route = { provider: 'local', ...localModelSchema.parse({ runtime: values.runtime, baseUrl: values.base, model: values.model }) };
  } else {
    const local = (await new SettingsStore(join(userData, 'settings.json')).read()).local;
    if (!local) throw new Error('No local model chosen in the app. Choose one in the app or pass --runtime, --base and --model.');
    route = { provider: 'local', runtime: local.runtime, baseUrl: local.baseUrl, model: local.model };
  }

  const all = await loadCases(root, { includePrivate: !values['public-only'] });
  const wanted = values.cases?.split(',').map(x => x.trim()).filter(Boolean);
  const cases = wanted ? all.filter(c => wanted.includes(c.id)) : all;
  const unknown = wanted?.filter(id => !all.some(c => c.id === id)) ?? [];
  if (unknown.length) throw new Error(`Unknown case: ${unknown.join(', ')}. Available: ${all.map(c => c.id).join(', ')}`);

  const account = chatgptAccount(userData);
  // Generated lessons are kept in the report folder only; the app's own library is not touched.
  const generator = new Generator({ chatgpt: account, local: target => localCompleter(globalThis.fetch.bind(globalThis), target) }, { save: async (lesson: Lesson) => lesson });

  const run = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(root, '.local', 'eval', 'runs', `${run}-${route.provider}`);
  await mkdir(dir, { recursive: true });
  const report = join(dir, 'attempts.jsonl');
  const records: AttemptRecord[] = [];
  console.log(`Run ${run}: ${cases.length} cases × ${runs} on ${route.provider}${route.provider === 'local' ? ` (${route.runtime} · ${route.model})` : ` (${route.model})`}`);

  outer: for (const c of cases) {
    let reviewed = false;
    for (let attempt = 1; attempt <= runs; attempt++) {
      const started = Date.now();
      let outputChars = 0; let repaired = false;
      const result = await generator.generate({ sources: c.sources, goal: c.goal, route }, p => { outputChars = Math.max(outputChars, p.received); if (p.phase === 'repairing') repaired = true; });
      const record: AttemptRecord = {
        run, case: c.id, private: c.private, route: route.provider, ...(route.provider === 'local' ? { runtime: route.runtime } : {}), model: route.model, attempt,
        ok: result.ok, repaired, seconds: Math.round((Date.now() - started) / 1000), outputChars,
      };
      if (result.ok) {
        record.metrics = lessonMetrics(result.lesson);
        record.lessonFile = `${c.id}-${attempt}.lesson.json`;
        await writeFile(join(dir, record.lessonFile), JSON.stringify(result.lesson, null, 1));
        // One review sheet per case: reviewing every attempt would make the manual step the bottleneck.
        if (!reviewed) { await writeFile(join(dir, `${c.id}-${attempt}.review.md`), reviewTemplate(result.lesson, { case: c.id, model: route.model, run })); reviewed = true; }
      } else {
        record.failure = result.failure.code;
        record.issues = result.failure.issues?.slice(0, 8);
      }
      records.push(record);
      await appendFile(report, JSON.stringify(record) + '\n');
      console.log(`${c.id} #${attempt}: ${record.ok ? 'valid' : `failed (${record.failure})`}${record.repaired ? ', repaired' : ''}, ${record.seconds} s`);
      if (!result.ok && result.failure.code === 'usage-limit') { console.log('Stopped: the ChatGPT usage limit was reached.'); break outer; }
      if (!result.ok && ['signed-out', 'session-expired', 'plan-disabled', 'local-unreachable', 'local-model-missing'].includes(result.failure.code)) { console.log(`Stopped: ${result.failure.message}`); break outer; }
    }
  }
  const summary = summarize(records);
  await writeFile(join(dir, 'summary.json'), JSON.stringify({ run, route, cases: cases.map(c => ({ id: c.id, private: c.private })), summary }, null, 1));
  console.table(summary.map(s => ({ case: s.case, valid: `${s.valid}/${s.attempts}`, repaired: s.repaired, 'median s': s.medianSeconds, 'slowest s': s.slowestSeconds, coverage: s.medianCoverage, 'answer length ×': s.maxAnswerLengthRatio })));
  console.log(`Report: ${dir}`);
  return 0;
}

app.dock?.hide();
void app.whenReady()
  .then(() => main(process.argv.slice(process.argv.indexOf('--') + 1)))
  .then(code => app.exit(code))
  .catch(error => { console.error((error as Error).message); console.error(USAGE); app.exit(1); });
