// Finding by typing (T591: Menus and sheets > Sheets): the command palette, the project switcher and the sheet of every
// key, the page's own parts with the item list's demo project and the page's own table of actions (paletteRows,
// keyHelp). Words typed and keys pressed in them are typed and pressed, as you would.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { keyHelp, paletteRows } from '../../app/actions'
import { codeOf } from '../../model/project'
import { PROJECT_TONES } from '../../ui/tones'
import { After, Frames, press, typeInto } from '../../stories/Frames'
import { menuModel, no, opened } from '../../stories/menuFixtures'
import { keysSheet, Palette, Switcher } from './Finders'

export default { title: 'Components/Menus and sheets/Sheets' } satisfies Meta
type Story = StoryObj

const COMMANDS = [...paletteRows(true), ...paletteRows(false)]
const ROWS = [
  { slug: 'taska', title: 'taska', tone: PROJECT_TONES[0], needs: 2, here: true },
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], needs: 11, here: false },
  { slug: 'todos', title: 'todos', tone: PROJECT_TONES[2], needs: 0, here: false },
  { slug: 'notes', title: 'Notes', tone: PROJECT_TONES[3], needs: 0, here: false },
]
const field = (root: HTMLElement) => root.querySelector<HTMLInputElement>('[role="dialog"] input')
const palette = (desk: boolean, open: number | null) => {
  const m = menuModel()
  return opened({ title: 'Go to or do', body: <Palette items={m.items} code={(n) => codeOf(m, n)} open={open} commands={COMMANDS} onItem={no} onCommand={no} /> }, desk)
}
const switcher = (desk: boolean) => opened({ title: 'Switch project', body: <Switcher rows={ROWS} loading={false} onOpen={no} /> }, desk)
const one = (draw: (desk: boolean) => ReturnType<typeof opened>, run?: (root: HTMLElement) => void, height = 720, pseudo?: Record<string, string[]>): Story => ({
  ...(pseudo ? { parameters: { pseudo } } : {}),
  render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => (run ? <After run={run}>{draw(layout === 'desk')}</After> : draw(layout === 'desk'))}</Frames>,
})

/** Cmd-K with no item open: the page's commands. */
export const Palette0: Story = { ...one((desk) => palette(desk, null)), name: 'Command palette' }
/** On an item: its commands first. */
export const PaletteOnItem: Story = { ...one((desk) => palette(desk, 1)), name: 'Command palette on an item' }
export const PaletteFinding: Story = { ...one((desk) => palette(desk, null), (r) => typeInto(field(r), 'export')), name: 'Command palette: finding items' }
export const PaletteNothing: Story = { ...one((desk) => palette(desk, null), (r) => typeInto(field(r), 'invoices'), 360), name: 'Command palette: nothing matches' }
/** G P: the projects in your order, the keys' row on the first that is not this one. */
export const Switch: Story = { ...one(switcher, undefined, 420), name: 'Switch project' }
export const SwitchNothing: Story = { ...one(switcher, (r) => typeInto(field(r), 'invoices'), 300), name: 'Switch project: nothing matches' }
/** ?: every key. */
export const Keys: Story = { ...one((desk) => opened(keysSheet(keyHelp()), desk), undefined, 900), name: 'Keyboard shortcuts' }
/** ↓ twice moves the keys' row; the pointer lights another. */
export const PaletteLooks: Story = { ...one((desk) => palette(desk, null), (r) => press(field(r), 'ArrowDown', 2), 720, { hover: ['[role="dialog"] button:nth-of-type(5)'] }), name: 'Command palette: keys on one, pointer on another' }
export const SwitchLooks: Story = { ...one(switcher, (r) => press(field(r), 'ArrowDown'), 420, { hover: ['[role="dialog"] a:nth-of-type(4)'] }), name: 'Switch project: keys on one, pointer on another' }
