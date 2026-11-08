// T711 prototype (r1186): the sessions the stories show. A project has one active session; the others are old. Only
// for the stories.

import { T } from '../fixtures'

export interface Session {
  /** the agent app, as Taska names it: "claude-code", "codex" */
  agent: string
  /** the session's title, as the app shows it */
  name: string
  /** what it waits on, while it waits on Yadong */
  waitingFor?: string
  /** waiting since, or last seen ("2m", "3h", "1d") */
  when: string
}

export const NOW = Date.parse(T)

export const F012 = { n: 12, code: 'F012', title: 'Export ignores the active filter' }

const active: Session = { agent: 'claude-code', name: 'Export keeps the filter', when: 'now' }

/** The two states every place is drawn in: the active session at work, and waiting on Yadong. */
export const ACTIVE = {
  working: active,
  waiting: { ...active, waitingFor: 'approve Bash: npm test', when: '2m' },
} satisfies Record<string, Session>

export type Case = keyof typeof ACTIVE

/** The project's old sessions, the latest first. */
export const OLD: Session[] = [
  { agent: 'claude-code', name: 'Fix phone search', when: '3h' },
  { agent: 'codex', name: 'Rules versions', when: '1d' },
]
