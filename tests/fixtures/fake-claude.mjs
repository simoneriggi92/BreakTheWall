// Stands in for `claude -p` in tests: prints, as Claude Code's JSON result, the arguments and stdin it received.
// Given the prompt "hang" it never answers, so a test can cancel it.
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  if (input === 'hang') { setInterval(() => {}, 1000); return; }
  const args = process.argv.slice(2);
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: { args, input, cwd: process.cwd() } }));
});
