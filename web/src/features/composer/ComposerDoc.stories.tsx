// The input box while you comment on a document, and after: each state is where you are, what is picked or ticked
// and what the box holds; the box's line,
// placeholder and Send as the page works them out (../../stories/boxFixtures), drawn by its Composer.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { threadKey } from '../../model/docs'
import { Frames } from '../../stories/Frames'
import { PLAN, TICKED, VOICE, boxAt, type Here } from '../../stories/boxFixtures'

export default { title: 'Components/Input box/Commenting on a document' } satisfies Meta
type Story = StoryObj

const at = (h: Here, o: { phone?: boolean; desk?: boolean } = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720} phone={o.phone ?? true} desk={o.desk ?? true}>{(layout) => boxAt(h, layout === 'desk')}</Frames>,
})
const one = { at: 'D1', sel: ['k1'] }

/** Nothing picked: the desktop replies on the document's item; the phone comments on the whole document. */
export const NothingPicked = at({ at: 'D1' })
/** The phone, nothing picked: a comment on the whole document (Reply to its item instead). */
export const WholeDocument = at({ at: 'D1' }, { desk: false })
export const OnePicked = at(one)
export const OnePickedWordsInIt: Story = { ...at({ ...one, text: 'Also keep the sort.' }), name: 'One picked, typing' }
export const SeveralPicked = at({ at: 'D1', sel: ['k1', 'k2'] })
export const WordsPicked = at({ at: 'D1', quote: { key: 'k2', text: 'which filter' } })
export const PickedRecording = at({ ...one, rec: true })
export const PickedTranscribing = at({ ...one, files: [{ ...VOICE, tr: '', transcribing: true }] })
export const PickedVoiceWords: Story = { ...at({ ...one, text: 'Keep the sort too.', files: [{ ...VOICE, tr: 'Keep the sort too.' }] }), name: 'Picked, its voice note’s words in the box' }
export const VoiceCommentsNotSent = at({ at: 'D1', text: '> “The export keeps the filter.”\nKeep the sort too.\n\n> “Its file name says which filter.”\nAnd the date.' })
export const ReplyingInAThread = at({ at: 'D1', reply: threadKey(PLAN.blocks[0].comments[0]) })
export const ChoicesTicked = at({ at: 'D1', ticks: TICKED })
export const ChoicesTickedAndAPick = at({ at: 'D1', ticks: TICKED, sel: ['k1'] })
export const WebPagePartPicked = at({ at: 'D2', quote: { key: 'p1', text: 'Avg. order value' }, text: 'Show it per week.' })
/** Sent (a comment, a voice comment or a reply, on a page or a web page): what was picked is let go, and the box is as
 * with nothing picked; the comment shows on its passage. */
export const Sent: Story = { ...at({ at: 'D1' }), name: 'Sent (a comment, a voice comment, a reply)' }
/** Not sent (Taska said no): its words come back, with what it was on picked again (D83 #3). */
export const NotSent = at({ ...one, text: 'Also keep the sort.' })
