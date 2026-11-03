// After sending: sent, not sent, voice comments not sent, and a document whose item is gone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, one } from '../../stories/composerDocFixtures'

export default { title: 'Components/Input box/Commenting on a document/Sent and not sent' } satisfies Meta
type Story = StoryObj

/** Sent (a comment, a voice comment or a reply, on a page or a web page): what was picked is let go, and the box is as
 * with nothing picked; the comment shows on its passage. */
export const Sent: Story = { ...at({ at: 'D1' }), name: 'Sent (a comment, a voice comment, a reply)' }
/** Not sent (Taska said no): its words come back, with what it was on picked again (D83 #3). */
export const NotSent = at({ ...one, text: 'Also keep the sort.' })
export const VoiceCommentsNotSent = at({ at: 'D1', text: '> “The export keeps the filter.”\nKeep the sort too.\n\n> “Its file name says which filter.”\nAnd the date.' })
// ---- more states (B636)
export const OneVoiceCommentNotSent = at({ at: 'D1', text: '> “The export keeps the filter.”\nKeep the sort too.' })
