// Settings' Notifications as the desktop's browser has them: on, on with quiet hours, off, blocked by the browser (the
// phone's are under On the phone).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { onDesk } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings, help and parts/Settings/Notifications/In this browser' } satisfies Meta
type Story = StoryObj

export const Notifications: Story = { ...onDesk('notifications'), name: 'On' }
export const OnQuietHours: Story = { ...onDesk('notifications', { notifications: { state: 'On', quiet: true } }), name: 'On, quiet hours on' }
export const NotificationsOffQuietHours: Story = { ...onDesk('notifications', { notifications: { state: 'Off', quiet: true } }), name: 'Off' }
export const NotificationsBlocked: Story = { ...onDesk('notifications', { notifications: { state: 'Blocked by the browser', quiet: false } }), name: 'Blocked by the browser' }
