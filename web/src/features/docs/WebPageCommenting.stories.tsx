// Commenting on a web page, one story for each state: the
// page's own webFacts and WebPage with a demo page, in the desktop's pane and the phone's sheet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Comment } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { WEB, WEB_PART, comment } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'Components/Document/Commenting/Web pages' } satisfies Meta
type Story = StoryObj

const B = { key: WEB_PART.b, text: 'B: export with the filters as columns' }
const tk = (c: Comment) => `${c.key}#${c.th}`
const [a] = WEB.blocks[0].comments
const one = (h: DocHere, d = WEB, phone = true): Story => ({ render: () => <Frames height={640} deskWidth={900} phoneWidth={393} phone={phone}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })
const saving = { ...WEB, blocks: WEB.blocks.map((b, i) => (i ? b : { ...b, comments: [...b.comments, comment({ id: -1, key: b.key, th: 21, quote: b.text, text: 'And the sort too.', by: 'you' })] })) }

/** The desktop's Comment mode: the part under the pointer is outlined, with its speak and comment buttons. */
export const WebPageCommentMode: Story = { ...one({ inspect: true }, WEB, false), name: 'Comment mode' }
/** A part picked to comment on: its amber ring (the phone's row to speak or type under it). */
export const WebPagePartPicked: Story = { ...one({ quote: B }), name: 'A part picked' }
export const WebPageRecording: Story = { ...one({ spoken: B }), name: 'A part picked, speaking' }
export const WebPageCommentOpen: Story = { ...one({ threads: [tk(a)] }), name: 'A comment open' }
/** Said about a part, still in the box: a count of its own, opening its Not sent card. */
export const WebPageNotSent: Story = { ...one({ notSent: [{ label: '1', key: B.key, words: 'Show it per week.', voice: 1, transcribing: false }], threads: [`${B.key}#new`] }), name: 'A part, said and not sent' }
export const WebPageCommentSaving: Story = { ...one({ threads: [tk(a)] }, saving), name: 'A comment being saved' }
export const WebPageResolved: Story = { ...one({ threads: [tk(a)] }, { ...WEB, resolved: { [tk(a)]: a.t } }), name: 'A thread resolved' }
/** A comment on a part the page no longer has. */
export const WebPageNotOnPage: Story = { ...one({}), name: 'A comment on a part not shown now' }
