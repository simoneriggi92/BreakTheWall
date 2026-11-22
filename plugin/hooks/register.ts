import type { EngineInterface, Register } from 'claude-code'

import { modMessages, nodeIsSupported } from './messages'

/**
 * Break the Wall's mod (#94): a thin adapter between a Claude Code session and the local server. It checks Node,
 * has the launcher find or start the server, keeps this session registered, and serves `/break-the-wall` without a
 * model turn. Every decision (which server, whether to open a tab) is the launcher's, where it is tested.
 */
const COMMAND = 'break-the-wall'
/** Well inside the server's two-minute registration, so a live session never lapses. */
const RENEW_MS = 30_000

interface Server { port: number; secret: string }
type Launched = Server & { opened?: boolean }

const t = modMessages(Intl.DateTimeFormat().resolvedOptions().locale)
/** This session's view of the server; a reload of the module starts it over, and the next call finds the server again. */
let node: 'ok' | 'missing' | undefined
let server: Server | undefined
/** The timer that renews this session's registration; started once per module load. */
let renewal: ReturnType<EngineInterface['clock']['every']> | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: COMMAND, description: t.description })
    if (!e.isInteractive) return started
    // Off the session's start: a slow first launch must not hold the prompt. Without Node, nothing else happens.
    void (async () => {
      node = await checkNode($)
      if (node !== 'ok') return
      try {
        server = await launch($, 'start')
        await registerSession($)
        renewal ??= $.clock.every(RENEW_MS, () => { void registerSession($).catch(() => {}) })
      } catch (error) {
        $.ui.log(`break-the-wall: ${String(error)}`, { to: 'debug' })
      }
    })()
    return started
  })

  on('command.run', { command: COMMAND }, async $ => {
    if (node !== 'ok') node = await checkNode($)
    if (node !== 'ok') return { text: t.nodeMissing, isTextDisplayOnly: true }
    try {
      const reply = await launch($, 'open')
      server = reply
      void registerSession($).catch(() => {})
      return { text: reply.opened ? t.opened : t.alreadyOpen, isTextDisplayOnly: true }
    } catch (error) {
      $.ui.log(`break-the-wall: ${String(error)}`, { to: 'debug' })
      return { text: t.failed, isTextDisplayOnly: true }
    }
  })
}

/** Re-reads the session id each time: `/clear` and `/resume` change it without a new `session.start`. */
async function registerSession($: EngineInterface) {
  if (!server) return
  const body = JSON.stringify({ id: await $.session.id(), cwd: await $.session.cwd() })
  const first = await postSession($, server, body).catch(() => undefined)
  if (first?.ok) return
  // The server is gone or was replaced: find or start it again, then register once more.
  server = await launch($, 'start')
  await postSession($, server, body)
}

function postSession($: EngineInterface, to: Server, body: string) {
  return $.http.fetch(`http://127.0.0.1:${to.port}/api/sessions`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-btw-secret': to.secret }, body,
  })
}

async function checkNode($: EngineInterface): Promise<'ok' | 'missing'> {
  try {
    const { exitCode, stdout } = await $.process.run(['node', '--version'], { timeoutMs: 10_000 })
    return exitCode === 0 && nodeIsSupported(stdout) ? 'ok' : 'missing'
  } catch {
    return 'missing'
  }
}

/** `node launcher.cjs start | open`: one JSON line back, the server left running on its own. */
async function launch($: EngineInterface, command: 'start' | 'open'): Promise<Launched> {
  const { CLAUDE_PLUGIN_ROOT: root } = await $.process.hookEnv()
  const { stdout } = await $.process.run(['node', `${root}/server/launcher.cjs`, command], { timeoutMs: 30_000 })
  const reply = JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}') as Partial<Launched> & { error?: string }
  if (typeof reply.port !== 'number' || typeof reply.secret !== 'string') throw new Error(reply.error ?? 'The launcher gave no server.')
  return { port: reply.port, secret: reply.secret, opened: reply.opened }
}
