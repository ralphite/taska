// T711 prototype (r1185): the agent sessions the stories show. Taska knows each session by its own id (its name, its
// state, what it waits on); these are what the directions draw from. Only for the stories.

import { T } from '../fixtures'

export type SessionState = 'blocked' | 'working' | 'idle'

export interface Session {
  /** the agent app, as Taska names it: "claude-code", "codex" */
  agent: string
  /** the session's title, as the app shows it */
  name: string
  state: SessionState
  /** what it waits on, while blocked */
  waitingFor?: string
  /** blocked or working since ("2m") */
  since?: string
  /** the item it works on */
  item?: { n: number; code: string; title: string }
  /** last active ("now", "14m") */
  last: string
  /** waits for new work from Taska (listening) */
  listening?: boolean
}

export const NOW = Date.parse(T)

export const F012 = { n: 12, code: 'F012', title: 'Export ignores the active filter' }
export const B031 = { n: 31, code: 'B031', title: 'Search misses Chinese words' }

const export_: Session = { agent: 'claude-code', name: 'Export keeps the filter', state: 'working', item: F012, last: 'now' }
const search: Session = { agent: 'claude-code', name: 'Fix phone search', state: 'working', item: B031, last: 'now' }
const rules: Session = { agent: 'codex', name: 'Rules versions', state: 'idle', last: '14m', listening: true }

/** The two states every place is drawn in: all at work (normal), and one blocked on Yadong. */
export const SESSIONS: Record<'normal' | 'blocked', Session[]> = {
  normal: [export_, search, rules],
  blocked: [{ ...export_, state: 'blocked', waitingFor: 'approve Bash: npm test', since: '2m', last: '2m' }, search, rules],
}

export type Case = keyof typeof SESSIONS

/** Blocked first, then working, then idle (what needs Yadong leads). */
export const ordered = (s: readonly Session[]) => {
  const rank = { blocked: 0, working: 1, idle: 2 } as const
  return [...s].sort((a, b) => rank[a.state] - rank[b.state])
}
