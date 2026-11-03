// Settings' Notifications: on, blocked by the browser, off; the phone's pushes on with quiet hours, off, blocked.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { one } from '../../stories/sectionsFixtures'
import { settingsAt, type SettingsHere } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings/Notifications' } satisfies Meta
type Story = StoryObj

export const Notifications: Story = { ...one('notifications'), name: 'Notifications' }
// ---- more states (B636)
export const NotificationsBlocked: Story = { ...one('notifications', { notifications: { state: 'Blocked by the browser', quiet: false } }), name: 'Notifications: blocked by the browser' }
export const NotificationsOffQuietHours: Story = { ...one('notifications', { notifications: { state: 'Off', quiet: true } }), name: 'Notifications: off' }
export const PhonePushesOnQuiet: Story = { ...one('notifications', { push: { sub: true, blocked: false, quiet: true } }), name: 'Notifications: the phone’s pushes on, quiet hours' }
export const PhonePushesOff: Story = { ...one('notifications', { push: { sub: false, blocked: false, quiet: false } }), name: 'Notifications: the phone’s pushes off' }
export const PhonePushesBlocked: Story = { ...one('notifications', { push: { sub: false, blocked: true, quiet: false } }), name: 'Notifications: blocked by the phone' }
// ---- more states (T639)
const phoneOnly = (h: SettingsHere): Story => ({ render: () => <Frames desk={false}>{() => settingsAt('notifications', false, h)}</Frames> })
export const OnQuietHours: Story = { ...one('notifications', { notifications: { state: 'On', quiet: true } }), name: 'Notifications: on, quiet hours on' }
export const PhoneNotSupported: Story = { ...phoneOnly({ pushUnsupported: true }), name: 'Notifications: not supported on this phone' }
export const PhonePushesLoading: Story = { ...phoneOnly({ pushLoading: true }), name: "Notifications: the phone's pushes loading" }
