// The Agents sheet's demo sessions (F768): the demo project Shop with the sessions an agent app would report, as the
// server sends them (each session's app id, what its app says of it, the item it is on, who started it), and what
// each session wrote on the items. Used by the Agents sheet's stories.

import type { AgentSeen, Item, Message } from '../model/types'
import { T, message } from './fixtures'
import { PROJECT } from './listFixtures'

const now = Date.parse(T)
const min = (m: number) => now - m * 60_000
const iso = (m: number) => new Date(min(m)).toISOString()

export const SID = {
  export: '3f6c1d2e-8a4b-4c1e-9d2f-6b7a8c9d0e1f',
  manager: '7b1e2c3d-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
  worker1: 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d',
  worker2: 'b3c4d5e6-f7a8-4b9c-8d1e-2f3a4b5c6d7e',
  docs: '019a4f2c-5c55-75d3-ade5-bc4c0361163a',
  lead: 'c4d5e6f7-a8b9-4c0d-9e1f-3a4b5c6d7e8f',
} as const

const said = (id: number, m: number, ses: string, text: string, by = 'claude-code', kind: Message['kind'] = 'progress'): Message => message({ id, by, ses, kind, text, t: iso(m) })

/** What the sessions wrote on Shop's items, beside what the items already have. */
const THREADS: Record<number, Message[]> = {
  1: [
    said(901, 34, 'Export keeps the filter', 'Reproduced it: the export reads the list before the filter.'),
    said(902, 18, 'Export keeps the filter', 'The export now takes the rows the list shows, filter and sort included.'),
    said(903, 3, 'Export keeps the filter', 'Running the checks before I hand it back.'),
  ],
  5: [
    said(911, 25, 'Manager', '@worker-1 Search finds words in the talk: yours, in its own working copy.'),
    said(912, 20, 'worker-1', 'Started: the search reads the talk as well as the titles.'),
    said(913, 6, 'worker-1', 'Found words in the talk now show under the item, marked.'),
  ],
  6: [
    said(921, 40, 'Manager', '@worker-2 Excel export as well: wait until the filter fix is in.'),
    said(922, 12, 'main', 'Wrote the export notes in the docs folder.', 'codex', 'say'),
  ],
  4: [said(931, 70, 'Manager', 'Merged and shipped: the list sorts by priority, then by number.', 'claude-code', 'say')],
}

/** Shop, with what its sessions wrote on its items. */
export const ITEMS: Item[] = PROJECT.map((it) => (THREADS[it.n] ? { ...it, thread: [...it.thread, ...THREADS[it.n]] } : it))

/** One session works now (on F001) and a Codex session was here hours ago. */
export const WORKING: AgentSeen[] = [
  {
    name: 'claude-code',
    t: min(1),
    waiting: false,
    session: 'Export keeps the filter',
    sessions: [{ name: 'Export keeps the filter', t: min(1), sid: SID.export, status: 'busy', since: min(20), cwd: '/Users/you/dev/shop', on: { n: 1, since: min(34) } }],
  },
  { name: 'codex', t: min(3 * 60), waiting: false, session: 'main', sessions: [{ name: 'main', t: min(3 * 60), sid: SID.docs, status: 'idle', since: min(3 * 60), cwd: '/Users/you/dev/shop' }] },
]

/** A Claude Code session asks to run a command: it waits for you. */
export const WAITING: AgentSeen[] = [
  {
    name: 'claude-code',
    t: min(6),
    waiting: false,
    session: 'Export keeps the filter',
    sessions: [
      { name: 'Export keeps the filter', t: min(6), sid: SID.export, status: 'waiting', since: min(4), cwd: '/Users/you/dev/shop', waitingFor: 'approve Bash: npm --prefix web run check', on: { n: 1, since: min(34) } },
    ],
    blocked: [{ session: 'Export keeps the filter', waitingFor: 'approve Bash: npm --prefix web run check', since: min(4) }],
  },
  WORKING[1],
]

/** A manager with two workers (one on F005, one idle), a Codex session and an Antigravity session gone a while. */
export const MANAGER: AgentSeen[] = [
  {
    name: 'claude-code',
    t: min(0),
    waiting: false,
    session: 'Manager',
    sessions: [
      { name: 'Manager', t: min(0), sid: SID.manager, status: 'busy', since: min(20), cwd: '/Users/you/dev/shop' },
      { name: 'worker-1', t: min(0), sid: SID.worker1, status: 'busy', since: min(20), cwd: '/Users/you/dev/shop-w1', on: { n: 5, since: min(20) }, parent: 'Manager' },
      { name: 'worker-2', t: min(1), sid: SID.worker2, status: 'idle', since: min(1), cwd: '/Users/you/dev/shop-w2', parent: 'Manager' },
      { name: 'Export keeps the filter', t: min(6), sid: SID.export, status: 'waiting', since: min(4), cwd: '/Users/you/dev/shop', waitingFor: 'approve plan', on: { n: 1, since: min(34) } },
    ],
    blocked: [{ session: 'Export keeps the filter', waitingFor: 'approve plan', since: min(4) }],
  },
  { name: 'codex', t: min(12), waiting: false, session: 'main', sessions: [{ name: 'main', t: min(12), sid: SID.docs, status: 'idle', since: min(12), cwd: '/Users/you/dev/shop' }] },
  { name: 'antigravity', t: min(2 * 60), waiting: false, session: 'Shop lead', sessions: [{ name: 'Shop lead', t: min(2 * 60), sid: SID.lead }] },
]

/** Every session left: one exited two hours ago, one not heard of since yesterday. */
export const ALL_GONE: AgentSeen[] = [
  { name: 'claude-code', t: min(2 * 60), waiting: false, session: 'Export keeps the filter', sessions: [{ name: 'Export keeps the filter', t: min(2 * 60), sid: SID.export, status: 'exited', cwd: '/Users/you/dev/shop', since: min(2 * 60) }] },
  { name: 'codex', t: min(20 * 60), waiting: false, session: 'main', sessions: [{ name: 'main', t: min(20 * 60), sid: SID.docs }] },
]

/** The key the sheet knows a session by (agentsFacts). */
export const sessionKey = (app: string, name: string) => `${app}\u0000${name}`
