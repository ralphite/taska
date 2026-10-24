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

export type AgentTone = 'ready' | 'recent' | 'idle' | 'bad'

export interface AgentLine {
  tone: AgentTone
  label: string
  /** the tip: each agent's sessions, the latest first (not the line the pill shows already) */
  tip: string | undefined
}

/** [tone, the pill's words, a longer sentence] */
export function agentState(agents: readonly AgentSeen[] | undefined, work: boolean | undefined, now = Date.now()): ['ok' | 'bad' | 'idle', string, string] {
  const list = [...(agents || [])].sort((a, b) => b.t - a.t)
  const a = list.find((x) => x.waiting) || list[0]
  const name = a ? whoName(a.name) : ''
  if (a?.waiting) return ['ok', `${name} ready`, `${name} is connected and picks up new work right away.`]
  if (a && now - a.t < 10 * 60e3) return ['ok', `${name} · ${agoShort(a.t, now)}`, `${name} was here ${agoLong(a.t, now)}.`]
  const last = a ? `The last agent (${name}) was here ${agoLong(a.t, now)}.` : 'No agent connected yet.'
  return work
    ? ['bad', a ? `No agent · ${agoShort(a.t, now)}` : 'No agent', `Work is waiting. ${last}`]
    : ['idle', a ? `${name} · ${agoShort(a.t, now)}` : 'No agent', `Nothing is waiting for an agent. ${last}`]
}

export function agentLine(agents: readonly AgentSeen[] | undefined, work: boolean | undefined, now = Date.now()): AgentLine {
  const [tone, label] = agentState(agents, work, now)
  const ready = tone === 'ok' && (agents || []).some((a) => a.waiting)
  const lines = (agents || [])
    .flatMap((a) =>
      (a.sessions?.length ? a.sessions : [{ name: a.session || '', t: a.t }]).map((x, i) => ({
        t: x.t,
        text: [whoName(a.name), x.name, agoShort(x.t, now), a.waiting && i === 0 ? 'waiting for work' : ''].filter(Boolean).join(' · '),
      })),
    )
    .sort((x, y) => y.t - x.t)
  return {
    tone: tone === 'ok' ? (ready ? 'ready' : 'recent') : tone,
    label,
    tip: lines.map((l) => l.text).filter((l) => l !== label).join('\n') || undefined,
  }
}
