// Settings' Notifications on the phone, its pushes: on with quiet hours, off, blocked by the phone, not supported,
// opened outside the Home Screen, loading.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { onPhone } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings, help and parts/Settings/Notifications/On the phone' } satisfies Meta
type Story = StoryObj

export const PhonePushesOnQuiet: Story = { ...onPhone('notifications', { push: { sub: true, blocked: false, quiet: true } }), name: 'Pushes on, quiet hours' }
export const PhonePushesOff: Story = { ...onPhone('notifications', { push: { sub: false, blocked: false, quiet: false } }), name: 'Pushes off' }
export const PhonePushesBlocked: Story = { ...onPhone('notifications', { push: { sub: false, blocked: true, quiet: false } }), name: 'Blocked by the phone' }
export const PhoneNotSupported: Story = { ...onPhone('notifications', { pushUnsupported: true }), name: 'Not supported on this phone' }
/** opened in the phone's browser, not from the Home Screen: how to add it there first */
export const PhoneNotOnHomeScreen: Story = { ...onPhone('notifications'), name: 'In the browser, not on the Home Screen' }
export const PhonePushesLoading: Story = { ...onPhone('notifications', { pushLoading: true }), name: 'Pushes loading' }
