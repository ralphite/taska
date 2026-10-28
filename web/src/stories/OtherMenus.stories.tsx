// The other menus (T591: Menus and sheets > Other menus): a message's, what you said's (from inputMenuFacts), and a
// project's in the sidebar (this one, another), the page's own parts as the page opens them: at the button or the
// pointer on the desktop, a sheet on the phone. Your views' menu is in ViewMenu.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { inputMenuSheet } from '../features/inputs/InputSheets'
import { inputMenuFacts } from '../features/inputs/inputSheetFacts'
import { messageMenuSheet } from '../features/item/ItemSheets'
import { projectMenuSheet } from '../ui/ProjectSheets'
import { PROJECT_TONES } from '../ui/tones'
import { Frames } from './Frames'
import { input, item, modelOf } from './fixtures'
import { AT_BUTTON, AT_POINTER, no, opened } from './menuFixtures'

export default { title: 'Components/Menus and sheets/Other menus' } satisfies Meta
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
const m = modelOf([item({ n: 4, title: 'Exports that keep what you see' }), item({ n: 12, title: 'Export keeps the filter' })], [said])
const home = { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13 }

/** A message's ⋯: hide it from the talk. */
export const MessageMenu: Story = { ...both((desk) => opened(messageMenuSheet(no), desk, { look: desk ? { pop: true, at: AT_BUTTON } : {} }), 320), name: 'Message' }
/** What you said's ⋯: Edit, Add details, Original words, Undo what the organizer did, Move, History, Put with another
 * item, a file's Take off, Delete (and what goes with it). */
export const InputMenu: Story = {
  ...both((desk) => opened(inputMenuSheet(inputMenuFacts(m, said, 2, {}), { edit: no, append: no, asSaid: no, undo: no, move: no, history: no, rescope: no, takeOff: no, remove: no }), desk, { look: desk ? { pop: true, at: AT_BUTTON } : {} }), 720),
  name: 'What you said',
}
/** The sidebar's right-click on the project you are in. */
export const ProjectMenuHere: Story = { ...both((desk) => opened(projectMenuSheet({ here: true, slug: 'taska', title: 'taska', tone: PROJECT_TONES[0], open: 24 }, { open: no, settings: no, manage: no }), desk, { look: desk ? { pop: true, at: AT_POINTER(40, 120) } : {} }), 360), name: 'This project' }
export const ProjectMenuOther: Story = { ...both((desk) => opened(projectMenuSheet({ here: false, ...home }, { open: no, settings: no, manage: no }), desk, { look: desk ? { pop: true, at: AT_POINTER(40, 160) } : {} }), 360), name: 'Another project' }
