// A voice note's words as said, and what you said's earlier versions (T591: Menus and sheets > Sheets): the page's
// own sheets: Original words on the phone (the desktop shows them under the pointer), the history on both. Its menu is in
// stories/OtherMenus.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { input, T } from '../../stories/fixtures'
import { opened } from '../../stories/menuFixtures'
import { asSaidSheet, historySheet } from './InputSheets'

export default { title: 'Components/Around the page/Menus and sheets/Sheets/An input: its words and history' } satisfies Meta
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

/** Before its words were tidied: as the speech model heard them. Only the phone has this sheet (the desktop shows the
 * words under the pointer, B640). */
const sheetAt = (heard: string, tr: string, height = 360) => () => <Frames height={height} desk={false} phoneWidth={393}>{() => opened(asSaidSheet(heard, tr), false)}</Frames>
export const AsSaid: Story = { name: 'Original words: word for word and tidied', render: sheetAt('Keep the filter, um, in the export, and, uh, the sort. The sort too.', 'Keep the filter and the sort in the export.', 440) }
export const AsSaidNothingTidied: Story = { name: 'Original words: nothing tidied', render: sheetAt('', 'Keep the filter in the export.') }
/** Each version, the latest first, with when and how it changed. */
export const InputHistory: Story = { name: 'What you said: history', render: () => <Frames height={520} deskWidth={900} phoneWidth={393}>{(layout) => opened(historySheet(r, Date.parse(T)), layout === 'desk')}</Frames> }
// ---- more states (T639)
export const AsSaidNoWords: Story = { name: 'Original words: no words heard', render: sheetAt('', '') }
