// A message of yours in an item's talk, as the page draws it: the page's own talk (ItemTalk) with that item's data and
// the input your words came from. Used by the stories of your messages, one file for each kind of state.
import type { StoryObj } from '@storybook/react-vite'
import type { Input, Item, Message } from '../model/types'
import { Frames } from './Frames'
import { T, input, item, message } from './fixtures'
import { talkOf, type PageOpts } from './itemPage'
import { phaseIn, type OutPhase } from '../model/outgoingStates'

type Story = StoryObj

export const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
/** a sent voice note, as Taska has it: its words tidied, and word for word as heard */
export const voice = {
  f: 'f2-voice_0-12.webm',
  name: 'voice_0-12.webm',
  mime: 'audio/webm',
  tr: 'The export should keep the filter I set.',
  heard: 'So the export, um, it should keep the, the filter I set.',
}
export const shot = { f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }
export const pdf = { f: 'f5-export.pdf', name: 'export.pdf', mime: 'application/pdf' }
export const r4 = (f: Partial<Input> = {}) => input({ id: 'r4', text: 'The export should keep the filter I set.', ...f })
export const mine = (f: Partial<Message> = {}) => message({ id: 1, by: 'you', kind: 'say', text: 'The export should keep the filter I set.', src: 'r4', ...f })
export const at = (thread: Message[], o: PageOpts = {}, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', { inputs: [r4()], ...o })}</Frames>,
})
export const LONG = [
  'The export is still wrong on the orders page.',
  'I filtered the list to Paid and Last 30 days, then pressed Export.',
  'The CSV had every order since March, about four thousand rows.',
  'The columns were also in a different order from the list on the screen.',
  'Finance opens this file in Excel every Monday, so they noticed straight away.',
  'What I expect: the file has exactly the rows the list shows, in the same order.',
  'The columns should be the ones I see, left to right, with the same names.',
  'The file name should say the filter, like orders-paid-last-30-days.csv.',
  'Dates in the file should use the format chosen in Settings, not ISO.',
  'On the phone, Export does nothing at all; it should work there too.',
  'If the list is empty, say so instead of writing an empty file.',
  'Please check the sort as well; it went back to newest first last time.',
  'Steps to see it again:',
  '1. Open the orders page.',
  '2. Pick Paid in the status filter.',
  '3. Pick Last 30 days in the date filter.',
  '4. Sort by total, largest first.',
  '5. Press Export and open the file.',
  'What I saw: every order since March, newest first, the columns as in the database.',
  'It worked last week, before the new filters came in.',
  'The same happens with Refunded instead of Paid.',
  'Screenshots of the list and the file are in the thread above.',
].join('\n')
/** what you sent, still on its way */
/** What you sent, on its way, in each of its phases (named by their words), as the talk shows it (model/outgoingStates:
 * Retry only when Taska said no, Edit while it is not going out); × cancels any of them. */
const PHASE = { 'Sending…': 'sending', 'Uploading…': 'uploading', 'Waiting for Taska…': 'waiting', 'Not sent': 'notSent' } as const satisfies Record<string, OutPhase>
export const out = (state: keyof typeof PHASE, previews: string[] = []) => ({ t: { outgoing: [{ q: 'q1', text: 'Also keep the sort.', show: talkShow(PHASE[state]), previews }] } })
/** what the talk shows in a phase */
export const talkShow = (p: OutPhase) => phaseIn(p, 'talk') ?? { say: '', tone: 'busy' as const, acts: [] }
export { message, T }
