// How the page says whether an agent is around: the pill in the project's bar, and its tip.

import type { AgentSeen, AgentSession } from './types'
import { ago } from './time'
import { hasIcon, whoName } from './words'

export type AgentTone = 'ready' | 'recent' | 'idle' | 'bad' | 'blocked'

/** The agent a pill or a card names (T711): who (drawn by its app's icon where it has one), its session (the one
 * blocked on the user, else the latest heard of; '' when it gave none) and what follows them: "ready", "blocked",
 * or how long ago it was heard of ("5m"). */
export interface AgentWho {
  by: string
  session: string
  state: string
}

export interface AgentLine {
  tone: AgentTone
  /** the line in words alone, the agent by name */
  label: string
  /** the agent it names; none when it names none (No agent) */
  who?: AgentWho
  /** the tip: each agent's sessions, the latest first (where the pill says the agent's name, not the line it shows) */
  tip: string | undefined
}

/** An agent counts as around for this long after it was last heard of (T728 #5: one rule for the pill, the Agents
 * sheet and the home page; the server's is the same 600 s). */
export const AROUND_MS = 10 * 60e3

/** How one agent session is now (T784: the one state the pill, the Agents sheet and the home page all show). */
export type SessionState = 'working' | 'idle' | 'waiting' | 'gone'

/** How a session is now: as its app says (Claude Code, Codex), else by when it was last heard of and whether it is on
 * a task (Antigravity: seen lately, its waker waiting, or gone). A Codex thread is idle once its turn ends, also
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
export function sessionsOf(a: AgentSeen): AgentSession[] {
  const all: AgentSession[] = (a.sessions || []).filter((x) => x.name)
  for (const b of a.blocked || []) if (!all.some((x) => x.name === b.session)) all.push({ name: b.session, t: b.since || a.t, status: 'waiting', waitingFor: b.waitingFor, since: b.since })
  return all.length ? all : [{ name: '', t: a.t, waiting: a.waiting }]
}

/** Where a project's agents are (T728 #5, T784), worked out once from each session's own state: a session waiting
 * on the user comes first, then one working, then one idle and listening for work (ready), then one idle; else the
 * latest is gone (away), or there never was one (none). */
export type Presence = { k: 'blocked' | 'working' | 'ready' | 'idle' | 'away'; a: AgentSeen; s: AgentSession } | { k: 'none' }
const RANK = { blocked: 0, working: 1, ready: 2, idle: 3, away: 4 } as const
export function presenceOf(agents: readonly AgentSeen[] | undefined, now: number): Presence {
  let best: Presence = { k: 'none' }
  for (const a of agents || [])
    for (const s of sessionsOf(a)) {
      const st = sessionState(a.name, s, !!a.blocked?.some((b) => b.session === s.name), now)
      const k = st === 'waiting' ? 'blocked' : st === 'working' ? 'working' : st === 'gone' ? 'away' : s.waiting || a.waiting ? 'ready' : 'idle'
      if (best.k === 'none' || RANK[k] < RANK[best.k] || (RANK[k] === RANK[best.k] && s.t > best.s.t)) best = { k, a, s }
    }
  return best
}

/** The agent whose session waits on the user, by presenceOf's rule; null while none does. The page's blocked bar
 * shows while there is one and goes as soon as there is none (T711). */
export function blockedAgent(agents: readonly AgentSeen[] | undefined, now: number): string | null {
  const p = presenceOf(agents, now)
  return p.k === 'blocked' ? p.a.name : null
}

/** [tone, the pill's words, a longer sentence], by presenceOf (T784: the pill never says one thing while the Agents
 * sheet says another, and a time never follows "No agent"). `queued`: tasks in the queue now. */
