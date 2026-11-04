// An empty project, a small one, and the list loading and empty in every view.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { item } from '../../stories/fixtures'
import { listOn } from '../../stories/listFixtures'
import { act } from '../../stories/menuFixtures'
import { EmptyList, ItemList } from './ItemList'
import { view } from '../../stories/itemListFixtures'

export default { title: 'Components/Item list/Views/Empty, small, loading' } satisfies Meta
type Story = StoryObj

export const EmptyProject: Story = { ...view('items', { status: 'all' }, []), name: 'An empty project' }
/** a view with nothing in it while the project has items: the views stay above, Nothing here. under them */
export const AnEmptyView: Story = { ...view('items', { status: 'open' }, [item({ n: 1, status: 'done', title: 'Book the flights' }), item({ n: 2, status: 'review', title: 'Plan the trip' })]), name: 'A view with nothing in it (Open)' }
export const SmallProject: Story = { ...view('items', { status: 'all' }, [item({ n: 1, title: 'Plan the trip' }), item({ n: 2, status: 'done', title: 'Book the flights' })]), name: 'A small project' }

/** Before the project's data comes; and an empty list, for each reason it can be empty (an empty project twice: the
 * organizer on, then off). */
export const LoadingAndEveryEmptyList: Story = {
  name: 'Loading, and every empty list',
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <div className="flex flex-col divide-y divide-dashed divide-zinc-300 dark:divide-zinc-700">
          <div className="flex h-32 flex-col">
            <ItemList loading views={null} rows={[]} on={listOn} />
          </div>
          {(
            [
              ['no-items', 'wait', true],
              ['no-items', 'wait', false],
              ['none', 'wait', false],
              ['no-match', 'wait', false],
              ['no-match-rules', 'wait', false],
              ['no-rules', 'wait', false],
              ['nothing-archived', 'wait', false],
              ['nothing', 'wait', false],
              ['nothing', 'done', false],
              ['nothing', 'dropped', false],
              ['nothing', 'all', false],
            ] as const
          ).map(([why, status, organizerOn]) => (
            <div key={why + status + organizerOn} className="flex flex-col">
              <ItemList loading={false} views={null} rows={[]} on={listOn} empty={<EmptyList why={why} status={status} organizerOn={organizerOn} onReset={act('List: clear search and filters')} onConnect={act('List: connect an agent → Agents › Who works here')} />} />
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}
