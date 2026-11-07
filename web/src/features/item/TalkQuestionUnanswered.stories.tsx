// A question you replied to instead, not answered and asked again, taken back by the agent.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { ASK, FORM, ask, at, later, said, waits } from '../../stories/talkQuestionFixtures'

export default { title: 'UI/Item pane/Talk/Message/Question/Not answered with a choice' } satisfies Meta
type Story = StoryObj

export const SkippedYouRepliedInstead: Story = { ...at([ask(), said('Whichever is quicker.')], { talked: true }), name: 'Skipped: you replied instead' }
export const PointingToADocumentYouRepliedInstead: Story = {
  ...at([ask('Pick the formats in D14.'), said('Whichever is quicker.')], { talked: true }, { docs: [FORM] }),
  name: 'Question pointing to a document, you replied instead',
}
export const NotAnsweredAskedAgainLater: Story = {
  ...at([ask(ASK, 4), { ...message({ id: 6, kind: 'ask', text: 'Still: which format?\n- ( ) CSV\n- ( ) Excel' }), t: later(30) }], waits('Still: which format?\n- ( ) CSV\n- ( ) Excel', 6)),
  name: 'Not answered, asked again later',
}
export const TakenBackByTheAgent: Story = { ...at([ask(), { ...message({ id: 5, kind: 'withdraw', text: 'Found it in the notes: CSV.' }), t: later(3) }]), name: 'Taken back by the agent' }
