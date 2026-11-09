// Whether an agent is around (T591: Top bar and list head > Agent pill): the pill in the desktop's bar and the phone's
// head, from the page's own agentInfo with what Taska last heard of the agents; and the count of changes not saved.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { act } from '../stories/acts'
import { Frames } from '../stories/Frames'
import { AGENTS, headOf, type HeadHere } from '../stories/headFixtures'
import { PaneFrame } from '../ui/PaneFrame'
import { OfflinePill } from './Header'

export default { title: 'UI/List pane/Top bar/Agent pill' } satisfies Meta
type Story = StoryObj

const one = (h: HeadHere): Story => ({ render: () => <Frames deskWidth={1100} phoneWidth={393} height={200}>{(layout) => headOf(layout === 'desk', h)}</Frames> })

/** An agent connected, waiting for work. */
export const PillWorking: Story = { ...one({ agents: AGENTS.ready }), name: 'Ready for work' }
/** Here lately. */
export const PillRecent: Story = { ...one({ agents: AGENTS.recent }), name: 'Here lately' }
/** Work waits, the last agent left 2 hours ago. */
export const PillGone: Story = { ...one({ agents: AGENTS.gone, work: true }), name: 'Work waits, no agent' }
/** A Claude Code session waits on the user (T711 #10443): amber, before anything else the pill could say. */
export const PillBlocked: Story = { ...one({ agents: AGENTS.blocked }), name: 'Blocked, waiting on you' }
/** A long session name is cut; what follows it (how long ago) stays (T711). */
export const PillLongSession: Story = { ...one({ agents: AGENTS.long }), name: 'A long session name' }
/** An agent with no app icon of its own: its name in words, then its session (T711). */
export const PillNoIcon: Story = { ...one({ agents: AGENTS.other }), name: 'An agent without an icon' }
/** No agent has ever come, nothing waits for one. */
export const PillIdle: Story = { ...one({ agents: AGENTS.none, work: false }), name: 'No agent yet' }
/** Taska does not answer: Offline, retrying. */
export const PillOffline: Story = { ...one({ away: 2 }), name: 'Offline' }
/** Two changes could not be saved: their count opens them. */
export const NotSaved: Story = { ...one({ notSaved: 2 }), name: 'Not saved count' }
/** On the phone an item's page covers the list's head, so it says Offline, retrying under its own bar (D82 #5). */
export const OfflineOnPhoneItem: Story = {
  name: 'Phone: Offline over an item',
  render: () => (
    <Frames desk={false} phoneWidth={393} height={220}>
      {() => (
        <div className="flex h-44 flex-col">
          <PaneFrame place="" desk={false} head={<span className="font-mono text-sm font-bold">F012</span>} menu notice={<OfflinePill />} onBack={act('Pane: back')} onMenu={act('Pane: menu → Menus and sheets › Item menu')}>
            <p className="px-4 py-4 text-[15px]">Export ignores the active filter</p>
          </PaneFrame>
        </div>
      )}
    </Frames>
  ),
}
