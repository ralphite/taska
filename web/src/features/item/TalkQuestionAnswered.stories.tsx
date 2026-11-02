// An agent's question answered: with a choice, a checklist, your own words; the pointer on it; Approve beside it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CHECKS, answered, ask, at, said } from '../../stories/talkQuestionFixtures'

export default { title: 'Components/Conversation/Message/Question/Answered' } satisfies Meta
type Story = StoryObj

export const Answered = at(answered)
export const AnsweredPointerOnItModify: Story = { ...at(answered), name: 'Answered, pointer on it: Modify', parameters: { pseudo: { hover: ['.group'] } } }
export const ChecklistAnswered = at([ask(CHECKS), said('✓ CSV\n✓ JSON')])
export const NoChoicesAnsweredByYourWords: Story = { ...at([ask('Should the old export stay for a while?'), said('A week, then remove it.')]), name: 'No choices, answered by your words' }
export const AnsweredApproveBesideIt: Story = { ...at(answered, { status: 'proposed', by: 'claude-code' }), name: 'Answered, Approve beside it' }
export const AnsweredPointerOnApprove: Story = { ...at(answered, { status: 'proposed', by: 'claude-code' }), name: 'Answered, pointer on Approve', parameters: { pseudo: { hover: ['button'] } } }
