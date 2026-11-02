// Settings' Notifications: on, blocked by the browser, off; the phone's pushes on with quiet hours, off, blocked.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings/Notifications' } satisfies Meta
type Story = StoryObj

export const Notifications: Story = { ...one('notifications'), name: 'Notifications' }
// ---- more states (B636)
export const NotificationsBlocked: Story = { ...one('notifications', { notifications: { state: 'Blocked by the browser', quiet: false } }), name: 'Notifications: blocked by the browser' }
export const NotificationsOffQuietHours: Story = { ...one('notifications', { notifications: { state: 'Off', quiet: true } }), name: 'Notifications: off' }
export const PhonePushesOnQuiet: Story = { ...one('notifications', { push: { sub: true, blocked: false, quiet: true } }), name: 'Notifications: the phone’s pushes on, quiet hours' }
export const PhonePushesOff: Story = { ...one('notifications', { push: { sub: false, blocked: false, quiet: false } }), name: 'Notifications: the phone’s pushes off' }
export const PhonePushesBlocked: Story = { ...one('notifications', { push: { sub: false, blocked: true, quiet: false } }), name: 'Notifications: blocked by the phone' }
