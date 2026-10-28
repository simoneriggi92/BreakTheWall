import { homedir } from 'node:os';
import { defaultUserData, incomingAddress } from '../desktop/incoming';
import { serveStdio } from './protocol';
import { appLauncher, createBreakTheWallServer } from './server';

/** Set by `scripts/build-desktop.mjs` from package.json. */
declare const BTW_VERSION: string;

// The entry point bundled to dist-electron/mcp-server.cjs: one process per assistant session, stdio until it ends.
const userData = defaultUserData(process.platform, process.env, homedir());
const server = createBreakTheWallServer({ address: incomingAddress(process.platform, userData), launch: appLauncher(process.platform, process.env) }, BTW_VERSION);
process.stderr.write(`break-the-wall MCP server ${BTW_VERSION}: app at ${incomingAddress(process.platform, userData)}\n`);
void serveStdio(server, process.stdin, process.stdout).then(() => process.exit(0));
