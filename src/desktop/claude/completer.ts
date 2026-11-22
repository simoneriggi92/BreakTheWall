import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { failure, ProviderError } from '../../core/provider';
import type { Completer, CompletionRequest } from '../completion';

/**
 * The Claude Code route (#93): each request is a fresh `claude -p` on the person's own Claude login. Plain Node, no
 * Electron: the local server of the plugin runs it too. The app reads and stores no credential: Claude Code finds its
 * own login, as it does in the person's terminal.
 */

/** One run of the CLI: its arguments and what goes to its stdin. Nothing else crosses, not even an environment. */
export interface ClaudeRun { args: string[]; input: string; signal: AbortSignal }
export interface ClaudeExit { code: number | null; stdout: string; stderr: string }
/** The seam tests replace: a real process in the app, a script in tests. */
export type ClaudeRunner = (run: ClaudeRun) => Promise<ClaudeExit>;

/**
 * Only the fields read here; `--output-format json` prints many more. `structured_output` is present when the answer
 * passed `--json-schema`; `result` is the answer's text either way.
 */
const printedSchema = z.object({
  is_error: z.boolean(), subtype: z.string().optional(), result: z.string().optional(), structured_output: z.unknown().optional(),
  total_cost_usd: z.number().optional(), duration_ms: z.number().optional(),
});

/**
 * The arguments for one request. `--system-prompt` replaces Claude Code's own prompt with the request's instructions;
 * `--tools ""`, `--safe-mode` and `--strict-mcp-config` leave the model nothing but the text it is sent: no tools, no
 * CLAUDE.md, skills, hooks, plugins or MCP servers. `--bare` is not used: it skips the person's login.
 */
function claudeArgs(request: CompletionRequest): string[] {
  return [
    '-p', '--output-format', 'json', '--json-schema', JSON.stringify(request.schema), '--model', request.model,
    '--system-prompt', request.instructions, '--tools', '', '--safe-mode', '--strict-mcp-config', '--no-session-persistence',
  ];
}

/**
 * `claude -p` takes one prompt, and a session is never kept, so a repair cannot continue the first conversation: the
 * request, the earlier answer and the findings travel together, in that order.
 */
function prompt(messages: CompletionRequest['messages']): string {
  return messages.map(m => m.role === 'assistant' ? `Your previous answer:\n\n${m.content}\n\nEnd of your previous answer.` : m.content).join('\n\n');
}

const failed = (detail: string) => new ProviderError(failure('unavailable', { reason: 'claude-failed', message: `Claude Code non ha completato la richiesta: ${detail.trim().slice(-300)}` }));

/** The answer of one run, with its cost and time as Claude Code reports them. */
export function readClaudeResult(stdout: string): { text: string; costUsd?: number; durationMs?: number } {
  let json: unknown;
  try { json = JSON.parse(stdout); } catch { throw failed(`output non leggibile (${stdout.slice(0, 80)})`); }
  const printed = printedSchema.safeParse(json);
  if (!printed.success) throw failed('output senza il risultato atteso');
  const { is_error, subtype, result, structured_output, total_cost_usd, duration_ms } = printed.data;
  if (is_error) throw failed(`${subtype ?? 'errore'}${result ? ` · ${result}` : ''}`);
  // Without structured output the text goes on as it is: the exploration's acceptance refuses or repairs it.
  const text = structured_output !== undefined && structured_output !== null ? JSON.stringify(structured_output) : result;
  if (text === undefined) throw failed('nessuna risposta');
  return { text, ...(total_cost_usd !== undefined ? { costUsd: total_cost_usd } : {}), ...(duration_ms !== undefined ? { durationMs: duration_ms } : {}) };
}

export function claudeCompleter(runner: ClaudeRunner = spawnClaude()): Completer {
  return {
    async complete(request, signal, onProgress) {
      let exit: ClaudeExit;
      try { exit = await runner({ args: claudeArgs(request), input: prompt(request.messages), signal }); }
      catch (error) {
        if (!signal.aborted && (error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new ProviderError(failure('unavailable', { reason: 'claude-missing', message: 'Claude Code non è installato o non è nel PATH.' }));
        }
        throw error;
      }
      if (exit.code !== 0) throw failed(exit.stderr || exit.stdout || `codice di uscita ${exit.code}`);
      const { text } = readClaudeResult(exit.stdout);
      onProgress(text.length);
      return text;
    },
  };
}

/**
 * Runs the CLI as a child process. The prompt goes through stdin, not an argument, because a source of 52,000
 * characters is close to what some systems accept on a command line. It starts in the system's temporary folder, so it
 * sees no project. `leading` lets a test put a script before the arguments.
 */
export function spawnClaude(command = 'claude', leading: string[] = []): ClaudeRunner {
  return ({ args, input, signal }) => new Promise((resolve, reject) => {
    const child = spawn(command, [...leading, ...args], { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], signal });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    // A child that exits before reading all of stdin closes the pipe; its exit code tells what happened.
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
