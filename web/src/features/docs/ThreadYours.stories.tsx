// Your comment: pointing at it, edited, taking a file off, not sent yet, being written out.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { edited, one, withFiles } from '../../stories/threadFixtures'

export default { title: 'Components/Document/Comment threads/Your comments' } satisfies Meta
type Story = StoryObj

/** The desktop: the pointer on your comment shows Edit, Move and Delete (an agent's: Move and Delete). */
export const PointingAtYourComment: Story = { ...one({ threads: ['p1#1'] }), name: 'Pointing at your comment: Edit, Move, Delete', parameters: { pseudo: { hover: ['[data-thread] .group:first-of-type'] } } }
export const EditedComment: Story = { ...one({ threads: ['p1#1'] }, edited), name: 'Edited comment' }
/** its File pressed once: Take it off? (on the desktop under the pointer, where its buttons show) */
export const TakingAFileOff: Story = { ...one({ threads: ['p1#1'], asked: { 'unfile 12 7 f9-filter.png': 1 } }, withFiles), name: 'Taking a file off', parameters: { pseudo: { hover: ['[data-thread] .group:has([title^="Take off"])'] } } }
/** Said about a paragraph, still in the box: a count of its own, opening its Not sent card. */
export const NotSentYet: Story = { ...one({ notSent: [{ label: '1', key: 'p1', words: 'Pilot first, then the rest.', voice: 1, transcribing: false }], threads: ['p1#new'] }), name: 'Not sent yet' }
export const NotSentYetTranscribing: Story = { ...one({ notSent: [{ label: '1', key: 'p1', words: '', voice: 1, transcribing: true }], threads: ['p1#new'] }), name: 'Not sent yet, transcribing' }
// ---- more states (T639)
/** the pointer on an agent's comment: only Move and Delete (no Edit, no file to take off) */
export const PointingAtAnAgentsComment: Story = { ...one({ threads: ['p1#1'] }), name: "Pointing at an agent's comment: Move, Delete", parameters: { pseudo: { hover: ['[data-thread] .group:nth-of-type(2)'] } } }
