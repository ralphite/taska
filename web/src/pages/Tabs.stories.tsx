// The project's tabs (T591: Top bar and list head > Tabs): Tasks and Rules in the desktop's bar (Archive is a view of
// Tasks there, Inputs the New input page), Tasks, Inputs and Rules on the phone, each with its count, from the page's
// own headFacts with the task list's demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Tab } from '../model/words'
import { Frames, States } from '../stories/Frames'
import { headOf } from '../stories/headFixtures'

export default { title: 'UI/List pane/View tabs/Tabs' } satisfies Meta
type Story = StoryObj

const on = (tab: Tab): Story => ({ render: () => <Frames deskWidth={1100} phoneWidth={393} height={200}>{(layout) => headOf(layout === 'desk', { tab })}</Frames> })

export const Tasks: Story = { ...on('tasks'), name: 'Tasks' }
/** The phone's Inputs: its count is what waits for an agent. */
export const Inputs: Story = { ...on('inputs'), name: 'Inputs' }
export const Rules: Story = { ...on('rules'), name: 'Rules' }
export const TabsLooks: Story = {
  name: 'Desktop: Pointer on a tab',
  parameters: { pseudo: { hover: ['[data-look="pointer"] [role="tab"]:nth-of-type(3)'] } },
  render: () => (
    <Frames phone={false} deskWidth={1100}>
      {(layout) => (
        <States
          tasks={[
            ['as it is', headOf(layout === 'desk')],
            ['pointer on the last tab', <div data-look="pointer">{headOf(layout === 'desk')}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
