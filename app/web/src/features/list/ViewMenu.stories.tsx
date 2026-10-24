import type { Meta, StoryObj } from '@storybook/react-vite'
import { SheetFrames } from '../../stories/sheetFixtures'
import { viewMenuSheet } from './ViewMenu'

const meta: Meta = { title: 'Components/List/View menu' }
export default meta
type Story = StoryObj

const no = () => {}

/** A view of yours: rename, the filters shown now, delete. */
export const Menu: Story = { render: () => <SheetFrames height={260} look={{ pop: true }} parts={() => viewMenuSheet('Bugs now', { rename: no, update: no, remove: no })} /> }
