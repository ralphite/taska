// T512, T522: Conversation > Whole conversation: an item's talk as a whole, as the item page shows it
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Whole conversation' }
export default meta

export const WholeTalk: StoryObj = { ...Talk.WholeTalk, name: 'Every message, with document comments' }
export const WithItsCard: StoryObj = { ...Talk.WithItsCard, name: 'With the card that asks you' }
export const LongTalk: StoryObj = { ...Talk.LongTalk, name: 'Long back-and-forth' }
