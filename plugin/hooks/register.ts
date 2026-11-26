import type { EngineInterface, Register } from 'claude-code'

import { claudeCodeIsSupported, pluginRootFrom } from './engine-support'
import { modMessages, nodeIsSupported } from './messages'

/**
 * Break the Wall's mod (#94, #95): a thin adapter between a Claude Code session and the local server. It checks
 * Node, has the launcher find or start the server, keeps this session registered, serves `/break-the-wall` without a
 * model turn, posts each main-loop turn's final text, and submits the answers the server hands back as the person's
 * own words, and reports a session's end so the page follows `/clear` and `/resume` (#102). Every decision (which
 * server, whether to open a tab, whether a turn holds a round, the message's words) is the server's, where it is
 * tested; what the mod still owns, the order of its calls, `register.test.ts` holds.
 */
const COMMAND = 'break-the-wall'
/** Well inside the server's two-minute registration, so a live session never lapses. */
const RENEW_MS = 30_000
/** After `session.end`, once the engine has gone on under the new id of a `/clear` or `/resume`. */
const REREGISTER_MS = 1_000
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
/** The plugin's side-chat model (`userConfig.sideChatModel`), handed to the server as set; empty when the person set none. */
let sideChatModel = ''

export const register: Register = (on, options) => {
  sideChatModel = typeof options.sideChatModel === 'string' ? options.sideChatModel.trim() : ''
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

  // Every turn goes to the server as the engine reports it: whether it holds a round, or is a subagent's report or an
  // interrupted turn, is the server's decision, where it is tested.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    void postTurn($, { text: e.answer, reason: e.reason, ...(e.agentId ? { agent: e.agentId } : {}) })
      .catch(error => { $.ui.log(`break-the-wall: ${String(error)}`, { to: 'debug' }) })
    return result
  })

  // `/clear` and an in-process `/resume` end this session and go on under another id, with no session.start: the
  // ending one leaves the live sessions at once (#102), and the one that follows registers. Within the end's short
  // bound, so one fetch and nothing that could launch a server.
  on('session.end', async ($, e, next) => {
    if (server) await postTo($, server, `/api/sessions/${encodeURIComponent(e.sessionId)}/end`, JSON.stringify({ reason: e.reason })).catch(() => undefined)
    const ended = await next(e)
    if (server) $.clock.after(REREGISTER_MS, () => { void registerNext($, e.sessionId).catch(() => {}) })
    return ended
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
      return { text: await sessionClaudeCodeIsSupported($) ? t.failed : t.outdated, isTextDisplayOnly: true }
    }
  })
}

/**
 * Re-reads the session id each time: `/clear` and `/resume` change it without a new `session.start`. The session's
 * model, and the plugin's side-chat model when set, go with it: the server picks which one a side chat runs on. So does
 * where Claude Code keeps the session's transcript (#103): once that file is gone the server turns the session's rounds
 * read-only, as nothing can resume or fork it. A session that keeps none here names none.
 */
async function registerSession($: EngineInterface) {
  if (!server) return
  const transcript = await transcriptOf($)
  const body = {
    id: await $.session.id(), cwd: await $.session.cwd(), model: await $.session.model(),
    ...(transcript ? { transcript } : {}), ...(sideChatModel ? { sideChatModel } : {}),
  }
  await post($, '/api/sessions', JSON.stringify(body))
}

/** The transcript's path, or empty when the engine gives none: a registration never fails over it. */
async function transcriptOf($: EngineInterface): Promise<string> {
  try {
    const { transcriptPath } = await $.session.info()
    return typeof transcriptPath === 'string' ? transcriptPath : ''
  } catch {
    return ''
  }
}

/** The session that went on after `ended`; none when the process is leaving and the id is still the ending one. */
async function registerNext($: EngineInterface, ended: string) {
  if (await $.session.id() === ended) return
  await registerSession($)
}

/** The turn as the engine reported it: the server recognises a round, or ignores the turn. */
async function postTurn($: EngineInterface, turn: { text: string; reason: string; agent?: string }) {
  if (!server) return
  await post($, '/api/turns', JSON.stringify({ session: await $.session.id(), cwd: await $.session.cwd(), ...turn }))
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
        // `delivery` names what the message answers, a round or a free block (`round-2`, `free-1`): the mod only hands it back.
        const { id: delivery, message } = JSON.parse(reply.text) as { id?: unknown; message?: unknown }
        if (typeof delivery === 'string' && typeof message === 'string' && message !== '') {
          await $.prompt.submit({ text: message, asUser: true })
          // Confirmed only once submitted: a submit that fails leaves the message to come back after its lease.
          await $.http.fetch(`http://127.0.0.1:${server.port}/api/sessions/${encodeURIComponent(id)}/delivery/${encodeURIComponent(delivery)}`, { method: 'POST', headers: { 'x-btw-secret': server.secret } })
        }
      }
    }
  } catch (error) {
    wait = DELIVERY_RETRY_MS
    $.ui.log(`break-the-wall: ${String(error)}`, { to: 'debug' })
  }
  $.clock.after(wait, () => { void pollDelivery($) })
}

/** The plugin's folder, as `pluginRootFrom` picks it from what this build offers (#145). */
function pluginRoot($: EngineInterface): Promise<string> {
  return pluginRootFrom(() => $.plugin.root, () => $.process.hookEnv())
}

/**
 * Asked only once a launch failed (#145): a Claude Code older than plugin.json's `engines` range, which it ignores
 * before 2.1.323, lacks calls the mod makes. A build without `$.session.version` is older still.
 */
async function sessionClaudeCodeIsSupported($: EngineInterface): Promise<boolean> {
  try {
    return claudeCodeIsSupported((await $.session.version()).version)
  } catch {
    return false
  }
}

async function checkNode($: EngineInterface): Promise<'ok' | 'missing'> {
  try {
    const { exitCode, stdout } = await $.process.run(['node', '--version'], { timeoutMs: 10_000 })
    return exitCode === 0 && nodeIsSupported(stdout) ? 'ok' : 'missing'
  } catch {
    return 'missing'
  }
}

/**
 * `node launcher.cjs start | open <session>`: one JSON line back, the server left running on its own. The session
 * is the launcher's to leave out when it counts the sessions an older server still serves (#102).
 */
async function launch($: EngineInterface, command: 'start' | 'open'): Promise<Launched> {
  const { stdout } = await $.process.run(['node', `${await pluginRoot($)}/server/launcher.cjs`, command, await $.session.id()], { timeoutMs: 30_000 })
  const reply = JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}') as Partial<Launched> & { error?: string }
  if (typeof reply.port !== 'number' || typeof reply.secret !== 'string') throw new Error(reply.error ?? 'The launcher gave no server.')
  return { port: reply.port, secret: reply.secret, opened: reply.opened }
}
