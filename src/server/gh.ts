import { spawn } from 'node:child_process';
import { z } from 'zod';

/** The `gh` CLI, with the person's own login: how the server reads a spec from an issue (#104) and checks links (#106). */

/** One run of `gh`, in the session's folder, so `#n` names an issue of that session's repository. */
export interface GhRun { args: string[]; cwd: string; signal: AbortSignal }
export interface GhExit { code: number | null; stdout: string; stderr: string }
/** The seam tests replace: the `gh` CLI in the server, a script in tests. */
export type GhRunner = (run: GhRun) => Promise<GhExit>;

/** A run that has not answered by then is stopped: a stalled network must not hold a handover or a check forever. */
export const GH_TIMEOUT_MS = 30_000;

/** Only the fields read of `gh issue view` and `gh pr view --json`; `body` only where it was asked for. */
export const ghIssueSchema = z.object({ title: z.string().max(1_000), url: z.string().url().max(1_000), body: z.string().optional() });

/** Runs the `gh` CLI in the session's folder. */
export function spawnGh(command = 'gh'): GhRunner {
  return ({ args, cwd, signal }) => new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], signal, windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', fail);
    child.on('close', code => done({ code, stdout, stderr }));
  });
}
