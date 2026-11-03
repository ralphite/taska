// A message of yours in an item's talk, as the page draws it: the page's own talk (ItemTalk) with that item's data and
// the input your words came from. Used by the stories of your messages, one file for each kind of state.
import type { StoryObj } from '@storybook/react-vite'
import type { Input, Item, Message } from '../model/types'
import { Frames } from './Frames'
import { T, input, item, message } from './fixtures'
import { talkOf, type PageOpts } from './itemPage'

type Story = StoryObj

export const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
export const voice = { f: 'f2-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }
export const shot = { f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }
export const pdf = { f: 'f5-export.pdf', name: 'export.pdf', mime: 'application/pdf' }
export const r4 = (f: Partial<Input> = {}) => input({ id: 'r4', text: 'The export should keep the filter I set.', ...f })
export const mine = (f: Partial<Message> = {}) => message({ id: 1, by: 'you', kind: 'say', text: 'The export should keep the filter I set.', src: 'r4', ...f })
export const at = (thread: Message[], o: PageOpts = {}, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', { inputs: [r4()], ...o })}</Frames>,
})
export const LONG = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of what I said, with some words to fill it.`).join('\n')
/** what you sent, still on its way */
/** What you sent, on its way, in each state the page's outgoingState gives; only one Taska refused is bad (Retry, Edit),
 * as the page has it. */
export const out = (state: 'Sending…' | 'Uploading…' | 'Waiting for Taska…' | 'Not sent', canUndo = false) => ({ t: { outgoing: [{ q: 'q1', text: 'Also keep the sort.', state, bad: state === 'Not sent', canUndo }] } })
export { message, T }
