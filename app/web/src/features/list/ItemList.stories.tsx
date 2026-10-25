// The item list in each of its views (T591: the groups and names Yadong had before the rewrite): a demo project's
// list drawn by the page's own steps (../../stories/listFixtures).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ListQuery } from '../../model/route'
import type { SavedView } from '../../model/types'
import type { Tab } from '../../model/words'
import { Frames } from '../../stories/Frames'
import { item } from '../../stories/fixtures'
import { PROJECT, listOf, listOn } from '../../stories/listFixtures'
import { EmptyList, ItemList } from './ItemList'

export default { title: 'Components/Item list/Views' } satisfies Meta
type Story = StoryObj

const view = (tab: Tab, q: Partial<ListQuery>, items = PROJECT, saved: readonly SavedView[] = []): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={760}>{(layout) => listOf(items, tab, q, layout === 'desk', { saved })}</Frames>,
})

export const Active = view('items', { status: 'all' })
export const NeedsYou = view('items', { status: 'wait' })
export const All = view('items', { status: 'every' })
export const Queue = view('items', { status: 'queued' })
export const Later = view('items', { status: 'later' })
export const Finished = view('items', { status: 'closed' })
export const Archive = view('archive', {})
export const Rules = view('rules', {})
const bugs: SavedView = { name: 'Bugs first', type: 'bug', when: 'all', status: 'all', pri: 'all', sort: 'all' }
export const YourOwnViews = view('items', { type: 'bug' }, PROJECT, [bugs, { name: 'Later ideas', type: 'idea', when: 'later', status: 'all', pri: 'all', sort: 'all' }])
export const EmptyProject = view('items', { status: 'all' }, [])
export const SmallProject = view('items', { status: 'all' }, [item({ n: 1, title: 'Plan the trip' }), item({ n: 2, status: 'done', title: 'Book the flights' })])

/** Before the project's data comes; and an empty list, for each reason it can be empty. */
export const LoadingAndEveryEmptyList: Story = {
  name: 'Loading, and every empty list',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <div className="flex flex-col divide-y divide-dashed divide-zinc-300 dark:divide-zinc-700">
          <div className="flex h-32 flex-col">
            <ItemList loading views={null} rows={[]} on={listOn} />
          </div>
          {(['no-items', 'none', 'no-match', 'no-rules', 'nothing-archived', 'empty'] as const).map((why) => (
            <div key={why} className="flex flex-col">
              <ItemList loading={false} views={null} rows={[]} on={listOn} empty={<EmptyList why={why} status="wait" organizerOn={false} onReset={() => {}} onConnect={() => {}} />} />
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}
