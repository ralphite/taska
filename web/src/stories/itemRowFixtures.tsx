// The helpers ItemRow's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { Item } from '../model/types'
import { After, Frames } from './Frames'
import { facts, item, look, noRowEvents } from './fixtures'
import { ItemRow, type RowFacts, type RowLook } from '../features/list/ListRows'
import { showSwiped } from '../features/list/rowSwipe'

type Story = StoryObj

export interface Row {
  it?: Partial<Item>
  f?: Partial<RowFacts>
  l?: Partial<RowLook>
  depth?: number
  foldable?: boolean
  folded?: boolean
}

export const row = (r: Row, desk: boolean) => (
  <ItemRow
    it={item({ n: 12, ...r.it })}
    depth={r.depth ?? 0}
    band=""
    foldable={r.foldable ?? false}
    folded={r.folded ?? false}
    facts={facts(r.f)}
    look={look(desk, r.l)}
    on={noRowEvents}
  />
)
export const one = (r: Row): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={460}>{(layout) => row(r, layout === 'desk')}</Frames> })

export const agent = { by: 'claude-code', t: '2026-10-23T14:30:00-07:00' }

// ---- more states (B636): the quick actions under the pointer, by status
export const hover = { parameters: { pseudo: { hover: ['.group'] } } }
// ---- the phone's swipe on a row, drawn mid-swipe by the swipe's own code (B636)
/** `dx` right: mid-swipe forward; left: the ways back left open, as wide as their buttons (as the page leaves them). */
const swipe = (el: HTMLElement, dx: number) => {
  if (dx >= 0) return showSwiped(el, dx)
  showSwiped(el, -1)
  showSwiped(el, -(el.parentElement?.querySelector<HTMLElement>('[data-swipe-right]')?.offsetWidth || -dx))
}
export const swiped = (r: Row, dx: number): Story => ({
  render: () => (
    <Frames desk={false} phoneWidth={393}>
      {() => <After run={(root) => root.querySelectorAll<HTMLElement>('[data-swipe]').forEach((el) => swipe(el, dx))}>{row(r, false)}</After>}
    </Frames>
  ),
})
