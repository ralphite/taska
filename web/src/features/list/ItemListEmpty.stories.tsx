// An empty project, a small one, and the list loading and empty in every view.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { item } from '../../stories/fixtures'
import { listOf, listOn } from '../../stories/listFixtures'
import { act } from '../../stories/menuFixtures'
import { EmptyList, ItemList } from './ItemList'
import { view } from '../../stories/itemListFixtures'

export default { title: 'UI/List pane/Empty list' } satisfies Meta
type Story = StoryObj

/** An empty project: its first steps as done (D115 #20) */
const emptyProject = (firstRun: { agent: boolean; input: boolean; phone: boolean }): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={760}>{(layout) => listOf([], 'items', { status: 'all' }, layout === 'desk', { firstRun })}</Frames>,
})
export const EmptyProject: Story = { ...emptyProject({ agent: true, input: false, phone: false }), name: 'An empty project' }
/** its first steps, none done yet; each ticks itself when its data says so (D115 #20) */
export const EmptyProjectNothingDone: Story = { ...emptyProject({ agent: false, input: false, phone: false }), name: 'An empty project: first steps' }
/** all three done: the checklist is gone for good, the list's own words */
export const EmptyProjectAllDone: Story = { ...emptyProject({ agent: true, input: true, phone: true }), name: 'An empty project: first steps done' }
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
              ['nothing-archived', 'wait', false],
              ['nothing', 'wait', false],
              ['nothing', 'done', false],
              ['nothing', 'dropped', false],
              ['nothing', 'all', false],
            ] as const
          ).map(([why, status, organizerOn]) => (
            <div key={why + status + organizerOn} className="flex flex-col">
              <ItemList loading={false} views={null} rows={[]} on={listOn} empty={<EmptyList why={why} status={status} organizerOn={organizerOn} onReset={act('List: clear search and filters')} onConnect={act('List: connect an agent → Agents')} />} />
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}
