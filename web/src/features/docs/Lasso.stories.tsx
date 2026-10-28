// Drawing around an area of a document to comment on it (T591: Commenting > Circle to select): the page's own facts
// with Mark an area on, and its Lasso over the paragraphs (draw with the pointer here).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt } from '../../stories/docPage'

export default { title: 'Components/Document/Commenting' } satisfies Meta
type Story = StoryObj

export const CircleToSelect: Story = { name: 'Circle to select', render: () => <Frames height={760} deskWidth={900} phoneWidth={393}>{(layout) => docAt(doc(), layout === 'desk', { circle: true })}</Frames> }
