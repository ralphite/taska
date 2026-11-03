// The card when an agent is blocked and needs you: what it needs, with a screenshot; on a proposal or on finished work.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { askOf, at, proposal, report } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item page/Needs-you card/Blocked' } satisfies Meta
type Story = StoryObj

export const Blocked: Story = { ...at({ status: 'open', wait: askOf('I need the API key for staging.', 'block', 'codex') }), name: 'What it needs' }
export const BlockedWithAScreenshot: Story = {
  ...at({ status: 'open', wait: { ...askOf('The export button does nothing here.', 'block', 'codex'), files: [{ f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }] } }),
  name: 'With a screenshot',
}
/** a proposal the agent is blocked on: Approve only, with "Answer below" beside it on a wide screen */
export const BlockedWhileProposed: Story = { ...at({ status: 'proposed', thread: [proposal], wait: askOf('Which page should it start from?', 'block') }), name: 'On a proposal' }
/** finished work the agent is blocked on: Accept only */
export const BlockedWhileInReview: Story = { ...at({ status: 'review', thread: [report], wait: askOf('I cannot reach staging to check it there.', 'block', 'codex') }), name: 'On finished work' }