export function agentState(agents: readonly AgentSeen[] | undefined, work: boolean | undefined, now: number, queued = 0): ['ok' | 'bad' | 'idle' | 'blocked', string, string] {
  const p = presenceOf(agents, now)
  if (p.k === 'none') return [work ? 'bad' : 'idle', 'No agent', work ? 'Work is waiting. No agent yet.' : 'No agent yet.']
  const name = whoName(p.a.name)
  if (p.k === 'blocked') return ['blocked', `${name} · blocked`, `${name} is blocked, waiting on you.`]
  if (p.k === 'working') return ['ok', `${name} · working`, `${name} is working.`]
  if (p.k === 'ready') return ['ok', `${name} ready`, `${name} is ready for work.`]
  const waits = queued ? `${queued} ${queued === 1 ? 'task waits' : 'tasks wait'}.` : 'Nothing is waiting for an agent.'
  if (p.k === 'idle')
    // T811 r1362: red is not an error: work waits and this session does not take it; it says so, not "idle"
    return work ? ['bad', `${name} · not taking work`, `${queued ? waits : 'Work is waiting.'} ${name} is not taking work.`] : ['idle', `${name} · idle`, `${waits} ${name} is idle.`]
  const last = `The last agent (${name}) was here ${ago(p.s.t, now, 'long')}.`
  return work ? ['bad', 'No agent', `Work is waiting. ${last}`] : ['idle', 'No agent', `${waits} ${last}`]
}

export function agentLine(agents: readonly AgentSeen[] | undefined, work: boolean | undefined, now: number): AgentLine {
  const [tone, label] = agentState(agents, work, now)
  const p = presenceOf(agents, now)
  const who: AgentWho | undefined =
    p.k === 'none' || p.k === 'away'
      ? undefined
      : {
          by: p.a.name,
          session: (p.k === 'blocked' ? p.a.blocked?.find((b) => b.session === p.s.name)?.session : undefined) || p.s.name || p.a.session || '',
          state: p.k,
        }
  const lines = (agents || [])
    .flatMap((a) =>
      sessionsOf(a).map((x) => ({
        t: x.t,
        text: [whoName(a.name), x.name, sessionWord(a, x, now), blockedOn(a, x.name) ?? ''].filter(Boolean).join(' · '),
      })),
    )
    .sort((x, y) => y.t - x.t)
  return {
    // working or ready: green; idle in its app: grey with a green dot; gone or none: idle (or bad while work waits)
    tone: tone === 'ok' ? 'ready' : tone === 'idle' && p.k === 'idle' ? 'recent' : tone,
    label,
    who,
    // an icon in the agent's name's place: the tip names it, so it keeps every line
    tip: lines.map((l) => l.text).filter((l) => hasIcon(who?.by) || l !== label).join('\n') || undefined,
  }
}

/** A session's state in the pill's tip, in the sheet's words (T784): working, idle, ready (listening for work), gone. */
function sessionWord(a: AgentSeen, s: AgentSession, now: number): string {
  const st = sessionState(a.name, s, !!a.blocked?.some((b) => b.session === s.name), now)
  if (st === 'waiting') return ''
  if (st === 'idle' && (s.waiting || a.waiting)) return 'ready'
  return st === 'gone' ? `gone · ${ago(s.t, now, 'short')}` : st
}

/** What a session of this agent waits on, when it waits on the user ("blocked: approve plan"); undefined when not. */
export function blockedOn(a: AgentSeen, session: string): string | undefined {
  const b = a.blocked?.find((x) => x.session === session)
  return b ? (b.waitingFor ? `blocked: ${b.waitingFor}` : 'blocked') : undefined
}

/** The home page's agent cell, by the pill's own rule (presenceOf, T784): who and what it does, in the pill's words;
 * null when no agent is around (the pill says No agent then too). */
export function lastAgent(agents: readonly AgentSeen[] | undefined, now: number): { by: string; state: 'blocked' | 'working' | 'ready' | 'idle' } | null {
  const p = presenceOf(agents, now)
  return p.k === 'none' || p.k === 'away' ? null : { by: p.a.name, state: p.k }
}

/** The sessions working on task `n` now (T810: a manager's worker, found by its title, among them), each with how it
 * is: what the task's page shows of who works on it. Gone ones are left out. */
export function sessionsOn(agents: readonly AgentSeen[] | undefined, n: number, at: number): { by: string; name: string; state: Exclude<SessionState, 'gone'> }[] {
  const out: { by: string; name: string; state: Exclude<SessionState, 'gone'> }[] = []
  for (const a of agents || [])
    for (const s of a.sessions || []) {
      if (s.on?.n !== n) continue
      const st = sessionState(a.name, s, !!a.blocked?.some((b) => b.session === s.name), at)
      if (st !== 'gone') out.push({ by: a.name, name: s.name, state: st })
    }
  return out
}
