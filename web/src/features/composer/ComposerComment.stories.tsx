// The box on a document: nothing picked, a comment on one or two paragraphs, a reply in a thread, voice comments not sent, editing your comment.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { threadKey } from '../../model/docs'
import { PLAN } from '../../stories/boxFixtures'
import { at } from '../../stories/composerFixtures'

export default { title: 'UI/Input box/What it writes to/A comment on a document' } satisfies Meta
type Story = StoryObj

export const ADocumentOpenNothingPicked: Story = { ...at({ at: 'D1' }), name: 'A document open, nothing picked' }
export const ACommentOnAParagraph: Story = { ...at({ at: 'D1', sel: ['k1'] }), name: 'A comment on a paragraph' }
export const ACommentOnTwoParagraphs: Story = { ...at({ at: 'D1', sel: ['k1', 'k2'] }), name: 'A comment on two paragraphs' }
export const AReplyInACommentThread: Story = { ...at({ at: 'D1', reply: threadKey(PLAN.blocks[0].comments[0]) }), name: 'A reply in a comment thread' }
export const VoiceCommentsNotSentYet: Story = { ...at({ at: 'D1', text: '> “The export keeps the filter.”\nKeep the sort too.\n\n> “Its file name says which filter.”\nAnd the date.' }), name: 'Voice comments not sent yet' }
export const EditingYourComment: Story = { ...at({ at: 'D1', mode: { kind: 'comment', d: 1, id: 9, was: 'Yes, and its name says which filter.' }, text: 'Yes, and its name says which filter.' }), name: 'Editing your comment' }
