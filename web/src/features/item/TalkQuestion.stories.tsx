// A question from an agent in an item's talk, one story for each answer and state: the page's own talk (ItemTalk), its card where the question is.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item, Message } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, item, message } from '../../stories/fixtures'
import { talkOf, you, type PageOpts } from '../../stories/itemPage'

export default { title: 'Components/Conversation/Message/Question' } satisfies Meta
type Story = StoryObj

const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
const ASK = 'Which format should the export use?\n- ( ) CSV\n- ( ) Excel'
const CHECKS = 'Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'
const ask = (text = ASK, id = 4) => message({ id, kind: 'ask', text })
const waits = (text = ASK, id = 4): Partial<Item> => ({ wait: { id, kind: 'ask', text, by: 'claude-code', files: [] } })
const said = (text: string, id = 5) => ({ ...you(id, text), t: later(2) })
const at = (thread: Message[], f: Partial<Item> = {}, o: PageOpts = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', o)}</Frames>,
})
const answered = [ask(), said('✓ CSV')]

export const Answered = at(answered)
export const AnsweredPointerOnItModify: Story = { ...at(answered), name: 'Answered, pointer on it: Modify', parameters: { pseudo: { hover: ['.group'] } } }
export const ChecklistAnswered = at([ask(CHECKS), said('✓ CSV\n✓ JSON')])
export const SkippedYouRepliedInstead: Story = { ...at([ask(), said('Whichever is quicker.')], { talked: true }), name: 'Skipped: you replied instead' }
export const ChangingTheAnswer = at(answered, {}, { t: { reask: 4 } })
export const NewAnswerOnItsWay = at(answered, {}, { t: { going: { text: '✓ Excel', state: 'Sending…' } } })
export const AnsweredApproveBesideIt: Story = { ...at(answered, { status: 'proposed', by: 'claude-code' }), name: 'Answered, Approve beside it' }
export const AnsweredPointerOnApprove: Story = { ...at(answered, { status: 'proposed', by: 'claude-code' }), name: 'Answered, pointer on Approve', parameters: { pseudo: { hover: ['button'] } } }
export const NoChoicesAnsweredByYourWords: Story = { ...at([ask('Should the old export stay for a while?'), said('A week, then remove it.')]), name: 'No choices, answered by your words' }
export const NotAnsweredAskedAgainLater: Story = {
  ...at([ask(ASK, 4), { ...message({ id: 6, kind: 'ask', text: 'Still: which format?\n- ( ) CSV\n- ( ) Excel' }), t: later(30) }], waits('Still: which format?\n- ( ) CSV\n- ( ) Excel', 6)),
  name: 'Not answered, asked again later',
}
export const TakenBackByTheAgent = at([ask(), { ...message({ id: 5, kind: 'withdraw', text: 'Found it in the notes: CSV.' }), t: later(3) }])
