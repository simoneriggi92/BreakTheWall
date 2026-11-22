// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { routeSchema, setupSchema, type ProviderError } from '../src/core/provider';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { claudeCompleter, readClaudeResult, spawnClaude, type ClaudeExit, type ClaudeRun } from '../src/desktop/claude/completer';
import type { CompletionRequest } from '../src/desktop/completion';

const FAKE = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));

describe('the claude route contract (#93)', () => {
  it('accepts a claude route with a model, and refuses it without one or with anything more', () => {
    expect(routeSchema.parse({ provider: 'claude', model: 'sonnet' })).toEqual({ provider: 'claude', model: 'sonnet' });
    expect(routeSchema.safeParse({ provider: 'claude', model: '' }).success).toBe(false);
    expect(routeSchema.safeParse({ provider: 'claude', model: 'sonnet', apiKey: 'sk-ant-x' }).success).toBe(false);
  });

  it('keeps disassembly setups on ChatGPT and local models: the claude route writes explorations only', () => {
    const claude = { provider: 'claude', model: 'sonnet' };
    expect(setupSchema.safeParse({ structure: claude, content: claude }).success).toBe(false);
    expect(setupSchema.safeParse({ structure: { provider: 'chatgpt', model: 'm' }, content: { provider: 'chatgpt', model: 'm' } }).success).toBe(true);
  });
});

const request = (messages: CompletionRequest['messages']): CompletionRequest => ({
  model: 'sonnet', instructions: 'Return the structure.', schemaName: 'break_the_wall_exploration',
  schema: { type: 'object', properties: { start: { type: 'string' } }, required: ['start'], additionalProperties: false }, messages,
});
const printed = (fields: Record<string, unknown>) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.42, duration_ms: 61_000, ...fields });
function fakeRunner(exit: Partial<ClaudeExit> | Error) {
  const runs: ClaudeRun[] = [];
  const runner = vi.fn(async (run: ClaudeRun) => {
    runs.push(run);
    if (exit instanceof Error) throw exit;
    return { code: 0, stdout: '', stderr: '', ...exit };
  });
  return { runner, runs };
}
const failureOf = async (promise: Promise<unknown>) => { try { await promise; } catch (error) { return (error as ProviderError).failure; } };

describe('the Claude Code completer (#93)', () => {
  it('runs a fresh, tool-less claude -p with the schema and instructions, and sends only the request text', async () => {
    const { runner, runs } = fakeRunner({ stdout: printed({ result: 'ignored', structured_output: { start: 'p1' } }) });
    const onProgress = vi.fn();
    const answer = await claudeCompleter(runner).complete(request([{ role: 'user', content: 'Read this source…' }]), new AbortController().signal, onProgress);
    expect(answer).toBe('{"start":"p1"}');
    expect(onProgress).toHaveBeenLastCalledWith(answer.length);
    const [run] = runs;
    expect(Object.keys(run).sort()).toEqual(['args', 'input', 'signal']);
    expect(run.input).toBe('Read this source…');
    const flag = (name: string) => run.args[run.args.indexOf(name) + 1];
    expect(run.args[0]).toBe('-p');
    expect(flag('--output-format')).toBe('json');
    expect(JSON.parse(flag('--json-schema'))).toEqual(request([]).schema);
    expect(flag('--model')).toBe('sonnet');
    expect(flag('--system-prompt')).toBe('Return the structure.');
    expect(flag('--tools')).toBe('');
    expect(run.args).toEqual(expect.arrayContaining(['--safe-mode', '--strict-mcp-config', '--no-session-persistence']));
    expect(run.args).not.toContain('--bare');
    expect(run.args.join(' ')).not.toMatch(/key|token|secret|--settings/i);
  });

  it('hands back the printed result when there is no structured output, so the acceptance decides', async () => {
    const { runner } = fakeRunner({ stdout: printed({ result: 'Here is the structure.' }) });
    expect(await claudeCompleter(runner).complete(request([{ role: 'user', content: 'x' }]), new AbortController().signal, () => {})).toBe('Here is the structure.');
  });

  it('sends a repair as one prompt: the request, the earlier answer, then the findings', async () => {
    const { runner, runs } = fakeRunner({ stdout: printed({ structured_output: { start: 'p1' } }) });
    await claudeCompleter(runner).complete(request([
      { role: 'user', content: 'Read this source…' }, { role: 'assistant', content: '{"start":' }, { role: 'user', content: 'Fix these findings: …' },
    ]), new AbortController().signal, () => {});
    const { input } = runs[0];
    expect(input.indexOf('Read this source…')).toBeLessThan(input.indexOf('{"start":'));
    expect(input.indexOf('{"start":')).toBeLessThan(input.indexOf('Fix these findings: …'));
    expect(input).toMatch(/your previous answer/i);
  });

  it('words a missing claude, a failed run, an error result and unreadable output as Claude Code failures', async () => {
    const missing = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
    const complete = (exit: Partial<ClaudeExit> | Error) => failureOf(claudeCompleter(fakeRunner(exit).runner).complete(request([{ role: 'user', content: 'x' }]), new AbortController().signal, () => {}));
    expect(await complete(missing)).toMatchObject({ code: 'unavailable', reason: 'claude-missing' });
    expect(await complete({ code: 1, stderr: 'Invalid API key · Please run /login' })).toMatchObject({ code: 'unavailable', reason: 'claude-failed', message: expect.stringContaining('Please run /login') });
    expect(await complete({ stdout: printed({ is_error: true, subtype: 'error_max_structured_output_retries' }) })).toMatchObject({ reason: 'claude-failed', message: expect.stringContaining('error_max_structured_output_retries') });
    expect(await complete({ stdout: 'not json' })).toMatchObject({ reason: 'claude-failed' });
  });

  it('runs the CLI as a process outside any project: arguments as given, the prompt on stdin', async () => {
    const source = 'line\n'.repeat(12_000);
    const answer = await claudeCompleter(spawnClaude(process.execPath, [FAKE])).complete(request([{ role: 'user', content: source }]), new AbortController().signal, () => {});
    const seen = JSON.parse(answer) as { args: string[]; input: string; cwd: string };
    expect(seen.input).toBe(source);
    expect(seen.args).toContain('--json-schema');
    expect(seen.args[seen.args.indexOf('--tools') + 1]).toBe('');
    expect(await realpath(seen.cwd)).toBe(await realpath(tmpdir()));
  });

  it('stops the process on cancel, and words a missing command as Claude Code not found', async () => {
    const controller = new AbortController();
    const running = claudeCompleter(spawnClaude(process.execPath, [FAKE])).complete(request([{ role: 'user', content: 'hang' }]), controller.signal, () => {});
    setTimeout(() => controller.abort(), 100);
    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    const missing = claudeCompleter(spawnClaude('btw-no-such-claude')).complete(request([{ role: 'user', content: 'x' }]), new AbortController().signal, () => {});
    expect(await failureOf(missing)).toMatchObject({ code: 'unavailable', reason: 'claude-missing' });
  });

  it('reads the cost and the time of a run', () => {
    expect(readClaudeResult(printed({ structured_output: { start: 'p1' } }))).toEqual({ text: '{"start":"p1"}', costUsd: 0.42, durationMs: 61_000 });
  });
});
