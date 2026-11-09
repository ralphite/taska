// T711 #10443: the pill says when an agent session waits on the user, before anything else it could say.
import { describe, expect, test } from 'vitest'
import { agentLine, agentState, lastAgent } from './agents'
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
  expect(line.tip).toContain('Claude Code · Fix export · 20m · blocked: approve Bash: npm test')
})

test('no session blocked: as before', () => {
  expect(agentLine([{ ...blocked[1], blocked: undefined }], false, now).label).toBe('Claude Code · 20m')
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
    expect(agentLine([{ ...at, waiting: false }], true, now).who).toEqual({ by: 'codex', session: 'Docs pass', state: '4m' })
    // drawn by its icon: the tip keeps the line, so hovering names the agent
    expect(agentLine([{ ...at, waiting: false }], true, now).tip).toBe('Codex · Docs pass · 4m')
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
