import type { EngineInterface, Register } from 'claude-code'

import { modMessages, nodeIsSupported } from './messages'

/**
 * Break the Wall's mod (#94, #95): a thin adapter between a Claude Code session and the local server. It checks
 * Node, has the launcher find or start the server, keeps this session registered, serves `/break-the-wall` without a
 * model turn, posts each main-loop turn's final text, and submits the answers the server hands back as the person's
 * own words. It drops only what the server cannot see is not the session's own answer (a subagent's report, an
 * interrupted turn); every other decision (which server, whether to open a tab, whether a turn holds a round, the
 * message's words) is the server's, where it is tested.
 */
const COMMAND = 'break-the-wall'
/** Well inside the server's two-minute registration, so a live session never lapses. */
const RENEW_MS = 30_000
/** After a failed delivery poll; a held poll that simply ran out is followed at once. */
const DELIVERY_RETRY_MS = 5_000

interface Server { port: number; secret: string }
type Launched = Server & { opened?: boolean }

const t = modMessages(Intl.DateTimeFormat().resolvedOptions().locale)
/** This session's view of the server; a reload of the module starts it over, and the next call finds the server again. */
let node: 'ok' | 'missing' | undefined
let server: Server | undefined
/** The timer that renews this session's registration; started once per module load. */
let renewal: ReturnType<EngineInterface['clock']['every']> | undefined
/** Whether this module load already long-polls for deliveries: one chain of polls, never two. */
let delivering = false

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
        if (!delivering) { delivering = true; void pollDelivery($) }
      } catch (error) {
        $.ui.log(`break-the-wall: ${String(error)}`, { to: 'debug' })
      }
    })()
    return started
  })

  // The server decides whether the text holds a round; a subagent's report is not this session asking the person.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && e.reason === 'answer' && e.answer.trim() !== '') {
      void postTurn($, e.answer).catch(error => { $.ui.log(`break-the-wall: ${String(error)}`, { to: 'debug' }) })
    }
    return result
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
  await post($, '/api/sessions', JSON.stringify({ id: await $.session.id(), cwd: await $.session.cwd() }))
}

/** The turn's final text, as it is: the server recognises a round, or ignores the turn. */
async function postTurn($: EngineInterface, text: string) {
  if (!server) return
  await post($, '/api/turns', JSON.stringify({ session: await $.session.id(), cwd: await $.session.cwd(), text }))
}

async function post($: EngineInterface, path: string, body: string) {
  const first = server ? await postTo($, server, path, body).catch(() => undefined) : undefined
  if (first?.ok) return
  // The server is gone or was replaced: find or start it again, then post once more.
  server = await launch($, 'start')
  const second = await postTo($, server, path, body)
  if (!second.ok) throw new Error(`${path} answered ${second.status}`)
}

function postTo($: EngineInterface, to: Server, path: string, body: string) {
  return $.http.fetch(`http://127.0.0.1:${to.port}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-btw-secret': to.secret }, body,
  })
}

/**
 * One long-poll for this session's answers, then the next on a timer: the server holds it below `$.http.fetch`'s
 * 30 seconds. A message is submitted as the person's own words (`$.prompt.submit` waits until the session is idle)
 * and then confirmed. The session id is read again each time, as `/clear` and `/resume` change it.
 */
async function pollDelivery($: EngineInterface) {
  let wait = DELIVERY_RETRY_MS
  try {
    if (server) {
      const id = await $.session.id()
      const reply = await $.http.fetch(`http://127.0.0.1:${server.port}/api/sessions/${encodeURIComponent(id)}/delivery`, { headers: { 'x-btw-secret': server.secret } })
      if (reply.ok) {
        wait = 1
        const { round, message } = JSON.parse(reply.text) as { round?: unknown; message?: unknown }
        if (typeof round === 'number' && typeof message === 'string' && message !== '') {
          await $.prompt.submit({ text: message, asUser: true })
          // Confirmed only once submitted: a submit that fails leaves the message to come back after its lease.
          await $.http.fetch(`http://127.0.0.1:${server.port}/api/sessions/${encodeURIComponent(id)}/delivery/${round}`, { method: 'POST', headers: { 'x-btw-secret': server.secret } })
        }
      }
    }
  } catch (error) {
    wait = DELIVERY_RETRY_MS
    $.ui.log(`break-the-wall: ${String(error)}`, { to: 'debug' })
  }
  $.clock.after(wait, () => { void pollDelivery($) })
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
