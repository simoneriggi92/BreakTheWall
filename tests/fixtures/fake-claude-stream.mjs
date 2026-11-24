// Stands in for `claude -p --output-format stream-json` in tests: reads a file of the folder it runs in, streams a
// reply saying whether it was asked to fork, one JSON line at a time, and ends with the result line. Asked to fork
// while the prompt mentions "no such session", it fails as Claude Code does for a session it cannot find.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const args = process.argv.slice(2);
  const say = line => process.stdout.write(JSON.stringify(line) + '\n');
  if (args.includes('--resume') && input.includes('no such session')) {
    say({ type: 'result', subtype: 'error_during_execution', is_error: true });
    process.stderr.write('No conversation found with session ID\n');
    process.exit(1);
  }
  const file = readdirSync(process.cwd())[0];
  say({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: join(process.cwd(), file) } }] } });
  const reply = `Ran ${args.includes('--resume') ? 'forked' : 'fresh'}.`;
  for (const word of reply.split(/(?= )/)) say({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: word } } });
  say({ type: 'result', subtype: 'success', is_error: false, result: reply });
});
