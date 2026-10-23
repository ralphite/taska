// T512, B515: Conversation > Whole conversation: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Whole conversation' }
export default meta

export const WholeTalk: StoryObj = { ...Talk.WholeTalk, name: "An item's whole talk" }
