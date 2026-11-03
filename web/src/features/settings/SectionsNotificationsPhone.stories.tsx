// Settings' Notifications on the phone, its pushes: on with quiet hours, off, blocked by the phone, not supported,
// loading.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { one } from '../../stories/sectionsFixtures'
import { settingsAt, type SettingsHere } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings/Notifications/On the phone' } satisfies Meta
type Story = StoryObj

const phoneOnly = (h: SettingsHere): Story => ({ render: () => <Frames desk={false}>{() => settingsAt('notifications', false, h)}</Frames> })
export const PhonePushesOnQuiet: Story = { ...one('notifications', { push: { sub: true, blocked: false, quiet: true } }), name: 'Pushes on, quiet hours' }
export const PhonePushesOff: Story = { ...one('notifications', { push: { sub: false, blocked: false, quiet: false } }), name: 'Pushes off' }
export const PhonePushesBlocked: Story = { ...one('notifications', { push: { sub: false, blocked: true, quiet: false } }), name: 'Blocked by the phone' }
export const PhoneNotSupported: Story = { ...phoneOnly({ pushUnsupported: true }), name: 'Not supported on this phone' }
export const PhonePushesLoading: Story = { ...phoneOnly({ pushLoading: true }), name: 'Pushes loading' }
