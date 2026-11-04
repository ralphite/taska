import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { SelBar } from './SelBar'
import { act } from '../../stories/menuFixtures'

const meta: Meta = { title: 'Components/Item list/Bar for picked items' }
export default meta
type Story = StoryObj

// what it does to the picked items needs the list and Taska: it shows in the Actions panel
const on = { set: act('Picked: set'), clear: act('Picked: clear') }

/** Three rows picked (Cmd-click, Shift-click): what can be done to them all. */
export const Picked: Story = { name: 'Three picked', render: () => <Frames phone={false} deskWidth={460}>{() => <SelBar n={3} on={on} />}</Frames> }
// ---- more states (T639)
export const PointerOnItsButtons: Story = { name: 'Pointer on its buttons', parameters: { pseudo: { hover: ['button:first-of-type', 'button:last-of-type'] } }, render: () => <Frames phone={false} deskWidth={460}>{() => <SelBar n={3} on={on} />}</Frames> }
