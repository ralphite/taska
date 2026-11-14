// What the Agents sheet shows, from the model (F768): whether one is around and what waits for one; every agent
// session seen in the project, by its app, a manager's workers under it, each as it is now (working, idle, waiting
// for you, gone); the one to show first; how to connect. Pure: the container and the stories both use it.

import { AROUND_MS, agentState, presenceOf } from '../../model/agents'
import { ago } from '../../model/time'
import { closed, waitsInQueue, withOpenKids } from '../../model/items'
import type { ProjectModel } from '../../model/project'
import type { AgentSeen, AgentSession, Item } from '../../model/types'
import { whoName } from '../../model/words'

export type SessionState = 'working' | 'idle' | 'waiting' | 'gone'

export interface ItemRef {
  n: number
  code: string
  title: string
}

/** A session as the sheet shows it: in the list (its state, name, when last heard of) and on its own page. */
export interface SessionFacts {
  key: string
  app: string
  name: string
  state: SessionState
  /** last heard of: now, 5m, 2h */
  when: string
  /** drawn under the session that started it */
  worker: boolean
  /** "Working · 20m" */
  pill: string
  /** its folder, ~ for the home folder ('' when its app does not say) */
  folder: string
  /** what it waits for you on ('' when its app does not say) and how long */
  waits: { what: string; for: string } | null
  on: ItemRef | null
  workers: { key: string; name: string; state: SessionState; on: ItemRef | null }[]
  /** its last messages in Taska, the latest first */
  activity: { id: number; when: string; item: ItemRef; text: string }[]
  /** back to the session in its app: Claude Code's own link, Codex's resume command */
  link: { kind: 'open'; href: string } | { kind: 'resume'; cmd: string } | null
}

export interface AgentsFacts {
  tone: 'ok' | 'bad' | 'idle' | 'blocked'
  line: string
  /** the agent the line names: its name there drawn by its app's icon where it has one (T711) */
  lineBy?: string
  queue: number
  later: number
  /** by app (Claude Code, Codex, Antigravity, then others), each session followed by its workers */
  groups: { app: string; name: string; sessions: SessionFacts[] }[]
  /** the session shown when the sheet opens: one waiting for you, else one working, else the latest; null: none */
  start: string | null
  /** what to paste to an agent to connect it (its folder once, then the work); `far`: the same for another network */
  far: string
  ask: string
  guide: string | null
}

const APPS = ['claude-code', 'codex', 'antigravity']
/** the group of agents Taska has no app for */
export const OTHERS = 'others'
const RANK: Record<SessionState, number> = { waiting: 0, working: 1, idle: 2, gone: 3 }
const PILL: Record<SessionState, string> = { working: 'Working', idle: 'Idle', waiting: 'Waiting for you', gone: 'Gone' }

