// An item's menu, one story for each state (T591: the groups and names Yadong had before the rewrite): the page's own
// facts (itemMenuFacts) and parts (a sheet of tiles on the phone, a menu of rows with their keys on the desktop, or one
// field's choices), opened over the item list as the page opens it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { AT_BUTTON, AT_POINTER, menuModel, no, opened, underList } from '../../stories/menuFixtures'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents, type ItemMenuFacts } from './ItemMenu'
import { itemMenuFacts } from './itemMenuFacts'

export default { title: 'Components/Menus and sheets/Item menu' } satisfies Meta
type Story = StoryObj

const on: ItemMenuEvents = { edit: no, copy: no, newDoc: no, addSub: no, reparent: no, later: no, archive: no, doNext: no, moveProject: no, remove: no, set: no }
interface Open {
  n: number
  asking?: boolean
  arm?: ItemMenuFacts['arm']
  /** the desktop's menu at the pointer (a right-click on its row), not under the ⋯ button */
  at?: { x: number; y: number }
}
const menu = (o: Open, desk: boolean) => {
  const m = menuModel()
  const facts = itemMenuFacts(m, m.byN.get(o.n)!, !!o.asking, o.arm ?? null)
  return opened(desk ? itemMenuPop(facts, on) : itemMenuSheet(facts, on), desk, { under: underList(desk), look: desk ? { pop: true, narrow: !!o.arm, at: o.at ?? AT_BUTTON } : {} })
}
const both = (o: Open): Story => ({ render: () => <Frames height={720} deskWidth={900} phoneWidth={393}>{(layout) => menu(o, layout === 'desk')}</Frames> })
const desk = (o: Open, pseudo: Record<string, string[]>): Story => ({ parameters: { pseudo }, render: () => <Frames phone={false} height={560} deskWidth={900}>{() => menu(o, true)}</Frames> })
const ROW = '[role="dialog"] button:nth-of-type(2)'

/** In progress, with its subitems: every action, then its type, priority and status (the phone); rows with their keys
 * (the desktop). */
export const ItemInProgress: Story = { ...both({ n: 1 }), name: 'Item in progress' }
/** One field's choices only, from its chip (or S, P, T). */
export const Status: Story = { ...both({ n: 1, arm: 's' }), name: 'Status' }
export const Priority: Story = { ...both({ n: 1, arm: 'p' }), name: 'Priority' }
export const Type: Story = { ...both({ n: 1, arm: 't' }), name: 'Type' }
/** Delete pressed once: it asks for a second click. */
export const DeleteAsks: Story = { ...both({ n: 1, asking: true }), name: 'Delete asks again' }
/** Done: Archive, no Later. */
export const ItemDone: Story = { ...both({ n: 8 }), name: 'Item done' }
/** For later: Back to now. */
export const ItemLater: Story = { ...both({ n: 7 }), name: 'Item for later' }
/** Under another: Put under says which. */
export const Subitem: Story = { ...both({ n: 14 }), name: 'Subitem' }
export const ItemArchived: Story = { ...both({ n: 10 }), name: 'Item archived' }
/** A rule: no New doc, subitem, Put under, Later or priority. */
export const Rule: Story = { ...both({ n: 11 }), name: 'Rule' }
/** The desktop: a right-click on a row opens it at the pointer. */
export const RowRightClick: Story = { ...desk({ n: 5, at: AT_POINTER(360, 300) }, {}), name: 'Right-click on a row' }
export const ItemMenuHover: Story = { ...desk({ n: 1 }, { hover: [ROW] }), name: 'Pointer on a row' }
export const ItemMenuKeys: Story = { ...desk({ n: 1 }, { focusVisible: [ROW] }), name: 'Keys: Tab on a row' }
export const ItemMenuPressed: Story = { ...desk({ n: 1 }, { hover: [ROW], active: [ROW] }), name: 'A row pressed' }
export const StatusHover: Story = { ...desk({ n: 1, arm: 's' }, { hover: ['[role="dialog"] button[data-v="open"]'] }), name: 'Status, pointer on a choice' }
export const StatusHoverTicked: Story = { ...desk({ n: 1, arm: 's' }, { hover: ['[role="dialog"] button[aria-pressed="true"]'] }), name: 'Status, pointer on the ticked one' }
