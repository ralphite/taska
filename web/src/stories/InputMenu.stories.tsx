// What you said's menu (its ⋯), from the page's own inputMenuFacts, as the page opens it: at the button on the desktop,
// a sheet on the phone. The desktop has no Original words: pointing at a voice note shows them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { inputMenuSheet } from '../features/inputs/InputSheets'
import { inputMenuFacts } from '../features/inputs/inputSheetFacts'
import { Frames } from './Frames'
import { input, item, modelOf } from './fixtures'
import { AT_BUTTON, acts, opened } from './menuFixtures'

export default { title: 'Components/Around the page/Menus and sheets/What you said: its menu' } satisfies Meta
type Story = StoryObj

const both = (draw: (desk: boolean) => ReturnType<typeof opened>, height = 480): Story => ({ render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => draw(layout === 'desk')}</Frames> })
const VOICE = { f: 'f2-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }
const SHOT = { f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }
const said = input({
  id: 'r12',
  scope: 4,
  acked: true,
  touched: [12],
  text: 'The export should keep the filter I set.',
  files: [VOICE, SHOT],
  org: { ok: true, msg: 'Created F012', t: '', keep: false, changed: true, undone: false },
  filing: { can: true, what: 'created F012', why: '' },
  history: [{ text: 'The export should keep it.', t: '2026-10-23T14:00:00-07:00', mode: 'edit' }],
  deletion: { go: [12], keep: [] },
})
const on = acts('Input menu', ['send', 'edit', 'append', 'asSaid', 'undo', 'move', 'history', 'rescope', 'takeOff', 'remove'], {
  asSaid: 'Sheets › An input: Original words',
  move: 'Move and pick › What you said, to another project',
  history: 'Sheets › An input: history',
  rescope: 'Move and pick › What you said, with another item',
  takeOff: "What you said: its menu › A file's Take it off? asking",
})
const m = modelOf([item({ n: 4, title: 'Exports that keep what you see' }), item({ n: 12, title: 'Export keeps the filter' })], [said])
/** What you said's ⋯: Edit, Add details, Original words, Undo what the organizer did, Move, History, Put with another
 * item, a file's Take off, Delete (and what goes with it). Rows that open a next step:
 * [Original words](?path=/story/components-around-the-page-menus-and-sheets-sheets-an-input-its-words-and-history--as-said),
 * [Move to…](?path=/story/components-around-the-page-menus-and-sheets-move-and-pick--move-input),
 * [History](?path=/story/components-around-the-page-menus-and-sheets-sheets-an-input-its-words-and-history--input-history),
 * [Put with item…](?path=/story/components-around-the-page-menus-and-sheets-move-and-pick--pick-an-item),
 * [Take off a file](?path=/story/components-around-the-page-menus-and-sheets-what-you-said-its-menu--input-menu-take-off-asks). */
export const InputMenu: Story = {
  ...both((desk) => opened(inputMenuSheet(inputMenuFacts(m, said, 2, {}, desk, true), on), desk, { look: desk ? { pop: true, at: AT_BUTTON } : {} }), 720),
  name: 'Edit, Original words, Undo, Move, History, Delete',
}
const plain = input({ id: 'r13', acked: true, text: 'Look at why the build takes so long.' })
const inputMenu = (r: typeof said, other: number, asked: Record<string, number> = {}, tidy = true) => (desk: boolean) =>
  opened(inputMenuSheet(inputMenuFacts(modelOf([item({ n: 4 }), item({ n: 12 })], [r]), r, other, asked, desk, tidy), on), desk, { look: desk ? { pop: true, at: AT_BUTTON } : {} })
/** a plain typed input with no other project: no Original words, Undo, History, files or Move */
export const InputMenuPlain: Story = { ...both(inputMenu(plain, 0), 420), name: 'Typed, nothing filed, no other project' }
/** a file's Take off asking again */
export const InputMenuTakeOffAsks: Story = { ...both(inputMenu(said, 2, { [`unfile ${said.id} ${SHOT.f}`]: 1 }), 720), name: "A file's Take it off? asking" }
/** a recording cancelled with Esc (B627): Send first; it goes with no item until it is sent */
export const InputMenuCancelled: Story = { ...both(inputMenu(input({ id: 'r24', kind: 'cancelled', text: 'Maybe the export should keep the columns too.', files: [VOICE] }), 2), 560), name: 'A cancelled recording: Send' }
/** voice notes not tidied (Settings): the phone's menu has no Original words either */
export const InputMenuTidyOff: Story = { ...both(inputMenu(said, 2, {}, false), 720), name: 'Voice notes not tidied' }
