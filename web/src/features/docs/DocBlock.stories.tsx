// Choices in a document, one story for each state: the
// page's own facts (factsOf, with what you ticked) and DocView, whose paragraphs DocBlock draws, in the desktop's pane
// and the phone's sheet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { blockKeys } from '../../model/docs'
import type { Doc } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { CHOICES, CHOICES_SENT, doc } from '../../stories/docFixtures'
import { message } from '../../stories/fixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'UI/Document pane/Choices' } satisfies Meta
type Story = StoryObj

const [, , formats] = blockKeys(CHOICES)
const one = (d: Doc, h: DocHere = {}): Story => ({ render: () => <Frames height={620} deskWidth={900} phoneWidth={393}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })

export const Checklist: Story = { ...one(CHOICES), name: 'Nothing ticked' }
/** Ticked here and not sent: how many wait, over the text; the phone sends them with that line's Send choices (it has
 * no box over a document, B643), the desktop with the box's line. */
export const TickedNotSent: Story = { ...one(CHOICES, { ticks: { mine: { 14: { [formats]: '- [x] CSV\n- [ ] Excel\n- [x] JSON' } } } }), name: 'Ticked, not sent yet' }
/** Sent and not changed since: quieter, with Submitted (Modify shows under the pointer on the desktop). */
export const Sent: Story = { ...one(CHOICES_SENT), name: 'Sent' }
export const SentPointedAt: Story = { ...one(CHOICES_SENT), name: 'Sent, pointed at: Modify', parameters: { pseudo: { hover: ['section[data-key="l1"] .group\\/form'] } } }
/** Modify pressed: the choices can be ticked again. */
export const SentChanging: Story = { ...one(CHOICES_SENT, { ticks: { open: new Set([`14 ${formats}`]) } }), name: 'Sent, being changed' }
/** The item's question pointed here, and you replied on the item instead of ticking. */
export const Skipped: Story = {
  ...one(CHOICES, { item: { thread: [message({ id: 31, kind: 'ask', text: 'Pick the formats in D14.' }), message({ id: 32, by: 'you', kind: 'say', text: 'CSV is enough for now.' })] } }),
  name: 'Skipped: replied on the item instead',
}
// ---- more states (T639)
const MIXED = doc({ d: 14, title: 'Export formats', blocks: [{ key: 'title', kind: 'heading', text: '# Export formats', comments: [] }, { key: 'm1', kind: 'list', text: 'Which should it offer?\n- [ ] CSV\n- [ ] Excel\n\nAnd when?\n- ( ) This week\n- ( ) Next week', comments: [] }], detached: [], whole: [], resolved: {} })
/** words and choices in one paragraph: the words, then each run of choices as a form */
export const WordsAndChoices: Story = { ...one(MIXED), name: 'Words and choices in one paragraph' }
