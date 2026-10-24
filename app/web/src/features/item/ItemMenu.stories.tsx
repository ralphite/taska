import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { item } from '../../stories/fixtures'
import { Sheet } from '../../ui/Sheet'
import { itemMenuPop, itemMenuSheet, type ItemMenuEvents } from './ItemMenu'

const meta: Meta = { title: 'Components/Sheets/Item menu' }
export default meta
type Story = StoryObj

const no = () => {}
const on: ItemMenuEvents = { edit: no, copy: no, newDoc: no, addSub: no, reparent: no, later: no, archive: no, doNext: no, moveProject: no, remove: no, set: no }
const it = item({ n: 12, pri: 'P1', parent: 3 })
const facts = { it, code: 'F012', parentCode: 'F003', asking: false, arm: null }

/** The phone's sheet: every action, then type, priority and status. */
export const PhoneSheet: Story = {
  render: () => <Frames desk={false} height={760}>{() => <Sheet open look={{}} parts={itemMenuSheet(facts, on)} desk={false} onClose={no} />}</Frames>,
}

/** The desktop's menu, Delete asking for its second click; and one field's choices from its chip. */
export const DeskMenu: Story = {
  render: () => (
    <Frames phone={false} deskWidth={560} height={520}>
      {() => (
        <div className="grid h-full grid-cols-2">
          <div className="relative transform-gpu">
            <Sheet open look={{ pop: true }} parts={itemMenuPop({ ...facts, asking: true }, on)} desk onClose={no} />
          </div>
          <div className="relative transform-gpu">
            <Sheet open look={{ pop: true, narrow: true }} parts={itemMenuPop({ ...facts, arm: 's' }, on)} desk onClose={no} />
          </div>
        </div>
      )}
    </Frames>
  ),
}
