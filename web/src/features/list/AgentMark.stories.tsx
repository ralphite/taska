// The mark of the agent on an item's row: the agent working on it now (its name and session in the tip), as the
// page's own steps work it out.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, item } from '../../stories/fixtures'
import { listOf } from '../../stories/listFixtures'
import { one as tip } from '../../stories/tipFixtures'

export default { title: 'Components/Item list/Item row/By status/Still to do' } satisfies Meta

const hoursAgo = (h: number) => new Date(Date.parse(T) - h * 3600e3).toISOString()
const items = [
  item({ n: 1, status: 'doing', title: 'Export keeps the filter you set', agent: { by: 'claude-code', t: T } }),
  item({ n: 2, status: 'doing', title: 'Search finds words in the talk', agent: { by: 'codex', t: hoursAgo(3) } }),
]

/** the desktop: the pointer on the first row's mark shows whose it is (the page's own tip) */
export const AtWork: StoryObj = {
  ...tip(() => listOf(items, 'items', { status: 'all' }, true), '[aria-label$="is on it"]', { width: 460, height: 220 }),
  name: 'In progress: the agent at work, its name in the tip',
}
