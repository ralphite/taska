// Drawing around an area of a document to comment on it (T591: Commenting > Circle to select): the page's own facts
// with Mark an area on, and its Lasso over the paragraphs (draw with the pointer here).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt } from '../../stories/docPage'

export default { title: 'UI/Document pane/Commenting/Circle to select' } satisfies Meta
type Story = StoryObj

/** The phone's Mark an area (the desktop picks with the pointer and has no such mode). */
export const CircleToSelect: Story = { name: 'Circling paragraphs to pick them', render: () => <Frames desk={false} height={760} phoneWidth={393}>{() => docAt(doc(), false, { circle: true })}</Frames> }
