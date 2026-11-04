// The helpers NeedsYouRow's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
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
/** A row that, on the desktop, Cmd- or Shift-click picks as the page does; the rest needs the page (the Actions panel). */
function LiveRow({ r, desk }: { r: Row; desk: boolean }) {
  const [selected, setSelected] = useState(r.l?.selected ?? false)
  const open = (n: number, how?: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => (desk && how && (how.metaKey || how.ctrlKey || how.shiftKey) ? setSelected(!selected) : noRowEvents.open(n, how))
  return <NeedsRow it={item({ n: 12, ...r.it })} depth={0} facts={facts(r.f)} look={look(desk, { ...r.l, selected })} excerpt={r.excerpt ?? ''} on={{ ...noRowEvents, open }} />
}
export const row = (r: Row, desk: boolean) => <LiveRow r={r} desk={desk} />
export const one = (r: Row): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={460}>{(layout) => row(r, layout === 'desk')}</Frames> })
export const question: Row = { it: ask('Keep the old export for a while?'), excerpt: 'Keep the old export for a while?' }
