// Settings' Use on your phone: the link and key, and New key asking again.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings/Use on your phone' } satisfies Meta
type Story = StoryObj

/** The link and the key to open Taska from anywhere. */
export const UseOnYourPhone: Story = { ...one('phone'), name: 'Use on your phone' }
export const NewKeyAsksAgain: Story = { ...one('phone', { newKeyAsking: true }), name: 'Use on your phone: New key asks again' }
// ---- more states (T639)
export const NoPublicAddress: Story = { ...one('phone', { noRemote: true }), name: 'Use on your phone: no public address' }
