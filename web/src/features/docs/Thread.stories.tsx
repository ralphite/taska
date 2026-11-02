// A comment thread opened from its count, answered by an agent, resolved and opened again, its text changed, two on one paragraph, the whole document's, with a picture and a voice note.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames } from '../../stories/Frames'
import { docAt } from '../../stories/docPage'
import { PLAN, at, one, toEnd, twoThreads, wholeDoc, withFiles } from '../../stories/threadFixtures'

export default { title: 'Components/Document/Comment threads/Reading a thread' } satisfies Meta
type Story = StoryObj

/** Its count pressed: its comments, the words it quotes, Resolve and Reply. */
export const ThreadOpened: Story = { ...one({ threads: ['p1#1'] }), name: 'Opened from its count' }
/** An agent answered since you last looked: its count and thread marked new. */
export const NewReply: Story = { ...one({ threads: ['p1#1'], seen: { since: at(30) } }), name: 'Answered by an agent' }
/** Resolved, its count quieter; opened again it says Reopen. */
export const ResolvedOpened: Story = { ...one({ threads: ['t1#4'] }), name: 'Resolved, opened again' }
export const TextChanged: Story = { name: 'Its text changed', render: () => <Frames height={760} deskWidth={900} phoneWidth={393}>{(layout) => <After run={toEnd}>{docAt(PLAN, layout === 'desk')}</After>}</Frames> }
export const TwoThreadsOnOneParagraph: Story = { ...one({}, twoThreads), name: 'Two threads on one paragraph' }
export const WholeDocumentCommentsOpened: Story = { ...one({ threads: ['doc'] }, wholeDoc), name: 'Whole-document comments opened' }
export const CommentWithFiles: Story = { ...one({ threads: ['p1#1'] }, withFiles), name: 'With a picture and a voice note' }
