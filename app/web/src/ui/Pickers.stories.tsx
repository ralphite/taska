// Putting an item under another, and what you said with another item (T591: Menus and sheets > Move and pick): the
// page's own pickers (moveParentSheet, pickSheet) with the item list's demo project, as the page opens them: under the
// menu's row on the desktop, a sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { codeOf } from '../model/project'
import { inputCode } from '../model/words'
import { After, Frames, typeInto } from '../stories/Frames'
import { AT_BUTTON, menuModel, no, opened, underList } from '../stories/menuFixtures'
import { moveParentSheet, pickSheet } from './Pickers'

export default { title: 'Components/Menus and sheets/Move and pick' } satisfies Meta
type Story = StoryObj

const putUnder = (desk: boolean) => {
  const m = menuModel()
  return opened(moveParentSheet({ it: m.byN.get(14)!, items: m.items, kids: m.kids, code: (n) => codeOf(m, n), desk }, no), desk, { under: underList(desk), look: desk ? { pop: true, at: AT_BUTTON } : {} })
}
const typed = (text: string) => (root: HTMLElement) => typeInto(root.querySelector<HTMLInputElement>('[role="dialog"] input'), text)

/** The items it can go under (its parent now marked), and No parent. */
export const MoveItem: Story = { name: 'Put under', render: () => <Frames height={640} deskWidth={900} phoneWidth={393}>{(layout) => putUnder(layout === 'desk')}</Frames> }
export const MoveItemNothingMatches: Story = {
  name: 'Put under: nothing matches',
  render: () => <Frames height={480} deskWidth={900} phoneWidth={393}>{(layout) => <After run={typed('invoices')}>{putUnder(layout === 'desk')}</After>}</Frames>,
}
/** What you said, put with an item (its talk): any item but the one it is with now. */
export const PickAnItem: Story = {
  name: 'What you said, with another item',
  render: () => (
    <Frames height={640} deskWidth={900} phoneWidth={393}>
      {(layout) => {
        const m = menuModel()
        return opened(pickSheet({ head: `Put ${inputCode('r12')} with…`, items: m.items, skip: [1], code: (n) => codeOf(m, n), desk: layout === 'desk' }, no), layout === 'desk')
      }}
    </Frames>
  ),
}
