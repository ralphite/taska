// The helpers Home's stories share: how each draws its part.
import type { FindAnswer } from '../model/find'
import type { Need, ProjectRow } from '../model/types'
import { Frames } from './Frames'
import { T, item } from './fixtures'
import { useState } from 'react'
import { Home, type HomeEvents, type HomeFacts } from '../features/home/Home'
import { acts } from './acts'
import { homeRows } from '../features/home/homeRows'
import { withNewProject } from './newProjectFixtures'

export const on: HomeEvents = { ...acts('Home', ['search', 'restore', 'open'] as const, { search: 'Search on the desktop' }), query() {}, closeGone() {}, closeNone() {}, startNew() {} }
export const now = Date.parse(T)
export const PROJECTS: ProjectRow[] = [
  { name: 'taska', title: 'taska', open: 32, needs: 2, pos: 0, agents: [{ name: 'claude-code', t: now - 60_000, waiting: true }] },
  { name: 'home', title: 'Home', open: 13, needs: 11, pos: 1, agents: [{ name: 'codex', t: now - 3 * 3600_000, waiting: false }] },
  { name: 'notes', title: '\u8bfb\u4e66\u7b14\u8bb0', open: 2, needs: 0, pos: 2, agents: [{ name: 'claude-code', t: now - 26 * 3600_000, waiting: false }] },
  // a project no agent has called yet: its row says No agent
  { name: 'long', title: 'A project with a very long name that does not fit anywhere at all', open: 0, needs: 0, pos: 3 },
]
export const NEEDS: Need[] = [
  { project: 'taska', ptitle: 'taska', n: 581, code: 'F581', title: 'Rewrite Taska from scratch', kind: 'ask', pri: 'P1', t: '' },
  { project: 'home', ptitle: 'Home', n: 12, code: 'B012', title: 'The garden tap drips when it is turned off all the way', kind: 'review', pri: 'P2', t: '' },
]
export const rows = homeRows(PROJECTS, NEEDS, now)
export const facts: HomeFacts = { rows, needs: 13, away: false, gone: null, none: null, q: '', search: { phase: 'ready', answer: null } }
/** What the search (/api/find) found for "rewrite" in every project: an item, a done one, a won't do one, an archived
 * one, what you said. */
export const answer: FindAnswer = {
  q: 'rewrite',
  by: 'words',
  marks: ['rewrite'],
  titles: { taska: 'taska', home: 'Home' },
  found: [
    { project: 'taska', kind: 'items', key: 'i581', n: 581, item: item({ n: 581, code: 'F581', title: 'Rewrite Taska from scratch', status: 'doing' }) },
    { project: 'home', kind: 'items', key: 'i3', n: 3, item: item({ n: 3, code: 'B3', type: 'bug', title: 'Fix the rewrite of the shelf', status: 'done' }) },
    { project: 'home', kind: 'items', key: 'i9', n: 9, item: item({ n: 9, code: 'T9', type: 'task', title: 'Rewrite the shopping list', status: 'dropped' }) },
    { project: 'taska', kind: 'items', key: 'i40', n: 40, item: item({ n: 40, code: 'T40', type: 'task', title: 'Old rewrite notes', archived: true }) },
    { project: 'taska', kind: 'inputs', key: 'r315', n: null, code: '#315', title: 'the rewrite should keep every word the agents read', t: T, became: null },
  ],
}

/** The home page with what the page's HomeContainer holds: the phone's search typed, New project named and
 * cancelled, a deleted or missing project's note closed (T662). Searching every project, Create, Restore and opening a
 * project need Taska or the rest of the page: the Actions panel. */
function LiveHome({ f, desk, making: start }: { f: HomeFacts; desk: boolean; making?: { value?: string; error: string } }) {
  const [q, setQ] = useState(f.q)
  const [making, setMaking] = useState(start ?? null)
  const [gone, setGone] = useState(f.gone)
  const [none, setNone] = useState(f.none)
  const live: HomeEvents = { ...on, query: setQ, startNew: () => setMaking({ error: '' }), closeGone: () => setGone(null), closeNone: () => setNone(null) }
  const home = <Home facts={{ ...f, q, gone, none }} on={live} />
  // New project: a popover under its button on the desktop, a sheet on the phone (D115 #7)
  return making ? withNewProject(home, desk, { value: making.value, error: making.error, onDone: () => setMaking(null) }) : home
}

export const shown = (f: Partial<HomeFacts>, height = 620, making?: { value?: string; error: string }) => (
  <Frames phoneWidth={393} deskWidth={1100} height={height} page>
    {(layout) => <LiveHome f={{ ...facts, ...f }} desk={layout === 'desk'} making={making} />}
  </Frames>
)
