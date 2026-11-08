// Changing an answer, and the new answer on its way.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { answered, at } from '../../stories/talkQuestionFixtures'
import { phaseIn } from '../../model/outgoingStates'

const cardShow = phaseIn('sending', 'card') ?? { say: '', tone: 'busy' as const, acts: [] }

export default { title: 'UI/Item pane/Talk/Message/Question/Changing the answer' } satisfies Meta

export const ChangingTheAnswer: StoryObj = { ...at(answered, {}, { t: { reask: 4 } }), name: 'Picking another choice' }
export const NewAnswerOnItsWay: StoryObj = { ...at(answered, {}, { t: { going: { text: '✓ Excel', card: cardShow } } }), name: 'The new answer on its way' }
// ---- more states (T639)
/** changing the answer to a proposal's last question: Cancel, Approve and Send answer side by side */
export const ChangingTheLastAnswerOfAProposal = { ...at(answered, { status: 'proposed', by: 'claude-code' }, { t: { reask: 4 } }), name: "Changing the answer to a proposal's last question" }
