// Whether an agent is around (T591: Top bar and list head > Agent pill): the pill in the desktop's bar and the phone's
// head, from the page's own agentInfo with what Taska last heard of the agents; and the count of changes not saved.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../stories/Frames'
import { AGENTS, headOf, type HeadHere } from '../stories/headFixtures'
import { PaneFrame } from '../ui/PaneFrame'
import { OfflinePill } from './Header'

export default { title: 'Components/Around the page/Top bar and list head/Agent pill' } satisfies Meta
type Story = StoryObj

const one = (h: HeadHere): Story => ({ render: () => <Frames deskWidth={1100} phoneWidth={393} height={200}>{(layout) => headOf(layout === 'desk', h)}</Frames> })

/** An agent connected, waiting for work. */
export const PillWorking: Story = { ...one({ agents: AGENTS.ready }), name: 'Ready for work' }
/** Here lately. */
export const PillRecent: Story = { ...one({ agents: AGENTS.recent }), name: 'Here lately' }
/** Work waits, the last agent left 2 hours ago. */
export const PillGone: Story = { ...one({ agents: AGENTS.gone, work: true }), name: 'Work waits, no agent' }
/** No agent has ever come, nothing waits for one. */
export const PillIdle: Story = { ...one({ agents: AGENTS.none, work: false }), name: 'No agent yet' }
/** Taska does not answer: Offline, retrying. */
export const PillOffline: Story = { ...one({ away: 2 }), name: 'Offline' }
/** Two changes could not be saved: their count opens them. */
export const NotSaved: Story = { ...one({ notSaved: 2 }), name: 'Not saved count' }
/** On the phone an item's page covers the list's head, so it says Offline, retrying under its own bar (D82 #5). */
export const OfflineOnPhoneItem: Story = {
  name: 'Offline, on the phone over an item',
  render: () => (
    <Frames desk={false} phoneWidth={393} height={220}>
      {() => (
        <div className="flex h-44 flex-col">
          <PaneFrame place="" desk={false} head={<span className="font-mono text-sm font-bold">F012</span>} menu notice={<OfflinePill />} onBack={() => {}} onMenu={() => {}}>
            <p className="px-4 py-4 text-[15px]">Export ignores the active filter</p>
          </PaneFrame>
        </div>
      )}
    </Frames>
  ),
}
