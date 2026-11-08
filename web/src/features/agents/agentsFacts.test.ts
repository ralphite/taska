// T711 #10443: in Who works here, the agent's line says Blocked, and under it each blocked session and what it waits on.
import { expect, test } from 'vitest'
import { modelOf } from '../../stories/fixtures'
import { agentsFacts } from './agentsFacts'

test('the blocked agent says Blocked; its session line says what it waits on', () => {
  const t = 1_800_000_000_000
  const m = modelOf([], [], {
    agents: [
      { name: 'claude-code', t: t - 60_000, waiting: false, blocked: [{ session: 'Fix export', waitingFor: 'approve plan', since: t }] },
      { name: 'codex', t: t - 120_000, waiting: true },
    ],
  })
  const f = agentsFacts(m, null)
  expect(f.tone).toBe('blocked')
  expect(f.line).toBe('Claude Code is blocked, waiting on you.')
  const [cc, codex] = f.seen
  expect(cc).toMatchObject({ who: 'Claude Code', when: 'Blocked', blocked: [{ session: 'Fix export', waitingFor: 'approve plan' }] })
  expect(codex).toMatchObject({ when: 'waiting for work', blocked: [] })
})
