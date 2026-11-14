// What the agent pill opens (F768, Gemini's "compact" design, Yadong's choice): every agent session seen in the
// project by its app, a manager's workers under it; the one picked beside them. The page's own sheet with what the
// page's own agentsFacts makes of the demo project Shop and the sessions its agents report.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ALL_GONE, ITEMS, MANAGER, WAITING, WORKING, sessionKey } from '../../stories/agentsFixtures'
import { guide } from '../../stories/guideFixture'
import { acts, SheetFrames } from '../../stories/sheetFixtures'
import { shopWithHistory } from '../../stories/settingsFixtures'
import { waitsInQueue, withOpenKids } from '../../model/items'
import type { AgentSeen } from '../../model/types'
import { agentsSheet, type AgentsStart } from './Agents'
import { agentsFacts } from './agentsFacts'

export default { title: 'UI/List pane/Top bar/Agent pill/Agents' } satisfies Meta
type Story = StoryObj

const on = acts('Agents', ['copy', 'help', 'open'], { help: 'Help › Topics › Connect an agent', open: 'the item' })
/** the project with nothing in its queue now (what waits is for later, or in progress) */
const IDLE = ITEMS.filter((it) => !waitsInQueue(it, withOpenKids(ITEMS)))
const sheet = (agents: AgentSeen[], start: AgentsStart = {}, o: { work?: boolean; items?: typeof ITEMS; remote?: string } = {}): Story => ({
  render: () => (
    <SheetFrames look={{ tall: true, wide: true }} height={820} deskWidth={1200} parts={() => agentsSheet(agentsFacts(shopWithHistory(agents, { items: ITEMS, ...o }), guide('shop')), on, start)} />
  ),
})

/** One session works on F001, picked as the sheet opens; a Codex session left hours ago. */
export const OneWorking: Story = { ...sheet(WORKING), name: 'One working' }
/** A session asks to run a command: picked as the sheet opens, its amber block says what it waits on. */
export const WaitingForYou: Story = { ...sheet(WAITING), name: 'A session waiting for you' }
/** A manager and its two workers under it, a session waiting for you (picked), Codex, Antigravity gone a while. */
export const ManagerWithWorkers: Story = { ...sheet(MANAGER, { pick: sessionKey('claude-code', 'Manager') }), name: 'A manager with workers' }
/** No agent has been here: what agents read beside the way to connect one. */
export const NoneYet: Story = { ...sheet([]), name: 'None yet' }
/** Nothing waits for an agent and none has been here. */
export const NothingWaitingNoneYet: Story = { ...sheet([], {}, { work: false, items: IDLE }), name: 'Nothing waiting, none yet' }
/** Every session left: the latest picked, faint in the list. */
export const OnlyGone: Story = { ...sheet(ALL_GONE), name: 'Only gone ones' }
/** A Codex session picked, its Resume opened: the command to copy. */
export const CodexResume: Story = { ...sheet(MANAGER, { pick: sessionKey('codex', 'main'), resume: true }), name: 'Codex: resume' }
/** An agent Taska does not know by name: a group of its own, by its name. */
export const AnUnknownAgent: Story = { ...sheet([...WORKING, { name: 'helper-bot', t: WORKING[1].t, waiting: false }]), name: 'An agent Taska does not know' }
/** With no public address: no Another network. */
export const ConnectNoPublicAddress: Story = { ...sheet(WORKING, {}, { remote: '' }), name: 'Connect, no public address' }
/** The phone: the list (it opens there unless a session waits for you). */
export const PhoneList: Story = { ...sheet(MANAGER, { page: false }), name: 'Phone: the list' }
/** The phone: a session's page, Back to the list (it opens there when a session waits for you). */
export const PhoneSessionPage: Story = { ...sheet(MANAGER), name: "Phone: a session's page" }
