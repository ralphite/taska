// Deleted, Settings' page on the phone (a list beside the items on the desktop, in Side lists): the page's own
// Settings with what it shows from settingsFacts.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SectionKey } from './sectionList'
import { Frames } from '../../stories/Frames'
import { settingsAt, type SettingsHere } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings/On the phone: Documents, Activity, Deleted/Deleted' } satisfies Meta
type Story = StoryObj

const phone = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames desk={false}>{() => settingsAt(sec, false, h)}</Frames> })

/** What was deleted: items, documents and what you said; Restore puts it back. */
export const Deleted: Story = { ...phone('deleted'), name: 'Everything deleted' }
export const DeletedNothing: Story = { ...phone('deleted', { nothingDeleted: true }), name: 'Nothing deleted' }
