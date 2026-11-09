// Words selected in a document (T591: Commenting > Words selected, Bar over selected words): the page's own document
// with the browser's selection on some of its words, and the page's bar over them (SelectionBar), which the document
// draws where they are as the page does (B708 r1149). Select other words in it and the bar follows them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { doc } from './docFixtures'
import { docAt } from './docPage'

export default { title: 'UI/Document pane/Commenting/Selected words' } satisfies Meta
type Story = StoryObj

/** The document with "written from scratch" selected; `recording`: its bar's mic pressed once. */
const Selected = ({ desk, recording }: { desk: boolean; recording: boolean }) => docAt(doc(), desk, { selected: { key: 'p1', words: 'written from scratch', recording } })

/** Words selected in a paragraph: they stay only selected, and the bar over them offers to speak or comment. */
export const WordsSelected: Story = { name: 'Words selected', render: () => <Frames phone={false} height={560} deskWidth={900}>{() => <Selected desk recording={false} />}</Frames> }
/** On the phone: the same bar over them, in the document's sheet. */
export const WordsSelectedPhone: Story = { name: 'Words selected, on the phone', render: () => <Frames desk={false} phoneWidth={393}>{() => <Selected desk={false} recording={false} />}</Frames> }
/** The bar's mic pressed: it records a comment about them, the same button is ✓. */
export const SelectionBarRecording: Story = { name: 'Bar over selected words', render: () => <Frames phone={false} height={560} deskWidth={900}>{() => <Selected desk recording />}</Frames> }
