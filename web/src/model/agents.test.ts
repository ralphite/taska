// T711 #10443: the pill says when an agent session waits on the user, before anything else it could say.
import { expect, test } from 'vitest'
import { agentLine, agentState } from './agents'
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
