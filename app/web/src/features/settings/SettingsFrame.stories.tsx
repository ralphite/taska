// Settings' list of sections on the phone (T591: Settings), each saying how it is set now: the page's own Settings.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { settingsAt } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings' } satisfies Meta
type Story = StoryObj

export const SettingsIndex: Story = { name: 'Settings list on the phone', render: () => <Frames desk={false}>{() => settingsAt(null, false)}</Frames> }
