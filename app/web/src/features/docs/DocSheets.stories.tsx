import type { Meta, StoryObj } from '@storybook/react-vite'
import { doc } from '../../stories/docFixtures'
import { SheetFrames, no } from '../../stories/sheetFixtures'
import { commentMoveSheet } from './DocSheets'

const meta: Meta = { title: 'Components/Menus and sheets/Move and pick' }
export default meta
type Story = StoryObj

/** Where a comment goes: the whole document, or one of its paragraphs (the one it is on now lit). */
export const MoveComment: Story = { name: 'Move a comment', render: () => <SheetFrames height={600} parts={() => commentMoveSheet(doc(), 'p1', no)} /> }
