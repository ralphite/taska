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
  expect(f.lineBy).toBe('claude-code')
  expect(cc).toMatchObject({ who: 'Claude Code', when: 'Blocked', sessions: [{ name: 'Fix export', blocked: true, waitingFor: 'approve plan' }] })
  expect(codex).toMatchObject({ when: 'waiting for work', sessions: [] })
})

// T711: the sheet opened from the head says more: every session the agent was heard of in today, one blocked on you first,
// then the latest first, each with how long ago; a blocked one known only by its block among them.
test('each session of an agent, the blocked first, then the latest, with how long ago', () => {
  const t = 1_800_000_000_000
  const m = {
    ...modelOf([], [], {
      agents: [{ name: 'claude-code', t: t - 60_000, waiting: false, sessions: [{ name: 'Docs pass', t: t - 40 * 60_000 }, { name: 'Fix export', t: t - 60_000 }], blocked: [{ session: 'Review', waitingFor: '', since: t - 5 * 60_000 }] }],
    }),
    at: t,
  }
  expect(agentsFacts(m, null).seen[0].sessions.map((s) => [s.name, s.when, s.blocked])).toEqual([
    ['Review', '5m', true],
    ['Fix export', '1m', false],
    ['Docs pass', '40m', false],
  ])
})
