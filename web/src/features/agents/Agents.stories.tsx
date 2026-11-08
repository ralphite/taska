// What the agent pill opens (F628): whether an agent is around, who has been here, how to connect one more. The page's own sheet with what the page's own agentsFacts makes of a demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { guide } from '../../stories/guideFixture'
import { acts, SheetFrames } from '../../stories/sheetFixtures'
import { SEEN, shopWithHistory } from '../../stories/settingsFixtures'
import type { AgentSeen } from '../../model/types'
import { agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'
import { waitsInQueue, withOpenKids } from '../../model/items'
import { PROJECT } from '../../stories/listFixtures'

export default { title: 'UI/List pane/Top bar/Agent pill/Who works here' } satisfies Meta
type Story = StoryObj

/** the project with nothing in its queue now (what waits is for later, or in progress) */
const IDLE = PROJECT.filter((it) => !waitsInQueue(it, withOpenKids(PROJECT)))
const sheet = (f: ReturnType<typeof agentsFacts>, open = false): Story => ({ render: () => <SheetFrames look={{ tall: true, wide: true }} height={820} parts={() => agentsSheet(f, acts('Agents', ['copy', 'help'], { help: 'Help › Topics › Connect an agent' }), open)} /> })

/** One around and one that was here earlier. */
export const Agents: Story = { ...sheet(agentsFacts(shopWithHistory(), guide('shop'))), name: 'One at work, one here earlier' }
export const NoneYet: Story = { ...sheet(agentsFacts(shopWithHistory([]), guide('shop'))), name: 'None yet' }
/** How a connected agent gets work without spending tokens: from How it works in Agents. */
/** Nothing waits for an agent and none has been here. */
export const NothingWaitingNoneYet: Story = { ...sheet(agentsFacts(shopWithHistory([], { work: false, items: IDLE }), guide('shop'))), name: 'Nothing waiting, none yet' }
// ---- more states (T639): each as the page's own agentsFacts makes it of the demo project
const gone: AgentSeen[] = [{ name: 'codex', t: SEEN[1].t, waiting: false }]
/** an agent that finished its round minutes ago and left: green, here lately */
export const HereLately: Story = { ...sheet(agentsFacts(shopWithHistory([{ name: 'codex', t: SEEN[0].t - 3 * 60_000, waiting: false }]), guide('shop'))), name: 'One here a few minutes ago' }
/** work waits and the agent that was here left hours ago: the red card, and who was seen */
export const WorkWaitsAgentLeft: Story = { ...sheet(agentsFacts(shopWithHistory(gone), guide('shop'))), name: 'Work waits, the last agent left hours ago' }
/** nothing waits and an agent was here before: the grey card with its time, and who was seen */
export const NothingWaitingAgentWasHere: Story = { ...sheet(agentsFacts(shopWithHistory(gone, { work: false, items: IDLE }), guide('shop'))), name: 'Nothing waiting, an agent was here' }
/** an agent Taska does not know by name: dimmed in Seen in this project */
export const SeenAnUnknownAgent: Story = { ...sheet(agentsFacts(shopWithHistory([...SEEN, { name: 'helper-bot', t: SEEN[1].t, waiting: false }]), guide('shop'))), name: 'Seen: an agent Taska does not know' }
/** a Claude Code session waits on the user (T711 #10443): the amber card; its line says Blocked, its session what it waits on */
const blocked: AgentSeen[] = [
  { name: 'claude-code', t: SEEN[0].t - 5 * 60_000, waiting: false, sessions: [{ name: 'Export keeps the filter', t: SEEN[0].t - 5 * 60_000 }], blocked: [{ session: 'Export keeps the filter', waitingFor: 'approve Bash: npm --prefix web run check', since: SEEN[0].t - 60_000 }] },
  SEEN[1],
]
export const Blocked: Story = { ...sheet(agentsFacts(shopWithHistory(blocked), guide('shop'))), name: 'A session blocked, waiting on you' }
/** no public address: no Copy for another network under the command */
export const NoPublicAddress: Story = { ...sheet(agentsFacts(shopWithHistory(SEEN, { remote: '' }), guide('shop'))), name: 'No public address' }
