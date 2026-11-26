import type { On } from 'claude-code'
import { expect, mock, test, type Engine } from 'claude-code/testing'

import { modMessages } from './messages'

const t = modMessages(Intl.DateTimeFormat().resolvedOptions().locale)

/**
 * The mod against the engine's test kit (`claude plugin test plugin`): the test answers what the mod asks of Claude
 * Code (processes, the session, fetches, prompts) as the local server and the session would, and reads back what the
 * mod sent. The mod's only logic is the order of its calls, so that order is what these tests hold.
 */
interface Fetched { url: string; method: string; body?: string }

/** Claude Code beneath the mod: Node 22, a launcher that found the server, a session, and a server that answers. */
function engine(on: On) {
  const state = {
    session: 'sess-1',
    /** Where Claude Code keeps the session's transcript; empty where it keeps none. */
    transcript: '/home/me/.claude/projects/-work/sess-1.jsonl',
    fetched: [] as Fetched[],
    /** Every launcher run, its arguments after the script. */
    launched: [] as string[][],
    submitted: [] as { text: string; asUser: boolean }[],
    /** Messages the server holds for the session, handed to the next delivery polls in order. */
    deliveries: [] as { id: string; message: string }[],
    failSubmit: false,
    /** Every call in the order the mod made it, to read submit-then-confirm. */
    order: [] as string[],
    /** Whether the launcher opens a tab: false while a page is connected. */
    opens: true,
    /** How many times the mod asked for the hook environment. */
    hookEnvCalls: 0,
    /** What a launcher run throws instead of answering: a call the engine lacks throws a TypeError where it is made. */
    launchThrows: undefined as Error | undefined,
    /** The Claude Code the session runs on, or what asking for it throws on a build that lacks the call. */
    version: '2.1.332' as string | Error,
  }
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.log', () => ({ value: undefined }))
  on('process.hookEnv', () => { state.hookEnvCalls++; return { value: { CLAUDE_PLUGIN_ROOT: '/plugin' } } })
  on('process.run', (_, e) => {
    if (e.argv[1] !== '--version') {
      if (state.launchThrows) throw state.launchThrows
      state.launched.push(e.argv.slice(2))
    }
    return { value: {
      exitCode: 0, stderr: '', isStdoutTruncated: false, isStderrTruncated: false,
      stdout: e.argv[1] === '--version' ? 'v22.23.2\n' : JSON.stringify({ port: 4000, secret: 's3cret', url: 'http://127.0.0.1:4000/#t=s3cret', opened: state.opens }) + '\n',
    } }
  })
  on('session.id', () => ({ value: state.session }))
  on('session.version', () => {
    if (state.version instanceof Error) throw state.version
    return { value: { version: state.version, base: state.version } }
  })
  on('session.cwd', () => ({ value: '/work' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.info', () => ({ value: { transcriptPath: state.transcript, platform: 'macos' as const, isHosted: false } }))
  on('http.fetch', (_, e) => {
    const method = e.init?.method ?? 'GET'
    state.fetched.push({ url: e.url, method, body: e.init?.body as string | undefined })
    state.order.push(`${method} ${new URL(e.url).pathname}`)
    const answer = (text: string) => ({ value: { status: 200, ok: true, headers: {}, text } })
    if (method === 'GET' && e.url.endsWith('/delivery')) return answer(JSON.stringify(state.deliveries.shift() ?? {}))
    return answer('{}')
  })
  on('prompt.submit', (_, e) => {
    state.order.push('submit')
    if (state.failSubmit) throw new Error('the session refused the prompt')
    state.submitted.push({ text: e.text, asUser: e.origin.kind === 'plugin' && e.origin.asUser === true })
    return { text: e.text }
  })
  return state
}

async function startSession($: Engine, clock: { settle(): Promise<void> }) {
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
}

const turn = (answer: string, more: { reason?: 'answer' | 'aborted'; agentId?: string } = {}) =>
  ({ answer, durationMs: 1, isAborted: more.reason === 'aborted', turnId: `t-${answer}`, reason: more.reason ?? 'answer', ...(more.agentId ? { agentId: more.agentId } : {}) }) as const

test('posts every turn\'s final text with its session, how it ended and its agent, and leaves the deciding to the server', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  await $.turn.complete(turn('the main loop asks'))
  await $.turn.complete(turn('a subagent reports', { agentId: 'agent-7' }))
  await $.turn.complete(turn('half a', { reason: 'aborted' }))
  await clock.settle()
  const posted = server.fetched.filter(x => x.url === 'http://127.0.0.1:4000/api/turns').map(x => JSON.parse(x.body ?? '{}'))
  expect(posted).toEqual([
    { session: 'sess-1', cwd: '/work', text: 'the main loop asks', reason: 'answer' },
    { session: 'sess-1', cwd: '/work', text: 'a subagent reports', reason: 'answer', agent: 'agent-7' },
    { session: 'sess-1', cwd: '/work', text: 'half a', reason: 'aborted' },
  ])
})

test('submits a delivered message as the person\'s own words, and confirms it only after', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  server.deliveries.push({ id: 'round-3', message: '**Q1 · Where?** recommendation' })
  await startSession($, clock)
  expect(server.submitted).toEqual([{ text: '**Q1 · Where?** recommendation', asUser: true }])
  const confirm = 'POST /api/sessions/sess-1/delivery/round-3'
  expect(server.order).toContain(confirm)
  expect(server.order.indexOf('submit')).toBeLessThan(server.order.indexOf(confirm))
  const confirmed = server.fetched.find(x => x.url.endsWith('/delivery/round-3'))
  expect(confirmed?.url).toBe('http://127.0.0.1:4000/api/sessions/sess-1/delivery/round-3')
})

test('leaves a message unconfirmed when its submit fails, so the server offers it again', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  server.failSubmit = true
  server.deliveries.push({ id: 'round-3', message: 'the answers' })
  await startSession($, clock)
  expect(server.order).toContain('submit')
  expect(server.fetched.filter(x => x.method === 'POST' && x.url.includes('/delivery/'))).toEqual([])
})

