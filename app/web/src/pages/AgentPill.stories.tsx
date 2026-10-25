// Whether an agent is around (T591: Top bar and list head > Agent pill): the pill in the desktop's bar and the phone's
// head, from the page's own agentInfo with what Taska last heard of the agents; and the count of changes not saved.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../stories/Frames'
import { AGENTS, headOf, type HeadHere } from '../stories/headFixtures'

export default { title: 'Components/Top bar and list head/Agent pill' } satisfies Meta
type Story = StoryObj

const one = (h: HeadHere): Story => ({ render: () => <Frames deskWidth={1100} phoneWidth={393} height={200}>{(layout) => headOf(layout === 'desk', h)}</Frames> })

/** An agent connected, picking up work. */
export const PillWorking: Story = { ...one({ agents: AGENTS.ready }), name: 'At work' }
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
