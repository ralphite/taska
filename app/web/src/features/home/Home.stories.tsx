import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Need, ProjectRow, SearchHit } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T } from '../../stories/fixtures'
import { Home, type HomeEvents, type HomeFacts } from './Home'
import { homeRows } from './homeRows'

const meta: Meta = { title: 'Components/Home page' }
export default meta
type Story = StoryObj

const on: HomeEvents = { query() {}, restore() {}, closeGone() {}, closeNone() {}, startNew() {}, cancelNew() {}, create() {}, open() {} }
const now = Date.parse(T)
const PROJECTS: ProjectRow[] = [
  { name: 'taska', title: 'taska', open: 32, needs: 2, pos: 0, agents: [{ name: 'claude-code', t: now - 60_000, waiting: true }] },
  { name: 'home', title: 'Home', open: 13, needs: 11, pos: 1, agents: [{ name: 'codex', t: now - 3 * 3600_000, waiting: false }] },
  { name: 'notes', title: '读书笔记', open: 2, needs: 0, pos: 2 },
  { name: 'long', title: 'A project with a very long name that does not fit anywhere at all', open: 0, needs: 0, pos: 3 },
]
const NEEDS: Need[] = [
  { project: 'taska', ptitle: 'taska', n: 581, code: 'F581', title: 'Rewrite Taska from scratch', kind: 'ask', pri: 'P1', t: '' },
  { project: 'home', ptitle: 'Home', n: 12, code: 'B012', title: 'The garden tap drips when it is turned off all the way', kind: 'review', pri: 'P2', t: '' },
]
const rows = homeRows(PROJECTS, NEEDS, now)
const facts: HomeFacts = { rows, needs: 13, away: false, gone: null, none: null, q: '', hits: null, making: null }
const hits: SearchHit[] = [
  { project: 'taska', ptitle: 'taska', kind: 'item', code: 'F581', title: 'Rewrite Taska from scratch', status: 'doing', t: '' },
  { project: 'home', ptitle: 'Home', kind: 'item', code: 'B3', title: 'Fix the rewrite of the shelf', status: 'done', t: '' },
  { project: 'home', ptitle: 'Home', kind: 'item', code: 'T9', title: 'Rewrite the shopping list', status: 'dropped', t: '' },
  { project: 'taska', ptitle: 'taska', kind: 'item', code: 'T40', title: 'Old rewrite notes', archived: true, t: '' },
  { project: 'taska', ptitle: 'taska', kind: 'input', code: 'r315', title: 'the rewrite should keep every word the agents read', t: '' },
]

const shown = (f: Partial<HomeFacts>, height = 620) => (
  <Frames phoneWidth={393} deskWidth={1100} height={height} page>
    {() => <Home facts={{ ...facts, ...f }} on={on} />}
  </Frames>
)

/** Every project with its agent, open count, what needs you and the first of it. */
export const Projects: Story = { name: 'Every project', render: () => shown({}) }

/** A project under the pointer, pressed, from the keys, side by side. */
export const HomeLooks: Story = {
  name: 'Pointer, pressed, keys: all side by side',
  parameters: { pseudo: { hover: ['[data-look="pointer"] a[href="/p/home/"]'], active: ['[data-look="pressed"] a[href="/p/home/"]'], focusVisible: ['[data-look="keys"] a[href="/p/home/"]'] } },
  render: () => (
    <div className="flex flex-col gap-6">
      {(['pointer', 'pressed', 'keys'] as const).map((look) => (
        <div key={look} data-look={look}>
          <p className="px-6 pt-2 font-mono text-[10px] text-zinc-400">{look === 'keys' ? 'keys (the browser draws the ring itself)' : look}</p>
          {shown({}, 420)}
        </div>
      ))}
    </div>
  ),
}

/** Words typed in the search: what was found in every project (an item, a done one, an input). */
export const Searching: Story = { render: () => shown({ q: 'rewrite', hits }) }

/** The search found nothing. */
export const NothingFound: Story = { render: () => shown({ q: 'zebra', hits: [] }, 420) }

/** A deleted project's old link: it says so, with Restore. */
export const DeletedProject: Story = { render: () => shown({ gone: { name: 'shop', said: '' } }, 420) }

/** Restore did not work: why. */
export const NotRestored: Story = { render: () => shown({ gone: { name: 'shop', said: 'Connection lost; try again' } }, 420) }

/** A link to a project that never was. */
export const NoSuchProject: Story = { render: () => shown({ none: 'shpo' }, 420) }

/** Taska does not answer: the projects kept from before, and a note. */
export const OutOfReach: Story = { render: () => shown({ away: true }, 420) }

/** Not listed yet, and Taska does not answer. */
export const NeverListed: Story = { render: () => shown({ rows: null, away: true }, 260) }

/** Loading, the first time in this browser. */
export const Loading: Story = { render: () => shown({ rows: null }, 260) }

/** No projects yet. */
export const NoProjects: Story = { render: () => shown({ rows: [], needs: 0 }, 260) }

/** A new project's name being typed, and why it was not made. */
export const NewProject: Story = { render: () => shown({ making: { error: '' } }, 420) }
export const NotCreated: Story = { render: () => shown({ making: { error: 'Connection lost; try again' } }, 420) }
