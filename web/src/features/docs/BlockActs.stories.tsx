// Commenting on a document, one story for each state: the
// page's own facts (factsOf) and DocView, whose buttons beside each paragraph BlockActs draws, with a demo document.
// A web page's are in WebPageCommenting.stories, words selected in stories/SelectedWords.stories, drawing around an area in
// Lasso.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Doc } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'Components/Document/Commenting/Paragraphs' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const one = (h: DocHere, d: Doc = PLAN): Story => ({ render: () => <Frames height={760} deskWidth={900} phoneWidth={393}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })

/** A paragraph picked: its amber ring; on the phone the row to speak or type a comment under it. */
export const ParagraphPicked: Story = { ...one({ sel: ['p1'] }), name: 'Paragraph picked' }
/** Reply pressed in a thread: what you write goes to it (the box says so). */
export const Replying: Story = { ...one({ threads: ['p1#1'], reply: 'p1#1' }), name: 'Replying in a thread' }
export const ResolvedThread: Story = { ...one({ threads: ['p1#1'] }, { ...PLAN, resolved: { 'p1#1': PLAN.t1 } }), name: 'Thread resolved' }
// ---- more states (B636)
export const ParagraphPickedSpeaking: Story = { ...one({ sel: ['p1'], speaking: { key: 'p1', bar: false } }), name: 'Paragraph picked, speaking' }
export const SpeakingAboutAParagraph: Story = { ...one({ speaking: { key: 'p1', bar: false } }), name: 'Speaking about a paragraph' }
export const AnItemOfAListPicked: Story = { ...one({ quote: { key: 'l1', text: 'Build the pilot' } }), name: 'An item of a list picked' }
