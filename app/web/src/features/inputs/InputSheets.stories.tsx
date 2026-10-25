// A voice note's words as said, and what you said's earlier versions (T591: Menus and sheets > Sheets): the page's
// own sheets, beside the note on the desktop (Original words), a sheet on the phone. Its menu is in
// stories/OtherMenus.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { input, T } from '../../stories/fixtures'
import { AT_BUTTON, opened } from '../../stories/menuFixtures'
import { asSaidSheet, historySheet } from './InputSheets'

export default { title: 'Components/Menus and sheets/Sheets' } satisfies Meta
type Story = StoryObj

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const r = input({
  id: 'r12',
  text: 'The export should keep the filter and the sort I set.',
  history: [
    { text: 'The export should keep it.', t: at(60), mode: 'edit' },
    { text: 'The export should keep the filter I set.', t: at(40), mode: 'append' },
  ],
})

/** Before its words were tidied: as the speech model heard them. */
export const AsSaid: Story = { name: 'Original words', render: () => <Frames height={360} deskWidth={900} phoneWidth={393}>{(layout) => opened(asSaidSheet('', 'Keep the filter, um, in the export, and, uh, the sort.'), layout === 'desk', { look: layout === 'desk' ? { pop: true, at: AT_BUTTON } : {} })}</Frames> }
/** Each version, the latest first, with when and how it changed. */
export const InputHistory: Story = { name: 'What you said: history', render: () => <Frames height={520} deskWidth={900} phoneWidth={393}>{(layout) => opened(historySheet(r, Date.parse(T)), layout === 'desk')}</Frames> }
