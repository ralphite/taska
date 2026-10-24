import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SearchHit } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { PROJECT_TONES } from '../../ui/tones'
import { Home, type HomeEvents, type HomeFacts, type HomeRow } from './Home'

const meta: Meta = { title: 'Components/Home' }
export default meta
type Story = StoryObj

const on: HomeEvents = { query() {}, restore() {}, closeGone() {}, closeNone() {}, startNew() {}, cancelNew() {}, create() {}, open() {} }
const rows: HomeRow[] = [
  { name: 'taska', title: 'taska', tone: PROJECT_TONES[4], open: 32, needs: 2, agent: { name: 'Claude', on: true }, next: { code: 'F581', title: 'Rewrite Taska from scratch' } },
  { name: 'home', title: 'Home', tone: PROJECT_TONES[0], open: 13, needs: 11, agent: { name: 'Codex', on: false }, next: { code: 'B12', title: 'The garden tap drips when it is turned off all the way' } },
  { name: 'notes', title: '读书笔记', tone: PROJECT_TONES[2], open: 2, needs: 0, agent: null, next: null },
  { name: 'long', title: 'A project with a very long name that does not fit anywhere at all', tone: PROJECT_TONES[6], open: 0, needs: 0, agent: null, next: null },
]
const facts: HomeFacts = { rows, needs: 13, away: false, gone: null, none: null, q: '', hits: null, making: null }
const hits: SearchHit[] = [
  { project: 'taska', ptitle: 'taska', kind: 'item', code: 'F581', title: 'Rewrite Taska from scratch', status: 'doing', t: '' },
  { project: 'home', ptitle: 'Home', kind: 'item', code: 'B3', title: 'Fix the rewrite of the shelf', status: 'done', t: '' },
  { project: 'home', ptitle: 'Home', kind: 'item', code: 'T9', title: 'Rewrite the shopping list', status: 'dropped', t: '' },
  { project: 'taska', ptitle: 'taska', kind: 'item', code: 'T40', title: 'Old rewrite notes', archived: true, t: '' },
  { project: 'taska', ptitle: 'taska', kind: 'input', code: 'r315', title: 'the rewrite should keep every word the agents read', t: '' },
]

const shown = (f: Partial<HomeFacts>, height = 620) => (
  <Frames phoneWidth={393} deskWidth={1100} height={height}>
    {() => <Home facts={{ ...facts, ...f }} on={on} />}
  </Frames>
)

/** Every project with its agent, open count, what needs you and the first of it. */
export const Projects: Story = { render: () => shown({}) }

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
