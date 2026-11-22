// What agents read (T628, T768): in the Agents sheet, the guide an agent follows, laid out. The page's own sheet with
// what the page's own agentsFacts makes of the demo project, What agents read picked.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TASKS, WORKING, AGENTS_ON } from '../../stories/agentsFixtures'
import { guide } from '../../stories/guideFixture'
import { SheetFrames } from '../../stories/sheetFixtures'
import { shopWithHistory } from '../../stories/settingsFixtures'
import { agentsSheet } from './Agents'
import { agentsFacts } from './agentsFacts'

export default { title: 'UI/List pane/Top bar/Agent pill/What agents read' } satisfies Meta
type Story = StoryObj

const on = AGENTS_ON
const sheet = (text: string | null): Story => ({
  render: () => <SheetFrames look={{ tall: true, wide: true }} height={820} deskWidth={1200} parts={() => agentsSheet(agentsFacts(shopWithHistory(WORKING, { tasks: TASKS }), text), on, { pick: 'guide', page: true })} />,
})

/** Its parts, each command beside what it does, the example. */
export const WhatAgentsRead: Story = { ...sheet(guide('shop')), name: 'Its guide' }
export const WhatAgentsReadLoading: Story = { ...sheet(null), name: 'Its guide, loading' }
