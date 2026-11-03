// Settings' Notifications as this browser has them: on, on with quiet hours, off, blocked by the browser.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings, help and parts/Settings/Notifications/In this browser' } satisfies Meta
type Story = StoryObj

export const Notifications: Story = { ...one('notifications'), name: 'On' }
export const OnQuietHours: Story = { ...one('notifications', { notifications: { state: 'On', quiet: true } }), name: 'On, quiet hours on' }
export const NotificationsOffQuietHours: Story = { ...one('notifications', { notifications: { state: 'Off', quiet: true } }), name: 'Off' }
export const NotificationsBlocked: Story = { ...one('notifications', { notifications: { state: 'Blocked by the browser', quiet: false } }), name: 'Blocked by the browser' }
