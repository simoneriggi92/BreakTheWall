import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';
import { z } from 'zod';
import { INCOMING_PROTOCOL, lineReader, type IncomingReply } from '../desktop/incoming';
import { createMcpServer, type PromptDefinition, type ToolDefinition, type ToolResult } from './protocol';
import prompts from './prompts.json';

/**
 * Break the Wall's MCP server (P-20261028-mcp-integration): the tools an AI assistant sees, and the link to the
 * running app through its local entry point. Node only, so it runs on Claude Desktop's Node or the app's own
 * Electron in Node mode.
 */
export interface AppLink {
  /** The app's socket or pipe (`incomingAddress`). */
  address: string;
  /** Starts the app; false when it is not installed where it should be. */
  launch(): Promise<boolean>;
  /** How long to wait for a starting app to answer. */
  startupMs?: number;
}

export class AppUnreachable extends Error {}

/** One request line, one answer line; the connection closes after it. */
export function sendToApp(address: string, message: object, timeoutMs = 10_000): Promise<IncomingReply> {
  return new Promise((resolve, reject) => {
    const socket = connect(address, () => socket.write(JSON.stringify({ v: INCOMING_PROTOCOL, ...message }) + '\n'));
    const timer = setTimeout(() => { socket.destroy(); reject(new AppUnreachable('Break the Wall did not answer in time.')); }, timeoutMs);
    const read = lineReader(line => { clearTimeout(timer); socket.end(); try { resolve(JSON.parse(line)); } catch { reject(new AppUnreachable('Break the Wall sent an answer that is not JSON.')); } });
    socket.on('data', chunk => { if (!read(chunk)) { clearTimeout(timer); socket.destroy(); reject(new AppUnreachable('Break the Wall sent an answer that is too long.')); } });
    socket.on('error', error => { clearTimeout(timer); reject(new AppUnreachable(error.message)); });
  });
}

/** Sends to the app; if nothing listens, starts it and keeps trying until it answers or the wait ends. */
export async function reachApp(link: AppLink, message: object): Promise<IncomingReply> {
  try { return await sendToApp(link.address, message); }
  catch (error) { if (!(error instanceof AppUnreachable)) throw error; }
  if (!await link.launch()) throw new AppUnreachable(NOT_INSTALLED);
  const until = Date.now() + (link.startupMs ?? 15_000);
  while (Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try { return await sendToApp(link.address, message); }
    catch (error) { if (!(error instanceof AppUnreachable)) throw error; }
  }
  throw new AppUnreachable(NOT_CONNECTED);
}

const NOT_INSTALLED = 'Break the Wall is not installed on this computer, or not where it is expected. The user can download it from https://github.com/simoneriggi92/BreakTheWall/releases.';
const NOT_CONNECTED = 'Break the Wall is not accepting texts. Ask the user to open Break the Wall, choose "Use with Claude" at the top of the library, and turn on "Connect AI assistants"; then try again.';

/** How the app is started on each system: by name through LaunchServices on macOS, Squirrel's stable launcher on Windows. */
export function appLauncher(platform: string, env: Record<string, string | undefined>): () => Promise<boolean> {
  if (platform === 'darwin') return () => new Promise(resolve => execFile('open', ['-a', 'Break the Wall'], error => resolve(!error)));
  if (platform === 'win32') {
    return async () => {
      const exe = env.LOCALAPPDATA ? join(env.LOCALAPPDATA, 'BreakTheWall', 'BreakTheWall.exe') : '';
      if (!exe || !existsSync(exe)) return false;
      // The server may itself run as Node inside the app's Electron; the app it starts must not.
      const { ELECTRON_RUN_AS_NODE: _, ...rest } = env;
      spawn(exe, [], { detached: true, stdio: 'ignore', env: rest }).unref();
      return true;
    };
  }
  return async () => false;
}