test('reads the session id again for each poll, as /clear and /resume change it without a new session.start', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  server.session = 'sess-2'
  server.deliveries.push({ id: 'free-1', message: 'after the clear' })
  // A poll the server answered is followed 1 ms later: one step of the clock is one more poll.
  await clock.advance(1)
  expect(server.fetched.filter(x => x.url.endsWith('/delivery')).map(x => new URL(x.url).pathname)).toEqual([
    '/api/sessions/sess-1/delivery',
    '/api/sessions/sess-2/delivery',
  ])
  expect(server.submitted.map(x => x.text)).toEqual(['after the clear'])
})

const posted = (server: ReturnType<typeof engine>, path: string) => server.fetched.filter(x => x.method === 'POST' && new URL(x.url).pathname === path).map(x => JSON.parse(x.body ?? '{}'))

test('on /clear, reports the ending session ended and registers the id the session goes on under', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  await $.session.end({ reason: 'clear', sessionId: 'sess-1', resume: { id: 'sess-1' } })
  expect(posted(server, '/api/sessions/sess-1/end')).toEqual([{ reason: 'clear' }])
  server.session = 'sess-2'
  await clock.advance(1_000)
  expect(posted(server, '/api/sessions').at(-1)).toEqual({ id: 'sess-2', cwd: '/work', model: 'claude-opus-5-5', transcript: '/home/me/.claude/projects/-work/sess-1.jsonl' })
})

test('on an exit, reports the session ended and never registers its id again', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  const before = posted(server, '/api/sessions').length
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 'sess-1', resume: { id: 'sess-1' } })
  await clock.advance(1_000)
  expect(posted(server, '/api/sessions/sess-1/end')).toEqual([{ reason: 'prompt_input_exit' }])
  expect(posted(server, '/api/sessions')).toHaveLength(before)
})

