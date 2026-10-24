import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { SelBar } from './SelBar'

const meta: Meta = { title: 'Components/List/Selection bar' }
export default meta
type Story = StoryObj

/** Three rows picked (Cmd-click, Shift-click): what can be done to them all. */
export const Picked: Story = { render: () => <Frames phone={false} deskWidth={460}>{() => <SelBar n={3} on={{ set: () => {}, clear: () => {} }} />}</Frames> }