/** The app's refusals, worded for the model so it can fix the request or tell the user. */
export function refusalText(reply: Extract<IncomingReply, { ok: false }>): string {
  const p = (reply.params ?? {}) as { chars?: number; limit?: number; lines?: number; line?: number };
  const n = (x?: number) => (x ?? 0).toLocaleString('en-US');
  switch (reply.code) {
    case 'empty': return 'Break the Wall refused the text: it is empty.';
    case 'too-large': return `Break the Wall refused the text: it has ${n(p.chars)} characters, and a source may have at most ${n(p.limit)}. Send only the part the user wants to understand.`;
    case 'too-many-lines': return `Break the Wall refused the text: it has ${n(p.lines)} lines, and a source may have at most ${n(p.limit)}. Send only the part the user wants to understand.`;
    case 'line-too-long': return `Break the Wall refused the text: line ${n(p.line)} is longer than ${n(p.limit)} characters. Break long lines before sending it.`;
    case 'binary': return 'Break the Wall refused the text: it contains control characters, so it does not look like text.';
    case 'protocol': return `Break the Wall and this extension do not match: ${reply.message} The user should install the extension again from "Use with Claude" in the app.`;
    default: return `Break the Wall could not open the text (${reply.code}).`;
  }
}

const openArgs = z.object({
  text: z.string(),
  title: z.string().optional(),
  question: z.string().optional(),
});

export const TOOLS: ToolDefinition[] = [{
  name: 'open_in_break_the_wall',
  title: 'Open in Break the Wall',
  description: 'Open a text in Break the Wall, the desktop app that takes a wall of text apart into source-linked parts the user can explore, run and reassemble. Use it when the user wants to study, understand or take apart a long answer, a document or a Markdown file in Break the Wall. The app comes to the front with the text in Studio; the user then chooses how to generate and presses Generate there. Send the text exactly as the user should study it, as plain text or Markdown (at most 40,000 characters and 1,500 lines).',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The full text to take apart, as plain text or Markdown.' },
      title: { type: 'string', description: 'A short name for the source, shown in citations (at most 120 characters).' },
      question: { type: 'string', description: 'What the user wants to understand about the text, as a question, if they said it (10 to 400 characters).' },
    },
    required: ['text'],
    additionalProperties: false,
  },
}];

/** The `break` prompt (M4a), shared with the Claude Desktop extension's manifest. */
export const PROMPTS: PromptDefinition[] = prompts;

export function createBreakTheWallServer(link: AppLink, version: string) {
  return createMcpServer({
    info: { name: 'break-the-wall', title: 'Break the Wall', version },
    instructions: 'Break the Wall is a desktop app on the user\'s computer. It takes a text apart into source-linked parts the user explores, runs and reassembles. Use open_in_break_the_wall when the user asks to open, study or take apart a text in Break the Wall.',
    tools: TOOLS,
    prompts: PROMPTS,
    call: async (name, args): Promise<ToolResult> => {
      if (name !== 'open_in_break_the_wall') throw new Error(`Unknown tool ${name}`);
      const input = openArgs.safeParse(args);
      if (!input.success) return { content: [{ type: 'text', text: 'open_in_break_the_wall needs "text" as a string, and optionally "title" and "question" as strings.' }], isError: true };
      const { text, title, question } = input.data;
      let reply: IncomingReply;
      try { reply = await reachApp(link, { type: 'open', text, ...(title ? { title } : {}), ...(question ? { question } : {}) }); }
      catch (error) { if (error instanceof AppUnreachable) return { content: [{ type: 'text', text: error.message }], isError: true }; throw error; }
      if (!reply.ok) return { content: [{ type: 'text', text: refusalText(reply) }], isError: true };
      if (!('lines' in reply)) return { content: [{ type: 'text', text: 'Break the Wall answered, but not as expected.' }], isError: true };
      return { content: [{ type: 'text', text: `Opened "${reply.title}" (${reply.lines} lines) in Break the Wall. Studio shows it${question ? ' with the question' : ''}; the user chooses how to generate and presses Generate there. Nothing has been generated or sent anywhere yet.` }] };
    },
  });
}
