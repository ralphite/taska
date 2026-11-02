// What the agent pill opens (F628): whether an agent is around, who has been here, how to connect one more, and what
// an agent reads, laid out. The page's own sheet with what the page's own agentsFacts makes of a demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { guide } from '../../stories/guideFixture'
import { no, SheetFrames } from '../../stories/sheetFixtures'
import { shopWithHistory } from '../../stories/settingsFixtures'
import { agentsHelpSheet, agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'

export default { title: 'Components/Menus and sheets/Agents' } satisfies Meta
type Story = StoryObj

const sheet = (f: ReturnType<typeof agentsFacts>, open = false): Story => ({ render: () => <SheetFrames look={{ tall: true, wide: true }} height={820} parts={() => agentsSheet(f, { copy: no, help: no }, open)} /> })

/** One around and one that was here earlier. */
export const Agents: Story = { ...sheet(agentsFacts(shopWithHistory(), guide('shop'))), name: 'Agents' }
export const NoneYet: Story = { ...sheet(agentsFacts(shopWithHistory([]), guide('shop'))), name: 'None yet' }
/** What the agent reads, opened: its parts, each command beside what it does, the example. */
export const WhatTheAgentReads: Story = { ...sheet(agentsFacts(shopWithHistory(), guide('shop')), true), name: 'What the agent reads' }
export const WhatTheAgentReadsLoading: Story = { ...sheet(agentsFacts(shopWithHistory(), null), true), name: 'What the agent reads: loading' }
/** How a connected agent gets work without spending tokens: from How it works in Agents. */
export const HowAgentsGetWork: Story = { name: 'How agents get work', render: () => <SheetFrames height={520} parts={() => agentsHelpSheet()} /> }
