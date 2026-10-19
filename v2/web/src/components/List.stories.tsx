import type { Meta, StoryObj } from '@storybook/react-vite'
import { List } from './List'
import { ask, item, load } from '../test/fixture'
import { BEHAVIOUR } from '../lib/behaviour'
import { U } from '../lib/state'
import type { Item, Wait } from '../lib/types'

const LOOP: Item[] = [
  item(1, {
    title: 'Pick the export format',
    pri: 'P1',
    wait: ask(1, 'Which format?\n- ( ) CSV\n- ( ) JSON') as unknown as Wait,
  }),
  item(2, { type: 'bug', title: 'Export ignores the filter', pri: 'P0', status: 'review' }),
  item(3, { type: 'idea', title: 'Dark mode for the reports', status: 'proposed' }),
  item(4, { title: 'Write the user docs', status: 'doing', agent: { by: 'claude-code', t: new Date().toISOString() } }),
  item(5, { title: 'Install page', parent: 4 }),
  item(6, { type: 'feature', title: 'Clean up old branches', pri: 'P3', when: 'later' }),
  item(7, { title: 'Release notes', status: 'done', t1: new Date().toISOString() }),
]
const meta: Meta<typeof List> = {
  title: 'Page/List',
  component: List,
  decorators: [
    (Story) => (
      <div className="flex h-[640px] max-w-[420px] flex-col border border-zinc-200 dark:border-zinc-800">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof List>

/** F291: one tree with preset views on top. */
export const Tree: Story = {
  loaders: [
    () => {
      BEHAVIOUR.treeList = true
      U.status = 'all'
      load(LOOP)
      return {}
    },
  ],
}
/** The Needs you view: newest first, Go through on top. */
export const NeedsYou: Story = {
  loaders: [
    () => {
      BEHAVIOUR.treeList = true
      U.status = 'wait'
      load(LOOP)
      return {}
    },
  ],
}
/** The one-file Taska's bands (the switch in behaviour.ts). */
export const Bands: Story = {
  loaders: [
    () => {
      BEHAVIOUR.treeList = false
      U.status = 'all'
      load(LOOP)
      return {}
    },
  ],
}
export const Empty: Story = {
  loaders: [
    () => {
      U.status = 'all'
      load([])
      return {}
    },
  ],
}
