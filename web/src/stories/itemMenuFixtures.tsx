// The helpers ItemMenu's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { AT_BUTTON, AT_BUTTON_NARROW, menuModel, no, opened, underList } from './menuFixtures'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents, type ItemMenuFacts } from '../features/item/ItemMenu'
import { itemMenuFacts } from '../features/item/itemMenuFacts'

type Story = StoryObj

export const on: ItemMenuEvents = { edit: no, copy: no, agent: no, newDoc: no, addSub: no, reparent: no, later: no, archive: no, doNext: no, moveProject: no, remove: no, set: no, field: no }
export interface Open {
  n: number
  asking?: boolean
  arm?: ItemMenuFacts['arm']
  /** the desktop's menu at the pointer (a right-click on its row), not under the ⋯ button */
  at?: { x: number; y: number }
  /** placed in the queue by hand (Do this next) */
  rank?: number
}
export const menu = (o: Open, desk: boolean) => {
  const m = menuModel()
  const it = m.byN.get(o.n)!
  const facts = itemMenuFacts(m, o.rank != null ? { ...it, rank: o.rank } : it, !!o.asking, o.arm ?? null)
  return opened(desk ? itemMenuPop(facts, on) : itemMenuSheet(facts, on), desk, { under: underList(desk), look: desk ? { pop: true, narrow: !!o.arm, at: o.at ?? (o.arm ? AT_BUTTON_NARROW : AT_BUTTON) } : {} })
}
export const both = (o: Open): Story => ({ render: () => <Frames height={720} deskWidth={900} phoneWidth={393}>{(layout) => menu(o, layout === 'desk')}</Frames> })
export const desk = (o: Open, pseudo: Record<string, string[]>): Story => ({ parameters: { pseudo }, render: () => <Frames phone={false} height={560} deskWidth={900}>{() => menu(o, true)}</Frames> })
export const ROW = '[role="dialog"] button:nth-of-type(2)'
