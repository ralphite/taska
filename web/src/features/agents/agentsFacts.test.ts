// F768 (Yadong r1290, r1296): the Agents sheet lists every session by its app, a manager's workers under it, each as it
// is now; the one working or waiting for you is picked as it opens; each app's way back to its session.
import { expect, test } from 'vitest'
import { ITEMS, MANAGER, SID, WAITING, WORKING, sessionKey } from '../../stories/agentsFixtures'
import { modelOf } from '../../stories/fixtures'
import type { AgentSeen } from '../../model/types'
import { agentsFacts, sessionState } from './agentsFacts'

const at = (agents: AgentSeen[]) => modelOf(ITEMS, [], { agents })
const rows = (agents: AgentSeen[]) => agentsFacts(at(agents), null).groups.map((g) => [g.name, g.sessions.map((s) => [s.name, s.state, s.worker])])

test('grouped by app in a fixed order; workers right under their manager; waiting first, then the latest', () => {
  expect(rows(MANAGER)).toEqual([
    ['Claude Code', [['Export keeps the filter', 'waiting', false], ['Manager', 'working', false], ['worker-1', 'working', true], ['worker-2', 'idle', true]]],
    ['Codex', [['main', 'gone', false]]],
    ['Antigravity', [['Shop lead', 'gone', false]]],
  ])
  const manager = agentsFacts(at(MANAGER), null).groups[0].sessions[1]
  expect(manager.workers.map((w) => [w.name, w.state, w.on?.code ?? null])).toEqual([
    ['worker-1', 'working', 'F005'],
    ['worker-2', 'idle', null],
  ])
})

test('the session waiting for you is picked as the sheet opens, else the one working, else the latest; none: none', () => {
  expect(agentsFacts(at(MANAGER), null).start).toBe(sessionKey('claude-code', 'Export keeps the filter'))
  expect(agentsFacts(at(WORKING), null).start).toBe(sessionKey('claude-code', 'Export keeps the filter'))
  const gone: AgentSeen[] = [{ name: 'codex', t: Date.parse('2026-10-23T10:00:00-07:00'), waiting: false, sessions: [{ name: 'main', t: Date.parse('2026-10-23T10:00:00-07:00') }] }]
  expect(agentsFacts(at(gone), null).start).toBe(sessionKey('codex', 'main'))
  expect(agentsFacts(at([]), null)).toMatchObject({ groups: [], start: null })
})

test('states: as the app says; else by when last heard of and whether on an item; Codex idle and quiet is gone', () => {
  const t = 1_800_000_000_000
  const s = (o: object) => ({ name: 'x', t: t - 60_000, ...o })
  expect(sessionState('claude-code', s({ status: 'busy' }), false, t)).toBe('working')
  expect(sessionState('claude-code', s({ status: 'idle', t: t - 5 * 3600_000 }), false, t)).toBe('idle')
  expect(sessionState('codex', s({ status: 'idle', t: t - 5 * 3600_000 }), false, t)).toBe('gone')
  expect(sessionState('claude-code', s({ status: 'exited' }), false, t)).toBe('gone')
  expect(sessionState('claude-code', s({}), true, t)).toBe('waiting')
  expect(sessionState('antigravity', s({}), false, t)).toBe('idle')
  expect(sessionState('antigravity', s({ on: { n: 1, since: t } }), false, t)).toBe('working')
  expect(sessionState('antigravity', s({ t: t - 3600_000 }), false, t)).toBe('gone')
  expect(sessionState('antigravity', s({ t: t - 3600_000, waiting: true }), false, t)).toBe('idle') // its waker waits
})

test('a session waiting for you says on what and how long; its pill how long it has been as it is', () => {
  const [s] = agentsFacts(at(WAITING), null).groups[0].sessions
  expect(s.waits).toEqual({ what: 'approve Bash: npm --prefix web run check', for: '4m' })
  expect(s.on).toEqual({ n: 1, code: 'F001', title: 'Export keeps the filter you set' })
  expect(s.folder).toBe('~/dev/shop')
  expect(agentsFacts(at(WORKING), null).groups[0].sessions[0].pill).toBe('Working · 20m')
})

test("each app's way back: Claude Code's link by the session's id, Codex's resume command, none for Antigravity", () => {
  const all = agentsFacts(at(MANAGER), null).groups.flatMap((g) => g.sessions)
  expect(all.find((s) => s.name === 'Manager')?.link).toEqual({ kind: 'open', href: `claude://code/continue?session=${SID.manager}` })
  expect(all.find((s) => s.name === 'main')?.link).toEqual({ kind: 'resume', cmd: `codex resume ${SID.docs}` })
  expect(all.find((s) => s.name === 'Shop lead')?.link).toBeNull()
})

test("recent activity: the session's own last messages, the latest first, each with its item", () => {
  const w1 = agentsFacts(at(MANAGER), null).groups[0].sessions.find((s) => s.name === 'worker-1')
  expect(w1?.activity.map((a) => [a.when, a.item.code, a.text])).toEqual([
    ['6m', 'F005', 'Found words in the talk now show under the item, marked.'],
    ['20m', 'F005', 'Started: the search reads the talk as well as the titles.'],
  ])
})

test('an agent that named no session is one row, by its app; a blocked session it names only by its block is listed', () => {
  const t = Date.parse('2026-10-23T14:29:00-07:00')
  const g = agentsFacts(at([{ name: 'codex', t, waiting: true }, { name: 'claude-code', t, waiting: false, blocked: [{ session: 'Review', waitingFor: '', since: t }] }]), null).groups
  expect(g.map((x) => [x.name, x.sessions.map((s) => [s.name, s.state])])).toEqual([
    ['Claude Code', [['Review', 'waiting']]],
    ['Codex', [['Codex', 'idle']]],
  ])
})

test('agents Taska has no app for are one group, Others, after the known apps (not a group each)', () => {
  const t = Date.parse('2026-11-13T10:00:00-08:00')
  const seen: AgentSeen[] = [
    { name: 'claude-main', t, waiting: false },
    { name: 'nightly', t, waiting: false },
    { name: 'codex', t, waiting: false },
  ]
  expect(rows(seen).map(([g]) => g)).toEqual(['Codex', 'Others'])
  expect(rows(seen)[1][1].length).toBe(2)
})

test('F768 r1305: one text to paste connects the agent: its folder once, then the work; no command apart', () => {
  const f = agentsFacts(at([]), null)
  expect(f.ask).toMatch(/connect \| sh`.*\/agent`.*\/next`/)
  expect(f).not.toHaveProperty('cmd')
})
