// The helpers Home's stories share: how each draws its part.
import type { Need, ProjectRow, SearchHit } from '../model/types'
import { Frames } from './Frames'
import { T } from './fixtures'
import { Home, type HomeEvents, type HomeFacts } from '../features/home/Home'
import { homeRows } from '../features/home/homeRows'

export const on: HomeEvents = { query() {}, restore() {}, closeGone() {}, closeNone() {}, startNew() {}, cancelNew() {}, create() {}, open() {} }
export const now = Date.parse(T)
export const PROJECTS: ProjectRow[] = [
  { name: 'taska', title: 'taska', open: 32, needs: 2, pos: 0, agents: [{ name: 'claude-code', t: now - 60_000, waiting: true }] },
  { name: 'home', title: 'Home', open: 13, needs: 11, pos: 1, agents: [{ name: 'codex', t: now - 3 * 3600_000, waiting: false }] },
  { name: 'notes', title: '\u8bfb\u4e66\u7b14\u8bb0', open: 2, needs: 0, pos: 2 },
  { name: 'long', title: 'A project with a very long name that does not fit anywhere at all', open: 0, needs: 0, pos: 3 },
]
export const NEEDS: Need[] = [
  { project: 'taska', ptitle: 'taska', n: 581, code: 'F581', title: 'Rewrite Taska from scratch', kind: 'ask', pri: 'P1', t: '' },
  { project: 'home', ptitle: 'Home', n: 12, code: 'B012', title: 'The garden tap drips when it is turned off all the way', kind: 'review', pri: 'P2', t: '' },
]
export const rows = homeRows(PROJECTS, NEEDS, now)
export const facts: HomeFacts = { rows, needs: 13, away: false, gone: null, none: null, q: '', hits: null, making: null }
export const hits: SearchHit[] = [
  { project: 'taska', ptitle: 'taska', kind: 'item', code: 'F581', title: 'Rewrite Taska from scratch', status: 'doing', t: '' },
  { project: 'home', ptitle: 'Home', kind: 'item', code: 'B3', title: 'Fix the rewrite of the shelf', status: 'done', t: '' },
  { project: 'home', ptitle: 'Home', kind: 'item', code: 'T9', title: 'Rewrite the shopping list', status: 'dropped', t: '' },
  { project: 'taska', ptitle: 'taska', kind: 'item', code: 'T40', title: 'Old rewrite notes', archived: true, t: '' },
  { project: 'taska', ptitle: 'taska', kind: 'input', code: 'r315', title: 'the rewrite should keep every word the agents read', t: '' },
]

export const shown = (f: Partial<HomeFacts>, height = 620) => (
  <Frames phoneWidth={393} deskWidth={1100} height={height} page>
    {() => <Home facts={{ ...facts, ...f }} on={on} />}
  </Frames>
)
