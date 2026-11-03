// Changing an answer, and the new answer on its way.
import type { Meta } from '@storybook/react-vite'
import { answered, at } from '../../stories/talkQuestionFixtures'

export default { title: 'Components/Conversation/Message/Question/Changing the answer' } satisfies Meta

export const ChangingTheAnswer = at(answered, {}, { t: { reask: 4 } })
export const NewAnswerOnItsWay = at(answered, {}, { t: { going: { text: '✓ Excel', state: 'Sending…' } } })
// ---- more states (T639)
/** changing the answer to a proposal's last question: Cancel, Approve and Send answer side by side */
export const ChangingTheLastAnswerOfAProposal = { ...at(answered, { status: 'proposed', by: 'claude-code' }, { t: { reask: 4 } }), name: "Changing the answer to a proposal's last question" }
