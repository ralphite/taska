// Your comment: pointing at it, its menu on the phone, edited, taking a file off, not sent yet, being written out.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { docAt } from '../../stories/docPage'
import { no, opened } from '../../stories/menuFixtures'
import { PLAN, edited, one, withFiles } from '../../stories/threadFixtures'
import { commentMenuSheet } from './DocSheets'

export default { title: 'Components/Document/Comment threads/Your comments' } satisfies Meta
type Story = StoryObj

/** The desktop: the pointer on your comment shows Edit, Move and Delete (an agent's: Move and Delete). */
export const PointingAtYourComment: Story = { ...one({ threads: ['p1#1'] }), name: 'Pointing at your comment: Edit, Move, Delete', parameters: { pseudo: { hover: ['[data-thread] .group:first-of-type'] } } }
export const EditedComment: Story = { ...one({ threads: ['p1#1'] }, edited), name: 'Edited comment' }
/** The phone: a comment's ⋯ opens its menu (Edit on yours, Move, Delete). */
export const ItsMenuOnThePhone: Story = {
  name: 'Its menu on the phone',
  render: () => <Frames desk={false} height={760} phoneWidth={393}>{() => opened(commentMenuSheet(true, { edit: no, move: no, remove: no }), false, { under: docAt(PLAN, false, { threads: ['p1#1'] }) })}</Frames>,
}
/** the × on its picture pressed once: Take off? over the picture, pressed again to take it off (the desktop's × shows
 * under the pointer; the phone's always) */
export const TakingAFileOff: Story = { ...one({ threads: ['p1#1'], asked: { 'unfile 12 7 f9-filter.png': 1 } }, withFiles), name: 'Taking a file off', parameters: { pseudo: { hover: ['[data-thread] .group:has([title^="Take off"])'] } } }
/** Said about a paragraph, still in the box: a count of its own, opening its Not sent card. */
export const NotSentYet: Story = { ...one({ notSent: [{ label: '1', key: 'p1', words: 'Pilot first, then the rest.', voice: 1, transcribing: false }], threads: ['p1#new'] }), name: 'Not sent yet' }
export const NotSentYetTranscribing: Story = { ...one({ notSent: [{ label: '1', key: 'p1', words: '', voice: 1, transcribing: true }], threads: ['p1#new'] }), name: 'Not sent yet, transcribing' }
// ---- more states (T639)
/** the pointer on an agent's comment: only Move and Delete (no Edit, no file to take off) */
export const PointingAtAnAgentsComment: Story = { ...one({ threads: ['p1#1'] }), name: "Pointing at an agent's comment: Move, Delete", parameters: { pseudo: { hover: ['[data-thread] .group:nth-of-type(2)'] } } }
