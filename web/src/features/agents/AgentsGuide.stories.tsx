// What the agent pill opens (F628), its guide opened: what an agent reads, laid out. The page's own sheet with what the page's own agentsFacts makes of a demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { guide } from '../../stories/guideFixture'
import { no, SheetFrames } from '../../stories/sheetFixtures'
import { shopWithHistory } from '../../stories/settingsFixtures'
import { agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'

export default { title: 'Components/Menus and sheets/Agents/What an agent reads' } satisfies Meta
type Story = StoryObj

const sheet = (f: ReturnType<typeof agentsFacts>, open = false): Story => ({ render: () => <SheetFrames look={{ tall: true, wide: true }} height={820} parts={() => agentsSheet(f, { copy: no, help: no }, open)} /> })

/** What the agent reads, opened: its parts, each command beside what it does, the example. */
export const WhatTheAgentReads: Story = { ...sheet(agentsFacts(shopWithHistory(), guide('shop')), true), name: 'Its guide, opened' }
export const WhatTheAgentReadsLoading: Story = { ...sheet(agentsFacts(shopWithHistory(), null), true), name: 'Its guide, loading' }
