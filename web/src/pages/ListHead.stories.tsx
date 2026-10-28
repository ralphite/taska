// The list's head (T591: Top bar and list head > List head): its search on the desktop, the phone's head with its
// search, from the page's own headFacts with the item list's demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { headOf } from '../stories/headFixtures'

export default { title: 'Components/Top bar and list head/List head' } satisfies Meta
type Story = StoryObj

/** The desktop's search under the bar (/ goes there); the phone's head: the menu with the project's name (a dot when
 * another project needs you), the agent, Search. */
export const ListHead: Story = { name: 'Search box', render: () => <Frames deskWidth={1100} phoneWidth={393} height={200}>{(layout) => headOf(layout === 'desk', { otherNeeds: true })}</Frames> }
/** Words in the search: each tab says how many it matches, Clear. */
export const ListHeadSearching: Story = { name: 'Searching', render: () => <Frames deskWidth={1100} phoneWidth={393} height={200}>{(layout) => headOf(layout === 'desk', { list: { q: 'export' }, searching: true })}</Frames> }
/** The search under the pointer, from the keys, being typed in (the desktop). */
export const ListHeadLooks: Story = {
  name: 'Pointer, keys, typing: all side by side',
  parameters: { pseudo: { hover: ['[data-look="pointer"] header label'], focusWithin: ['[data-look="keys"] header label', '[data-look="typing"] header label'] } },
  render: () => (
    <Frames phone={false} deskWidth={1100}>
      {() => (
        <States
          items={[
            ['pointer on the search', <div data-look="pointer">{headOf(true)}</div>],
            ['keys: / to the search', <div data-look="keys">{headOf(true)}</div>],
            ['typing', <div data-look="typing">{headOf(true, { list: { q: 'expo' } })}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
