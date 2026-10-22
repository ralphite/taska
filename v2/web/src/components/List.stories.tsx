import type { Meta, StoryObj } from '@storybook/react-vite'
import { List } from './List'
import { ask, item, load } from '../test/fixture'
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
      U.status = 'wait'
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

// T457: every tab, a search, long titles, many agents at work
const tab =
  (status: string, list: Item[] = LOOP, q = '') =>
  () => {
    U.status = status
    U.q = q
    load(list)
    return {}
  }
const LONG: Item[] = [
  ...LOOP,
  item(8, {
    title:
      'A very long title that runs past the edge of the row to see where it is cut and whether the pills still fit',
    pri: 'P0',
  }),
  item(9, {
    title: '一个很长的中文标题，看看在手机上是怎么换行或者截断的，还有右边的按钮会不会被挤掉',
    status: 'doing',
    agent: { by: 'codex', t: new Date(Date.now() - 40 * 60000).toISOString() },
  }),
  item(10, { title: 'Archived long ago', status: 'done', archived: true }),
  item(11, { title: 'Will not do', status: 'dropped' }),
  item(12, { title: 'Agent at work', status: 'doing', agent: { by: 'antigravity', t: new Date().toISOString() } }),
]
export const Active: Story = { loaders: [tab('active', LONG)] }
export const Queue: Story = { loaders: [tab('queued', LONG)] }
export const Finished: Story = { loaders: [tab('closed', LONG)] }
export const Archive: Story = { loaders: [tab('archived', LONG)] }
export const Search: Story = { loaders: [tab('all', LONG, 'export')] }
export const LongTitles: Story = { loaders: [tab('all', LONG)] }