/** A session's name as messages carry it (the server keeps 60 characters of it, spaces made one). */
const sesKey = (s: string | null | undefined) => (s || '').split(/\s+/).filter(Boolean).join(' ').slice(0, 60)
const keyOf = (app: string, name: string) => `${app}\u0000${name}`
const short = (from: number, at: number) => (at - from < 60e3 ? '' : ago(from, at, 'short'))
const firstLine = (text: string) => (text.split('\n').find((l) => l.trim()) || '').replace(/[*_`#>]+/g, '').trim()
const home = (cwd: string) => cwd.replace(/^\/(Users|home)\/[^/]+(?=\/|$)/, '~')

/** How a session is now: as its app says (Claude Code, Codex), else by when it was last heard of and whether it is on
 * an item (Antigravity: seen lately, its waker waiting, or gone). A Codex thread is idle once its turn ends, also
 * long after its app closed: one not heard of lately is gone. */
export function sessionState(app: string, s: AgentSession, blocked: boolean, at: number): SessionState {
  const quiet = !s.waiting && at - s.t >= AROUND_MS
  if (blocked || s.status === 'waiting') return 'waiting'
  if (s.status === 'busy') return 'working'
  if (s.status === 'idle') return app === 'codex' && quiet ? 'gone' : 'idle'
  if (s.status === 'exited' || quiet) return 'gone'
  return s.on ? 'working' : 'idle'
}

/** An agent's sessions; one that never named a session is the agent itself, by its app's name. */
function sessionsOf(a: AgentSeen): AgentSession[] {
  const all: AgentSession[] = (a.sessions || []).filter((x) => x.name)
  for (const b of a.blocked || []) if (!all.some((x) => x.name === b.session)) all.push({ name: b.session, t: b.since || a.t, status: 'waiting', waitingFor: b.waitingFor, since: b.since })
  return all.length ? all : [{ name: '', t: a.t, waiting: a.waiting }]
}

function linkOf(app: string, sid: string | undefined): SessionFacts['link'] {
  if (!sid) return null
  if (app === 'claude-code') return { kind: 'open', href: `claude://code/continue?session=${encodeURIComponent(sid)}` }
  if (app === 'codex') return { kind: 'resume', cmd: `codex resume ${sid}` }
  return null
}

/** Every session of the project's agents, grouped by app, each followed by its workers; and the one to show first. */
export function sessionGroups(m: ProjectModel): Pick<AgentsFacts, 'groups' | 'start'> {
  const at = m.at
  const items = new Map<number, Item>(m.items.map((it) => [it.n, it]))
  const ref = (n: number | undefined): ItemRef | null => {
    const it = n == null ? undefined : items.get(n)
    return it ? { n: it.n, code: it.code, title: it.title } : null
  }
  const said = new Map<string, { id: number; t: number; item: ItemRef; text: string }[]>()
  for (const it of m.items)
    for (const x of it.thread) {
      if (x.hidden || x.by === 'you' || !x.text.trim()) continue
      const k = keyOf(x.by, sesKey(x.ses))
      const list = said.get(k) ?? []
      list.push({ id: x.id, t: Date.parse(x.t), item: { n: it.n, code: it.code, title: it.title }, text: firstLine(x.text) })
      said.set(k, list)
    }
  type Row = { app: string; s: AgentSession; f: SessionFacts }
  const rows: Row[] = m.facts.agents.flatMap((a) =>
    sessionsOf(a).map((s) => {
      const b = a.blocked?.find((x) => x.session === s.name)
      const state = sessionState(a.name, s, !!b, at)
      const name = s.name || whoName(a.name)
      const since = state === 'gone' ? s.t : s.since || (state === 'working' && s.on ? s.on.since : s.t)
      const dur = short(since, at)
      const what = b?.waitingFor || s.waitingFor || ''
      const f: SessionFacts = {
        key: keyOf(a.name, s.name),
        app: a.name,
        name,
        state,
        when: ago(s.t, at, 'short'),
        worker: false,
        pill: dur ? `${PILL[state]} · ${dur}` : PILL[state],
        folder: home(s.cwd || ''),
        waits: state === 'waiting' ? { what, for: short(b?.since || s.since || s.t, at) } : null,
        on: ref(s.on?.n),
        workers: [],
        activity: (said.get(keyOf(a.name, sesKey(s.name))) ?? [])
          .sort((x, y) => y.t - x.t || y.id - x.id)
          .slice(0, 5)
          .map((x) => ({ id: x.id, when: ago(x.t, at, 'short'), item: x.item, text: x.text })),
        link: linkOf(a.name, s.sid),
      }
      return { app: a.name, s, f }
    }),
  )
  const order = (x: Row, y: Row) => RANK[x.f.state] - RANK[y.f.state] || y.s.t - x.s.t
  const parentOf = (r: Row) => (r.s.parent ? rows.find((p) => p !== r && sesKey(p.s.name) === sesKey(r.s.parent) && p.app === r.app) ?? rows.find((p) => p !== r && sesKey(p.s.name) === sesKey(r.s.parent)) : undefined)
  const kids = new Map<Row, Row[]>()
  const tops: Row[] = []
  for (const r of rows) {
    const p = parentOf(r)
    if (p && !p.s.parent) kids.set(p, [...(kids.get(p) ?? []), r])
    else tops.push(r)
  }
  for (const [p, ks] of kids) p.f.workers = ks.sort(order).map((k) => ({ key: k.f.key, name: k.f.name, state: k.f.state, on: k.f.on }))
  // the apps Taska knows each in its own group; every other agent name in one group of others (not a group each)
  const groupOf = (app: string) => (APPS.includes(app) ? app : OTHERS)
  const apps = [...new Set(rows.map((r) => groupOf(r.app)))].sort((x, y) => (APPS.indexOf(x) + 1 || 99) - (APPS.indexOf(y) + 1 || 99))
  const groups = apps.map((app) => ({
    app,
    name: app === OTHERS ? 'Others' : whoName(app),
    sessions: tops
      .filter((r) => groupOf(r.app) === app)
      .sort(order)
      .flatMap((r) => [r.f, ...(kids.get(r) ?? []).sort(order).map((k) => ({ ...k.f, worker: true }))]),
  }))
  const all = groups.flatMap((g) => g.sessions)
  const first = all.find((s) => s.state === 'waiting') ?? all.find((s) => s.state === 'working') ?? [...all].sort((x, y) => RANK[x.state] - RANK[y.state])[0]
  return { groups, start: first?.key ?? null }
}

/** `guide` is the guide for agents, once it has come. */
export function agentsFacts(m: ProjectModel, guide: string | null): AgentsFacts {
  const live = m.items.filter((it) => !it.mergedInto && !it.archived)
  const kids = withOpenKids(m.items)
  const queue = live.filter((it) => waitsInQueue(it, kids)).length
  const [tone, , line] = agentState(m.facts.agents, m.facts.work, m.at, queue)
  const p = presenceOf(m.facts.agents, m.at)
  const base = m.facts.base
  // one text to paste to an agent: it connects its folder once (the project's address and Taska's skill), then works
  // (F768 r1305: the command alone was not needed beside it)
  const say = (b: string) =>
    `This project tracks work in Taska. Once in this project's folder, run \`curl -s ${b}/connect | sh\`. Then run \`curl -s ${b}/agent\` to learn the interface, follow \`curl -s ${b}/next\` and write your progress back to the items.`
  const ask = say(base)
  return {
    tone,
    line,
    lineBy: p.k === 'none' ? undefined : p.a.name,
    queue,
    later: live.filter((it) => it.when === 'later' && !closed(it.status)).length,
    ...sessionGroups(m),
    far: m.facts.remote && m.facts.remote !== base ? say(m.facts.remote) : '',
    ask,
    guide,
  }
}
