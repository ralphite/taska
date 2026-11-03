import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { SelBar } from './SelBar'

const meta: Meta = { title: 'Components/Item list/Bar for picked items' }
export default meta
type Story = StoryObj

/** Three rows picked (Cmd-click, Shift-click): what can be done to them all. */
export const Picked: Story = { name: 'Three picked', render: () => <Frames phone={false} deskWidth={460}>{() => <SelBar n={3} on={{ set: () => {}, clear: () => {} }} />}</Frames> }
// ---- more states (T639)
export const PointerOnItsButtons: Story = { name: 'Pointer on its buttons', parameters: { pseudo: { hover: ['button:first-of-type', 'button:last-of-type'] } }, render: () => <Frames phone={false} deskWidth={460}>{() => <SelBar n={3} on={{ set: () => {}, clear: () => {} }} />}</Frames> }
