// What the input box writes to, one story for each (T591: the groups and names Yadong had before the rewrite): the
// box's line, placeholder and Send as the page works them out from where you are and what the box is in
// (../../stories/boxFixtures), drawn by the page's own Composer, on the phone and the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { threadKey } from '../../model/docs'
import { scopeDraft } from '../../model/draftTarget'
import { Frames } from '../../stories/Frames'
import { PLAN, boxAt, type Here } from '../../stories/boxFixtures'

export default { title: 'Components/Input box/What it writes to' } satisfies Meta
type Story = StoryObj

const at = (h: Here): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => boxAt(h, layout === 'desk')}</Frames> })
const words = 'The export should keep the filter I set.'

export const ANewInputTheNewInputPage: Story = { ...at({ at: 'new', composePage: true }), name: 'A new input (the New input page)' }
export const ANewInputWithWords: Story = { ...at({ at: '', text: words }), name: 'A new input, with words' }
export const AReplyToAnItem = at({ at: 'F012' })
export const AReplyToAnItemWithWords: Story = { ...at({ at: 'F012', text: words }), name: 'A reply to an item, with words' }
export const ACommentOnAParagraph = at({ at: 'D1', sel: ['k1'] })
export const ACommentOnTwoParagraphs = at({ at: 'D1', sel: ['k1', 'k2'] })
export const AReplyInACommentThread = at({ at: 'D1', reply: threadKey(PLAN.blocks[0].comments[0]) })
export const ADocumentOpenNothingPicked: Story = { ...at({ at: 'D1' }), name: 'A document open, nothing picked' }
export const VoiceCommentsNotSentYet = at({ at: 'D1', text: '> “The export keeps the filter.”\nKeep the sort too.\n\n> “Its file name says which filter.”\nAnd the date.' })
export const EditingAnInput = at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'edit', v: 0 }, text: 'Keep the filter, and the sort.' })
export const AddingDetailsToAnInput = at({ at: 'F012', mode: { kind: 'amend', id: 'r7', mode: 'append', v: 0 } })
export const EditingYourComment = at({ at: 'D1', mode: { kind: 'comment', d: 1, id: 9, was: 'Yes, and its name says which filter.' }, text: 'Yes, and its name says which filter.' })
export const CorrectingAWord = at({ at: 'F012', mode: { kind: 'correct', id: 'r7', wrong: 'sort', v: 0 }, text: 'order' })
export const RecordingForAnotherItem = at({ at: '', rec: true, recordingFor: scopeDraft('F013') })
