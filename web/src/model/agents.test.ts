// T711 #10443: the pill says when an agent session waits on the user, before anything else it could say.
import { describe, expect, test } from 'vitest'
import { agentLine, agentState, blockedAgent, lastAgent, sessionState } from './agents'
import type { AgentSeen } from './types'

const now = 1_800_000_000_000
const blocked: AgentSeen[] = [
  { name: 'codex', t: now - 30_000, waiting: true },
  { name: 'claude-code', t: now - 20 * 60_000, waiting: false, sessions: [{ name: 'Fix export', t: now - 20 * 60_000 }], blocked: [{ session: 'Fix export', waitingFor: 'approve Bash: npm test', since: now - 60_000 }] },
]

test('a blocked session: the pill says Claude Code · blocked, amber, even while another agent waits for work', () => {
  expect(agentState(blocked, true, now)).toEqual(['blocked', 'Claude Code · blocked', 'Claude Code is blocked, waiting on you.'])
  const line = agentLine(blocked, true, now)
  expect(line.tone).toBe('blocked')
  expect(line.label).toBe('Claude Code · blocked')
  expect(line.tip).toContain('Claude Code · Fix export · blocked: approve Bash: npm test')
})

test('no session blocked, and not heard of for 20 minutes: no agent, and no time after it (B784)', () => {
  expect(agentLine([{ ...blocked[1], blocked: undefined }], false, now).label).toBe('No agent')
  expect(agentLine([{ ...blocked[1], blocked: undefined }], true, now)).toMatchObject({ tone: 'bad', label: 'No agent' })
})

// B784 (Yadong): the pill said "No agent · 17m" while the Agents sheet said "Working · 21m" for the same busy session.
// One state per session (sessionState) for both; the app's own status wins over when Taska last heard of it.
describe('the pill and the Agents sheet say the same (B784)', () => {
  const busy: AgentSeen[] = [{ name: 'claude-code', t: now - 21 * 60_000, waiting: false, sessions: [{ name: 'Fix export', t: now - 21 * 60_000, status: 'busy', since: now - 21 * 60_000 }] }]
  test('a session its app says is busy is working on the pill too, however long since it called Taska', () => {
    expect(sessionState('claude-code', busy[0].sessions![0], false, now)).toBe('working')
    expect(agentLine(busy, true, now)).toMatchObject({ tone: 'ready', label: 'Claude Code · working', who: { by: 'claude-code', session: 'Fix export', state: 'working' } })
    expect(lastAgent(busy, now)).toMatchObject({ on: true, blocked: false })
  })
  test('idle in its app: idle; while work waits and it does not listen for work, the pill says so', () => {
    const idle: AgentSeen[] = [{ ...busy[0], sessions: [{ ...busy[0].sessions![0], status: 'idle' }] }]
    expect(agentLine(idle, false, now)).toMatchObject({ tone: 'recent', label: 'Claude Code · idle' })
    expect(agentLine(idle, true, now)).toMatchObject({ tone: 'bad', label: 'Claude Code · idle' })
    expect(agentLine([{ ...idle[0], waiting: true }], true, now)).toMatchObject({ tone: 'ready', label: 'Claude Code ready' })
  })
  test('exited: no agent', () => {
    const gone: AgentSeen[] = [{ ...busy[0], sessions: [{ ...busy[0].sessions![0], status: 'exited' }] }]
    expect(agentLine(gone, true, now)).toMatchObject({ tone: 'bad', label: 'No agent' })
    expect(agentLine(gone, true, now).who).toBeUndefined()
  })
})

// T711 (Yadong): the head's agent button names the agent by its icon, and its session; the tip names it in words.
describe('who the pill names: the agent, its session, what it does (T711)', () => {
  test('blocked: the session that waits on you', () => {
    const line = agentLine(blocked, true, now)
    expect(line.who).toEqual({ by: 'claude-code', session: 'Fix export', state: 'blocked' })
    expect(line.tip).toContain('Claude Code · Fix export')
  })
  test('ready, and here lately: the latest session', () => {
    const at = { name: 'codex', t: now - 4 * 60_000, session: 'Docs pass', sessions: [{ name: 'Docs pass', t: now - 4 * 60_000 }] }
    expect(agentLine([{ ...at, waiting: true }], true, now).who).toEqual({ by: 'codex', session: 'Docs pass', state: 'ready' })
    expect(agentLine([{ ...at, waiting: false }], true, now).who).toEqual({ by: 'codex', session: 'Docs pass', state: 'idle' })
    // drawn by its icon: the tip keeps the line, so hovering names the agent
    expect(agentLine([{ ...at, waiting: false }], true, now).tip).toBe('Codex · Docs pass · idle')
  })
  test('no session given: none; no agent around while work waits: no agent named', () => {
    expect(agentLine([{ name: 'codex', t: now - 60_000, waiting: true }], true, now).who).toEqual({ by: 'codex', session: '', state: 'ready' })
    expect(agentLine([{ name: 'codex', t: now - 3 * 3600e3, waiting: false }], true, now).who).toBeUndefined()
    expect(agentLine([], true, now).who).toBeUndefined()
  })
})

describe('presence, one rule for the pill and the home page (T728 #5)', () => {
  test('a blocked session shows on the home page as on the pill, even when another agent was here later', () => {
    const now = Date.parse('2026-11-08T10:00:00Z')
    const agents = [
      { name: 'codex', t: now - 60e3, waiting: false },
      { name: 'claude-code', t: now - 30 * 60e3, waiting: false, blocked: [{ session: 'Shop project work' }] },
    ] as never
    expect(agentState(agents, false, now)[0]).toBe('blocked')
    expect(lastAgent(agents, now)).toMatchObject({ blocked: true, on: true })
  })
})

// T711 (Yadong chose the floating orange bar): the page's blocked bar shows only while a session waits on the user.
test('the blocked bar: only while presence says blocked, gone as soon as it does not', () => {
  expect(blockedAgent(blocked, now)).toBe('claude-code')
  expect(blockedAgent([{ ...blocked[1], blocked: [] }], now)).toBeNull()
  expect(blockedAgent([{ name: 'codex', t: now - 30_000, waiting: true }], now)).toBeNull() // ready
  expect(blockedAgent([{ name: 'codex', t: now - 60_000, waiting: false }], now)).toBeNull() // at work
  expect(blockedAgent([{ name: 'codex', t: now - 3600_000, waiting: false }], now)).toBeNull() // away
  expect(blockedAgent([], now)).toBeNull()
  expect(blockedAgent(undefined, now)).toBeNull()
})
