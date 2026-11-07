// Commenting on a document, one story for each state: the
// page's own facts (factsOf) and DocView, whose buttons beside each paragraph BlockActs draws, with a demo document.
// A web page's are in WebPageCommenting.stories, words selected in stories/SelectedWords.stories, drawing around an area in
// Lasso.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Doc } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'UI/Document pane/Commenting/Paragraphs' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const one = (h: DocHere, d: Doc = PLAN): Story => ({ render: () => <Frames height={760} deskWidth={900} phoneWidth={393}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })

/** A paragraph picked: its amber ring and its Voice and Comment beside it (on the phone a row under it; Document › On the phone). */
export const ParagraphPicked: Story = { ...one({ sel: ['p1'] }), name: 'Paragraph picked' }
/** Reply pressed in a thread: what you write goes to it (the box says so). */
export const Replying: Story = { ...one({ threads: ['p1#1'], reply: 'p1#1' }), name: 'Replying in a thread' }
/** Resolved, the thread folds into ✓ 1 beside its paragraph (D115 #40). */
export const ResolvedThread: Story = { ...one({}, { ...PLAN, resolved: { 'p1#1': PLAN.t1 } }), name: 'Thread resolved' }
/** ✓ 1 pressed: the resolved thread open again, its rule grey (the phone's; the desktop's is a card beside it). */
/** resolved after its reply, opened again: when, quietly, left of Reopen (R6-3 #4) */
export const ResolvedThreadOpened: Story = { ...one({ threads: ['p1#1'] }, { ...PLAN, resolved: { 'p1#1': '2026-10-23T14:25:00-07:00' } }), name: 'Thread resolved, opened again' }
// ---- more states (B636)
export const SpeakingAboutAParagraph: Story = { ...one({ speaking: { key: 'p1', bar: false } }), name: 'Speaking about a paragraph' }
export const AnItemOfAListPicked: Story = { ...one({ quote: { key: 'l1', text: 'Write the goals' } }), name: 'An item of a list picked' }
