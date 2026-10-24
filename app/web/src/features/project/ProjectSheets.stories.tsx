import type { Meta, StoryObj } from '@storybook/react-vite'
import { SheetFrames, no } from '../../stories/sheetFixtures'
import { PROJECT_TONES } from '../../ui/tones'
import { itemMoveProjectSheet, moveInputSheet, projectMenuSheet } from './ProjectSheets'

const meta: Meta = { title: 'Components/Sheets/Projects' }
export default meta
type Story = StoryObj

const others = [
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13 },
  { slug: 'todos', title: 'todos', tone: PROJECT_TONES[2], open: 8 },
]

/** Moving an item, moving an input (what goes with it), and a project's menu. */
export const Sheets: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <SheetFrames height={420} parts={() => itemMoveProjectSheet({ code: 'F012', others }, no)} />
      <SheetFrames height={520} parts={() => moveInputSheet({ code: '#12', words: 'The export should keep the filter I set.', others, made: ['F012 Export keeps the filter'], byOrganizer: true, scope: 'F004' }, no)} />
      <SheetFrames height={320} look={{ pop: true }} parts={() => projectMenuSheet({ here: false, slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13 }, { open: no, settings: no, manage: no })} />
    </div>
  ),
}
