// The mark of the agent on an item's row (T591: the groups and names Yadong had before the rewrite): an agent at work
// on it now, and one gone quiet (its last word long ago), as the page's own steps work it out.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { T, item } from '../../stories/fixtures'
import { listOf } from '../../stories/listFixtures'

export default { title: 'Components/Item list/Agent mark' } satisfies Meta

const hoursAgo = (h: number) => new Date(Date.parse(T) - h * 3600e3).toISOString()
const items = [
  item({ n: 1, status: 'doing', title: 'Export keeps the filter you set', agent: { by: 'claude-code', t: T } }),
  item({ n: 2, status: 'doing', title: 'Search finds words in the talk', agent: { by: 'codex', t: hoursAgo(3) } }),
]

export const AtWorkAndQuiet: StoryObj = {
  name: 'At work and quiet',
  render: () => <Frames phoneWidth={393} deskWidth={460} height={220}>{(layout) => listOf(items, 'items', { status: 'all' }, layout === 'desk')}</Frames>,
}
