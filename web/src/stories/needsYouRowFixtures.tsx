// The helpers NeedsYouRow's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Item } from '../model/types'
import { Frames } from './Frames'
import { facts, item, look, noRowEvents } from './fixtures'
import { NeedsRow, type RowFacts, type RowLook } from '../features/list/ListRows'

type Story = StoryObj

export interface Row {
  it: Partial<Item>
  excerpt?: string
  f?: Partial<RowFacts>
  l?: Partial<RowLook>
}

export const ask = (text: string, by = 'claude-code'): Partial<Item> => ({ wait: { id: 4, kind: 'ask', text, by, files: [] } })
export const row = (r: Row, desk: boolean) => <NeedsRow it={item({ n: 12, ...r.it })} depth={0} facts={facts(r.f)} look={look(desk, r.l)} excerpt={r.excerpt ?? ''} on={noRowEvents} />
export const one = (r: Row): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={460}>{(layout) => row(r, layout === 'desk')}</Frames> })
export const question: Row = { it: ask('Keep the old export for a while?'), excerpt: 'Keep the old export for a while?' }
