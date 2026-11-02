// The helpers TalkFromAgent's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Item, Message } from '../model/types'
import { Frames } from './Frames'
import { T, item } from './fixtures'
import { talkOf, you, type PageOpts } from './itemPage'

type Story = StoryObj

export const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
export const LONG = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: what the agent did, and why, in a few words.`).join('\n')
export const at = (thread: Message[], o: PageOpts = {}, f: Partial<Item> = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', o)}</Frames>,
})
export const after = (x: Message) => [x, you(9, 'Thanks.')].map((m, i) => (i ? { ...m, t: later(5) } : m))

// ---- more states (B636)
export const pdf = { f: 'f5-report.pdf', name: 'report.pdf', mime: 'application/pdf' }
export const voiceNote = { f: 'f6-voice_0-09.webm', name: 'voice_0-09.webm', mime: 'audio/webm' }
