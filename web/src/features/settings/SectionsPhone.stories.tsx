// Settings' Use on your phone: the link and key, and New key asking again.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'UI/Settings and help/Settings/Use on your phone' } satisfies Meta
type Story = StoryObj

/** The link and the key to open Taska from anywhere. */
export const UseOnYourPhone: Story = { ...one('phone'), name: 'Its address and key' }
export const NewKeyAsksAgain: Story = { ...one('phone', { newKeyAsking: true }), name: 'New key asks again' }
// ---- more states (T639)
/** no public address: the address on this network (no key needed there), no key offered */
export const NoPublicAddress: Story = { ...one('phone', { noRemote: true }), name: 'No public address' }
/** no public address, and Taska listens on this computer only: how to start it for the phone */
export const ThisComputerOnly: Story = { ...one('phone', { noRemote: true, noLan: true }), name: 'This computer only' }
