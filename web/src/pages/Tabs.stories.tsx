// The project's tabs (T591: Top bar and list head > Tabs): Items and Rules in the desktop's bar (Archive is a view of
// Items there, Inputs the New input page), Items, Inputs and Rules on the phone, each with its count, from the page's
// own headFacts with the item list's demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Tab } from '../model/words'
import { Frames, States } from '../stories/Frames'
import { headOf } from '../stories/headFixtures'

export default { title: 'Components/Top bar and list head/Tabs' } satisfies Meta
type Story = StoryObj

const on = (tab: Tab): Story => ({ render: () => <Frames deskWidth={1100} phoneWidth={393} height={200}>{(layout) => headOf(layout === 'desk', { tab })}</Frames> })

export const Items: Story = { ...on('items'), name: 'Items' }
/** The phone's Inputs: its count is what waits for an agent. */
export const Inputs: Story = { ...on('inputs'), name: 'Inputs' }
/** Archive: Items stays lit (it is a view of Items). */
export const Archive: Story = { ...on('archive'), name: 'Archive' }
export const Rules: Story = { ...on('rules'), name: 'Rules' }
export const TabsLooks: Story = {
  name: 'Pressed: all side by side',
  parameters: { pseudo: { active: ['[data-look="pressed"] [role="tab"]:nth-of-type(3)'], hover: ['[data-look="pointer"] [role="tab"]:nth-of-type(3)'] } },
  render: () => (
    <Frames deskWidth={1100} phoneWidth={393}>
      {(layout) => (
        <States
          items={[
            ['as it is', headOf(layout === 'desk')],
            ['pointer on the last tab', <div data-look="pointer">{headOf(layout === 'desk')}</div>],
            ['the last tab pressed', <div data-look="pressed">{headOf(layout === 'desk')}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
