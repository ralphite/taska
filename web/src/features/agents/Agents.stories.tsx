// What the agent pill opens (T768, Gemini's "compact" design, Yadong's choice): every agent session seen in the
// project by its app, a manager's workers under it; the one picked beside them. The page's own sheet with what the
// page's own agentsFacts makes of the demo project Shop and the sessions its agents report.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ALL_GONE, ITEMS, MANAGER, NEW_SESSION_TEXT, WAITING, WORKING, sessionKey, AGENTS_ON } from '../../stories/agentsFixtures'
import { guide } from '../../stories/guideFixture'
import { SheetFrames } from '../../stories/sheetFixtures'
import { shopWithHistory } from '../../stories/settingsFixtures'
import { waitsInQueue, withOpenKids } from '../../model/items'
import type { AgentSeen } from '../../model/types'
import { agentsSheet, type AgentsStart } from './Agents'
import { agentsFacts } from './agentsFacts'

export default { title: 'UI/List pane/Top bar/Agent pill/Agents' } satisfies Meta
type Story = StoryObj

const on = AGENTS_ON
/** the project with nothing in its queue now (what waits is for later, or in progress) */
const IDLE = ITEMS.filter((it) => !waitsInQueue(it, withOpenKids(ITEMS)))
const sheet = (agents: AgentSeen[], start: AgentsStart = {}, o: { work?: boolean; items?: typeof ITEMS; remote?: string } = {}): Story => ({
  render: () => (
    <SheetFrames look={{ tall: true, wide: true }} height={820} deskWidth={1200} parts={() => agentsSheet(agentsFacts(shopWithHistory(agents, { items: ITEMS, ...o }), guide('shop')), on, start)} />
  ),
})

/** One session works on T001, picked as the sheet opens; a Codex session left hours ago. */
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
/** With no public address: no Connect an agent on another network. */
export const ConnectNoPublicAddress: Story = { ...sheet(WORKING, {}, { remote: '' }), name: 'Connect, no public address' }
/** The phone: the list (it opens there unless a session waits for you). */
export const PhoneList: Story = { ...sheet(MANAGER, { page: false }), name: 'Phone: the list' }
/** The phone: a session's page, Back to the list (it opens there when a session waits for you). */
export const PhoneSessionPage: Story = { ...sheet(MANAGER), name: "Phone: a session's page" }

// T833 (Yadong r1433 r1435): a session that lost its connection (the machine restarted) comes back by a message from
// another session of its app. Reconnect hands that to a connected one; with none connected, a new session does it
// with the words shown (on the desktop Claude's own link opens one with them in). Codex needs none: Taska wakes it.
const LOST = sessionKey('claude-code', 'Export keeps the filter')
/** Gone: Reconnect beside Open in Claude Code (press it: a connected session is handed it). */
export const Reconnect: Story = { ...sheet(ALL_GONE, { pick: LOST, page: true }), name: 'Gone: Reconnect' }
/** Pressed: a connected Claude session sends it the message; the button waits until it is back. */
export const Reconnecting: Story = { ...sheet(ALL_GONE, { pick: LOST, page: true, reconnecting: 'sent' }), name: 'Gone: reconnecting' }
/** None connected: what to start a new session with (New session opens one with it on the desktop). */
export const ReconnectNoneConnected: Story = { ...sheet(ALL_GONE, { pick: LOST, page: true, reconnecting: { text: NEW_SESSION_TEXT } }), name: 'Gone: none connected' }
/** Codex is woken through its own queue: no Reconnect. */
export const CodexGoneNoReconnect: Story = { ...sheet(ALL_GONE, { pick: sessionKey('codex', 'main'), page: true }), name: 'Codex gone: no Reconnect' }
