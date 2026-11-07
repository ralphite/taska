// Settings' Notifications as the desktop's browser has them: on, on with quiet hours, off, blocked by the browser (the
// phone's are under On the phone).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { onDesk } from '../../stories/sectionsFixtures'

export default { title: 'UI/Settings and help/Settings/Notifications/In this browser' } satisfies Meta
type Story = StoryObj

export const Notifications: Story = { ...onDesk('notifications'), name: 'On' }
export const OnQuietHours: Story = { ...onDesk('notifications', { notifications: { state: 'On', quiet: true } }), name: 'On, quiet hours on' }
export const OnQuietHoursChanged: Story = { ...onDesk('notifications', { notifications: { state: 'On', quiet: true, hours: { from: '21:00', to: '09:30' } } }), name: 'On, quiet hours changed' }
export const OnQuietHoursOff: Story = { ...onDesk('notifications', { notifications: { state: 'On', quiet: false } }), name: 'On, quiet hours off' }
export const NotificationsOffQuietHours: Story = { ...onDesk('notifications', { notifications: { state: 'Off', quiet: true } }), name: 'Off' }
/** where to allow them; the app's icon count greyed, of no use until they are allowed */
export const NotificationsBlocked: Story = { ...onDesk('notifications', { notifications: { state: 'Blocked by the browser', quiet: false } }), name: 'Blocked by the browser' }
/** the app's icon count turned off (D115 #19; where the browser cannot show one, the switch is not there) */
export const BadgeOff: Story = { ...onDesk('notifications', { badgeOff: true }), name: 'On, no count on the app icon' }
export const NoBadge: Story = { ...onDesk('notifications', { noBadge: true }), name: 'On, a browser with no app icon count' }
