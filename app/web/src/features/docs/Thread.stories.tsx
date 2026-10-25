// A document's comment threads, one story for each state (T591: the groups and names Yadong had before the rewrite):
// the page's own facts (factsOf) and DocView, whose threads Thread draws (over the text on the desktop, under the
// paragraph on the phone), with a demo document.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Doc } from '../../model/types'
import { After, Frames } from '../../stories/Frames'
import { comment, doc } from '../../stories/docFixtures'
import { T } from '../../stories/fixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'Components/Document/Comment threads' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const one = (h: DocHere, d: Doc = PLAN, height = 760): Story => ({ render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })
const VOICE = { f: 'f8-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm' }
const SHOT = { f: 'f9-filter.png', name: 'filter.png', mime: 'image/png' }
const withFiles = doc({ blocks: PLAN.blocks.map((b) => (b.key === 'p1' ? { ...b, comments: [...b.comments, comment({ id: 7, key: 'p1', th: 1, quote: 'stays in use', text: 'Like this, with the filter kept.', by: 'you', t: at(5), files: [SHOT, VOICE] })] } : b)) })

/** Its count pressed: its comments, the words it quotes, Resolve and Reply. */
export const ThreadOpened: Story = { ...one({ threads: ['p1#1'] }), name: 'Opened from its count' }
/** An agent answered since you last looked: its count and thread marked new. */
export const NewReply: Story = { ...one({ threads: ['p1#1'], seen: { since: at(30) } }), name: 'Answered by an agent' }
/** The desktop: the pointer on your comment shows Edit, Move and Delete (an agent's: Move and Delete). */
export const PointingAtYourComment: Story = { ...one({ threads: ['p1#1'] }), name: 'Pointing at your comment: Edit, Move, Delete', parameters: { pseudo: { hover: ['[data-thread] .group:first-of-type'] } } }
export const CommentWithFiles: Story = { ...one({ threads: ['p1#1'] }, withFiles), name: 'With a picture and a voice note' }
/** Resolved, its count quieter; opened again it says Reopen. */
export const ResolvedOpened: Story = { ...one({ threads: ['t1#4'] }), name: 'Resolved, opened again' }
/** The words it was on were changed since: under Original text changed, the old words struck through (the phone's
 * sheet scrolled to its end, where they are). */
const toEnd = (root: HTMLElement) => {
  for (const el of root.querySelectorAll<HTMLElement>('*')) if (el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight
}
export const TextChanged: Story = { name: 'Its text changed', render: () => <Frames height={760} deskWidth={900} phoneWidth={393}>{(layout) => <After run={toEnd}>{docAt(PLAN, layout === 'desk')}</After>}</Frames> }
/** Said about a paragraph, still in the box: a count of its own, opening its Not sent card. */
export const NotSentYet: Story = { ...one({ notSent: [{ label: '1', key: 'p1', words: 'Pilot first, then the rest.', voice: 1, transcribing: false }], threads: ['p1#new'] }), name: 'Not sent yet' }
