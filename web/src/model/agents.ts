// How the page says whether an agent is around: the pill in the project's bar, and its tip.

import type { AgentSeen } from './types'
import { whoName } from './words'

export const agoShort = (t: number, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - t) / 60000))
  return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'
}

export const agoLong = (t: number, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - t) / 60000))
  const days = Math.round(m / 1440)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${days} day${days === 1 ? '' : 's'} ago`
}

export type AgentTone = 'ready' | 'recent' | 'idle' | 'bad' | 'blocked'

export interface AgentLine {
  tone: AgentTone
  label: string
  /** the tip: each agent's sessions, the latest first (not the line the pill shows already) */
  tip: string | undefined
}

/** An agent counts as around for this long after it was last heard of (T728 #5: one rule for the pill, the Agents
 * sheet and the home page; the server's is the same 600 s). */
export const AROUND_MS = 10 * 60e3
/** A session shows on a row's agent mark while it was heard of within this. */
export const SESSION_MS = 3600e3

/** Where a project's agents are (T728 #5), worked out once: a session blocked on the user comes first, then one
 * waiting for work, then the latest heard of within AROUND_MS; else away (or none ever). */
export type Presence = { k: 'blocked' | 'ready' | 'recent' | 'away'; a: AgentSeen } | { k: 'none' }
export function presenceOf(agents: readonly AgentSeen[] | undefined, now: number): Presence {
  const list = [...(agents || [])].sort((a, b) => b.t - a.t)
  const stuck = list.find((x) => x.blocked?.length)
  if (stuck) return { k: 'blocked', a: stuck }
  const a = list.find((x) => x.waiting) || list[0]
  if (!a) return { k: 'none' }
  return { k: a.waiting ? 'ready' : now - a.t < AROUND_MS ? 'recent' : 'away', a }
}

/** [tone, the pill's words, a longer sentence] */
/** `queued`: items in the queue now (the sentence never says nothing waits while some do). */
/** A session waiting on the user comes first (T711 #10443): `Claude Code · blocked`. */
export function agentState(agents: readonly AgentSeen[] | undefined, work: boolean | undefined, now = Date.now(), queued = 0): ['ok' | 'bad' | 'idle' | 'blocked', string, string] {
  const p = presenceOf(agents, now)
  const a = p.k === 'none' ? undefined : p.a
  const name = a ? whoName(a.name) : ''
  if (p.k === 'blocked') return ['blocked', `${name} · blocked`, `${name} is blocked, waiting on you.`]
  if (p.k === 'ready') return ['ok', `${name} ready`, `${name} is ready for work.`]
  if (p.k === 'recent' && a) return ['ok', `${name} · ${agoShort(a.t, now)}`, `${name} was here ${agoLong(a.t, now)}.`]
  const last = a ? `The last agent (${name}) was here ${agoLong(a.t, now)}.` : 'No agent yet.'
  return work
    ? ['bad', a ? `No agent · ${agoShort(a.t, now)}` : 'No agent', `Work is waiting. ${last}`]
    : ['idle', a ? `${name} · ${agoShort(a.t, now)}` : 'No agent', `${queued ? `${queued} ${queued === 1 ? 'item waits' : 'items wait'}.` : 'Nothing is waiting for an agent.'} ${last}`]
}

export function agentLine(agents: readonly AgentSeen[] | undefined, work: boolean | undefined, now = Date.now()): AgentLine {
  const [tone, label] = agentState(agents, work, now)
  const ready = tone === 'ok' && (agents || []).some((a) => a.waiting)
  const lines = (agents || [])
    .flatMap((a) =>
      (a.sessions?.length ? a.sessions : [{ name: a.session || '', t: a.t }]).map((x, i) => ({
        t: x.t,
        text: [whoName(a.name), x.name, agoShort(x.t, now), blockedOn(a, x.name) ?? (a.waiting && i === 0 ? 'waiting for work' : '')].filter(Boolean).join(' · '),
      })),
    )
    .sort((x, y) => y.t - x.t)
  return {
    tone: tone === 'ok' ? (ready ? 'ready' : 'recent') : tone,
    label,
    tip: lines.map((l) => l.text).filter((l) => l !== label).join('\n') || undefined,
  }
}

/** What a session of this agent waits on, when it waits on the user ("blocked: approve plan"); undefined when not. */
export function blockedOn(a: AgentSeen, session: string): string | undefined {
  const b = a.blocked?.find((x) => x.session === session)
  return b ? (b.waitingFor ? `blocked: ${b.waitingFor}` : 'blocked') : undefined
}

/** The home page's agent cell, by the pill's own rule (presenceOf): who, and whether it is around or blocked. */
export function lastAgent(agents: readonly AgentSeen[] | undefined, now: number): { name: string; on: boolean; blocked: boolean } | null {
  const p = presenceOf(agents, now)
  return p.k === 'none' ? null : { name: whoName(p.a.name), on: p.k !== 'away', blocked: p.k === 'blocked' }
}
