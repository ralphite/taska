// T711 prototype (r1186): the sessions the stories show. A project has one active session; the others are old. A
// session works on many items, so its name is never an item's (r1198). Only for the stories.

import { T } from '../fixtures'

export interface Session {
  /** the agent app, as Taska names it: "claude-code", "codex" */
  agent: string
  /** the session's title, as the app shows it */
  name: string
  /** blocked on Yadong (what it is blocked on never shows, r1187) */
  blocked?: boolean
  /** last seen ("3h", "1d"), for the old sessions */
  when: string
}

export const NOW = Date.parse(T)

export const F012 = { n: 12, code: 'F012', title: 'Export ignores the active filter' }

const active: Session = { agent: 'claude-code', name: 'Shop project work', when: 'now' }

/** The two states every place is drawn in: the active session at work, and blocked on Yadong. */
export const ACTIVE = {
  working: active,
  waiting: { ...active, blocked: true },
} satisfies Record<string, Session>

export type Case = keyof typeof ACTIVE

/** The project's old sessions, the latest first. */
export const OLD: Session[] = [
  { agent: 'claude-code', name: 'Shop manager', when: '3h' },
  { agent: 'codex', name: 'Shop nightly checks', when: '1d' },
]
