import { sep } from 'node:path';
import { DisassemblyError, validateDisassembly, type Disassembly } from '../core/disassembly';
import { ExplorationError, type Exploration } from '../core/exploration';
import { acceptExploration, generatedExplorationId, sourceFindings } from '../core/exploration-generation';
import { importSource } from '../core/source';
import type { DisassemblyStore } from './disassembly-store';
import type { ExplorationStore } from './exploration-store';
import type { ExploreInput } from './incoming';

/**
 * How the "Use with Claude" panel connects an assistant (P-20261028-mcp-integration M4). The MCP server and the
 * Claude Desktop extension sit next to main.cjs; in the packaged app they are unpacked from app.asar, so that
 * another program (Claude Code, Claude Desktop) can read them.
 */
export function unpackedPath(path: string): string {
  return path.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);
}

/** Quotes one argument for the shell the command is pasted into: POSIX shells, or PowerShell and cmd on Windows. */
function quote(value: string, platform: string): string {
  return platform === 'win32' ? `"${value.replaceAll('"', '""')}"` : `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * The command that adds the server to Claude Code for every project (`--scope user`). It runs the server with the
 * app's own Electron in Node mode, so nothing else needs installing. A custom data folder (BTW_USER_DATA_DIR) is
 * passed on, so the server finds this app's entry point.
 */
export function claudeCodeCommand({ platform, executable, server, userData }: { platform: string; executable: string; server: string; userData?: string }): string {
  const env = ['ELECTRON_RUN_AS_NODE=1', ...(userData ? [`BTW_USER_DATA_DIR=${userData}`] : [])].map(x => `-e ${quote(x, platform)}`).join(' ');
  // `-e` takes several values, so it follows the name, as in `claude mcp add --help`; `--` ends the options.
  return `claude mcp add --scope user break-the-wall ${env} -- ${quote(executable, platform)} ${quote(server, platform)}`;
}

/**
 * Level B (M7): a disassembly an assistant wrote, saved through the local entry point. It passes the same validation
 * as any stored file, and only a new disassembly with the assistant's origin is accepted. Sending the same one again
 * (a retried save) returns it; a different one under a stored id is refused.
 */
export async function saveFromAssistant(store: Pick<DisassemblyStore, 'find' | 'save'>, input: unknown): Promise<Disassembly> {
  const d = await validateDisassembly(input);
  if (d.kind !== 'generated' || d.generation?.provider !== 'assistant' || d.expansions?.length) throw new DisassemblyError([{ path: 'generation', message: 'Only a new disassembly written by an assistant can be saved this way' }]);
  const stored = await store.find(d.id, d.revision);
  if (stored && JSON.stringify(stored) !== JSON.stringify(d)) throw new DisassemblyError([{ path: 'id', message: `${d.id} is already saved` }]);
  return stored ?? store.save(d);
}

/**
 * An exploration an assistant wrote (plan P-20261105-exploration X9): the source is imported as a paste, so its id and
 * line numbers are the ones the assistant read; the answer passes `acceptExploration`, as on the ChatGPT route, and is
 * saved with the assistant's origin. A refusal throws the findings for the assistant's one repair.
 */
export async function exploreFromAssistant(store: Pick<ExplorationStore, 'save'>, input: ExploreInput, now = new Date()): Promise<Exploration> {
  const source = await importSource({ kind: 'paste', title: input.source.title.trim() || 'From your assistant', text: input.source.text });
  const over = sourceFindings(source);
  if (over.length) throw new ExplorationError(over);
  const meta = { id: generatedExplorationId(now), createdAt: now.toISOString(), provider: 'assistant' as const, model: input.client.trim().slice(0, 200) || 'assistant' };
  return store.save(acceptExploration(input.answer, { source, language: input.language, meta }));
}
