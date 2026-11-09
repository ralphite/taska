// The helpers ItemRow's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { Item } from '../model/types'
import { Frames } from './Frames'
import { facts, item, look, noRowEvents } from './fixtures'
import { ItemRow, type RowFacts, type RowLook } from '../features/list/ListRows'

type Story = StoryObj

export interface Row {
  it?: Partial<Item>
  f?: Partial<RowFacts>
  l?: Partial<RowLook>
  depth?: number
  foldable?: boolean
  folded?: boolean
}

/** A row with what the page holds for it: its fold (a parent's subitems shown or hidden) and, on the desktop, Cmd- or
 * Shift-click picking it; opening it and its quick actions need the rest of the page (the Actions panel). */
function LiveRow({ r, desk }: { r: Row; desk: boolean }) {
  const [folded, setFolded] = useState(r.folded ?? false)
  const [selected, setSelected] = useState(r.l?.selected ?? false)
  const on = {
    ...noRowEvents,
    fold: () => setFolded(!folded),
    open: (n: number, how?: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => (desk && how && (how.metaKey || how.ctrlKey || how.shiftKey) ? setSelected(!selected) : noRowEvents.open(n, how)),
  }
  return <ItemRow it={item({ n: 12, ...r.it })} depth={r.depth ?? 0} band="" foldable={r.foldable ?? false} folded={folded} facts={facts(r.f)} look={look(desk, { ...r.l, selected })} on={on} />
}
export const row = (r: Row, desk: boolean) => <LiveRow r={r} desk={desk} />
export const one = (r: Row): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={460}>{(layout) => row(r, layout === 'desk')}</Frames> })

export const agent = { by: 'claude-code', t: '2026-10-23T14:30:00-07:00' }

// ---- more states (B636): the quick actions under the pointer, by status
export const hover = { parameters: { pseudo: { hover: ['.group'] } } }
// ---- the phone's swipe on a row, drawn mid-swipe by the swipe's own code (B636)
/** `dx` right: mid-swipe forward; left: the ways back left open, as wide as their buttons (as the page leaves them). */
export const swiped = (r: Row, dx: number): Story => ({
  render: () => (
    <Frames desk={false} phoneWidth={393}>
      {() => row({ ...r, l: { ...r.l, swiped: dx } }, false)}
    </Frames>
  ),
})
