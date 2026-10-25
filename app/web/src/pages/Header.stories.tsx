// The desktop's bar over the panes (T591: Top bar and list head > Project bar): the project's name, its tabs with
// their counts, whether an agent is around, from the page's own headFacts with the item list's demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { headOf } from '../stories/headFixtures'

export default { title: 'Components/Top bar and list head/Project bar' } satisfies Meta
type Story = StoryObj

export const ProjectBar: Story = { name: 'Project bar', render: () => <Frames phone={false} deskWidth={1100} height={180}>{() => headOf(true)}</Frames> }
/** A tab under the pointer, from the keys, pressed; the agent pill under the pointer. */
export const ProjectBarLooks: Story = {
  name: 'Pointer, keys, pressed: all side by side',
  parameters: { pseudo: { hover: ['[data-look="pointer"] [role="tab"]:nth-of-type(2)', '[data-look="pointer"] nav > div:last-child button'], focusVisible: ['[data-look="keys"] [role="tab"]:nth-of-type(2)'], active: ['[data-look="pressed"] [role="tab"]:nth-of-type(2)'] } },
  render: () => (
    <Frames phone={false} deskWidth={1100}>
      {() => (
        <States
          items={[
            ['pointer on Rules and on the agent', <div data-look="pointer">{headOf(true)}</div>],
            ['keys: Tab on Rules (the browser draws the ring itself)', <div data-look="keys">{headOf(true)}</div>],
            ['Rules pressed', <div data-look="pressed">{headOf(true)}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
