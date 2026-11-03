// What the agent pill opens (F628): whether an agent is around, who has been here, how to connect one more. The page's own sheet with what the page's own agentsFacts makes of a demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { guide } from '../../stories/guideFixture'
import { no, SheetFrames } from '../../stories/sheetFixtures'
import { SEEN, shopWithHistory } from '../../stories/settingsFixtures'
import type { AgentSeen } from '../../model/types'
import { agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'

export default { title: 'Components/Menus and sheets/Agents/Who works here' } satisfies Meta
type Story = StoryObj

const sheet = (f: ReturnType<typeof agentsFacts>, open = false): Story => ({ render: () => <SheetFrames look={{ tall: true, wide: true }} height={820} parts={() => agentsSheet(f, { copy: no, help: no }, open)} /> })

/** One around and one that was here earlier. */
export const Agents: Story = { ...sheet(agentsFacts(shopWithHistory(), guide('shop'))), name: 'One at work, one here earlier' }
export const NoneYet: Story = { ...sheet(agentsFacts(shopWithHistory([]), guide('shop'))), name: 'None yet' }
/** How a connected agent gets work without spending tokens: from How it works in Agents. */
/** Nothing waits for an agent and none has been here. */
export const NothingWaitingNoneYet: Story = { ...sheet(agentsFacts(shopWithHistory([], { work: false }), guide('shop'))), name: 'Nothing waiting, none yet' }
// ---- more states (T639): each as the page's own agentsFacts makes it of the demo project
const gone: AgentSeen[] = [{ name: 'codex', t: SEEN[1].t, waiting: false }]
/** an agent that finished its round minutes ago and left: green, here lately */
export const HereLately: Story = { ...sheet(agentsFacts(shopWithHistory([{ name: 'codex', t: SEEN[0].t - 3 * 60_000, waiting: false }]), guide('shop'))), name: 'One here a few minutes ago' }
/** work waits and the agent that was here left hours ago: the red card, and who was seen */
export const WorkWaitsAgentLeft: Story = { ...sheet(agentsFacts(shopWithHistory(gone), guide('shop'))), name: 'Work waits, the last agent left hours ago' }
/** nothing waits and an agent was here before: the grey card with its time, and who was seen */
export const NothingWaitingAgentWasHere: Story = { ...sheet(agentsFacts(shopWithHistory(gone, { work: false }), guide('shop'))), name: 'Nothing waiting, an agent was here' }
/** an agent Taska does not know by name: dimmed in Seen in this project */
export const SeenAnUnknownAgent: Story = { ...sheet(agentsFacts(shopWithHistory([...SEEN, { name: 'helper-bot', t: SEEN[1].t, waiting: false }]), guide('shop'))), name: 'Seen: an agent Taska does not know' }
/** no public address: no Copy for another network under the command */
export const NoPublicAddress: Story = { ...sheet(agentsFacts(shopWithHistory(SEEN, { remote: '' }), guide('shop'))), name: 'No public address' }
