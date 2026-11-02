// The helpers TalkQuestion's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Item, Message } from '../model/types'
import { Frames } from './Frames'
import { T, item, message } from './fixtures'
import { doc } from './itemFixtures'
import { talkOf, you, type PageOpts } from './itemPage'

type Story = StoryObj

export const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
export const ASK = 'Which format should the export use?\n- ( ) CSV\n- ( ) Excel'
export const CHECKS = 'Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'
export const ask = (text = ASK, id = 4) => message({ id, kind: 'ask', text })
export const waits = (text = ASK, id = 4): Partial<Item> => ({ wait: { id, kind: 'ask', text, by: 'claude-code', files: [] } })
export const said = (text: string, id = 5) => ({ ...you(id, text), t: later(2) })
export const at = (thread: Message[], f: Partial<Item> = {}, o: PageOpts = {}): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', o)}</Frames>,
})
export const answered = [ask(), said('✓ CSV')]

// ---- more states (B636)
export const FORM = doc({ d: 14, n: 12, title: 'Export formats', md: '- [ ] CSV\n- [ ] Excel', blocks: [{ key: 'c1', kind: 'list', text: '- [ ] CSV\n- [ ] Excel', comments: [] }] })