test('runs the launcher with its session, which does not count as another when an older server is replaced', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  expect(server.launched).toEqual([['start', 'sess-1']])
})

const registered = (server: ReturnType<typeof engine>) =>
  server.fetched.filter(x => x.url === 'http://127.0.0.1:4000/api/sessions').map(x => JSON.parse(x.body ?? '{}'))

test('registers the session with its model and the side-chat model set in the plugin', { options: { sideChatModel: 'haiku' } }, async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  expect(registered(server)[0]).toEqual({ id: 'sess-1', cwd: '/work', model: 'claude-opus-5-5', transcript: '/home/me/.claude/projects/-work/sess-1.jsonl', sideChatModel: 'haiku' })
})

test('leaves the side-chat model to the server\'s default when the plugin sets none', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  expect(registered(server)[0]).toEqual({ id: 'sess-1', cwd: '/work', model: 'claude-opus-5-5', transcript: '/home/me/.claude/projects/-work/sess-1.jsonl' })
})

test('registers the session with where Claude Code keeps its transcript, so the server knows when it is gone (#103)', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  server.transcript = ''
  await startSession($, clock)
  // A session that keeps no transcript here names none: the server then never turns it read-only.
  expect(registered(server)[0]).toEqual({ id: 'sess-1', cwd: '/work', model: 'claude-opus-5-5' })
})

test('delivers what was queued for a session resumed with claude --resume <id> as soon as it starts, before the person types (#103)', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  server.session = 'sess-ended'
  server.deliveries.push({ id: 'round-2', message: 'answered while the terminal was closed' })
  await startSession($, clock)
  expect(server.fetched.find(x => x.url.endsWith('/delivery'))?.url).toBe('http://127.0.0.1:4000/api/sessions/sess-ended/delivery')
  expect(server.submitted).toEqual([{ text: 'answered while the terminal was closed', asUser: true }])
  expect(server.order).toContain('POST /api/sessions/sess-ended/delivery/round-2')
})

/** `/break-the-wall` typed in the composer. */
const slash = { command: 'break-the-wall', args: '', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } }

test('finds the launcher under the plugin\'s own folder, with no call on hookEnv, which Claude Code before 2.1.326 lacks (#145)', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  await $.command.run(slash)
  expect(server.launched.map(argv => argv[0])).toEqual(['start', 'open'])
  expect(server.hookEnvCalls).toBe(0)
})

test('/break-the-wall asks for a newer Claude Code when the launch fails on one older than plugin.json allows (#145)', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  server.version = '2.1.318'
  server.launchThrows = new Error('$.process.hookEnv is not a function')
  const { text } = await $.command.run(slash)
  expect(text).toBe(t.outdated)
})

test('/break-the-wall asks for a newer Claude Code when the launch fails and the build cannot even say its version (#145)', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  server.version = new Error('$.session.version is not a function')
  server.launchThrows = new Error('$.process.hookEnv is not a function')
  const { text } = await $.command.run(slash)
  expect(text).toBe(t.outdated)
})

test('/break-the-wall still says the page did not open when the launch fails on a Claude Code new enough (#145)', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  server.launchThrows = new Error('The local server did not start.')
  const { text } = await $.command.run(slash)
  expect(text).toBe(t.failed)
})

test('/break-the-wall prints the page\'s address, whether it opened a tab or one was already open (#147)', async ($, on) => {
  const clock = mock.clock(on)
  const server = engine(on)
  await startSession($, clock)
  const url = 'http://127.0.0.1:4000/#t=s3cret'
  expect((await $.command.run(slash)).text).toBe(t.opened(url))
  server.opens = false
  expect((await $.command.run(slash)).text).toBe(t.alreadyOpen(url))
})
