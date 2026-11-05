// The helpers TalkFromAgent's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Item, Message } from '../model/types'
import { Frames } from './Frames'
import { T, item } from './fixtures'
import { talkOf, you, type PageOpts } from './itemPage'

type Story = StoryObj

export const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
export const LONG = [
  'Done: the export now writes the rows the list shows.',
  'What was wrong: the export read the whole orders table, then the list filtered it on the screen only.',
  'What I changed:',
  '- The export takes the filter and the sort from the page address, the same ones the list uses.',
  '- The columns come in the order the list shows them, with the same names.',
  '- The file name says the filter: orders-paid-last-30-days.csv.',
  '- Dates use the format chosen in Settings instead of ISO.',
  '- An empty list says "Nothing to export" instead of writing an empty file.',
  'How I checked it:',
  '- Exported with three filters (Paid, Refunded, Last 30 days) and compared each file with the list.',
  '- Sorted by total, largest first, and the CSV kept that order.',
  '- Opened the files in Excel and Numbers; the dates and the totals read correctly.',
  'Not done yet: Export on the phone still does nothing; that is B014.',
  'Ready for you to try on the orders page.',
].join('\n')
export const at = (thread: Message[], o: PageOpts = {}, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', o)}</Frames>,
})
export const after = (x: Message) => [x, you(9, 'Thanks.')].map((m, i) => (i ? { ...m, t: later(5) } : m))

// ---- more states (B636)
export const pdf = { f: 'f5-report.pdf', name: 'report.pdf', mime: 'application/pdf' }
export const voiceNote = { f: 'f6-voice_0-09.webm', name: 'voice_0-09.webm', mime: 'audio/webm' }
