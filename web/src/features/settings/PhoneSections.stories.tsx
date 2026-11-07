// Documents, Settings' page on the phone (a list beside the items on the desktop, in Side lists): the page's own
// Settings with what it shows from settingsFacts.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SectionKey } from './sectionList'
import { Frames } from '../../stories/Frames'
import { settingsAt, type SettingsHere } from '../../stories/settingsFixtures'

export default { title: 'UI/Left sidebar/A list open beside it/Documents/On the phone' } satisfies Meta
type Story = StoryObj

const phone = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames desk={false}>{() => settingsAt(sec, false, h)}</Frames> })

/** Newest first, each with its item and its comments. */
export const Documents: Story = { ...phone('docs'), name: 'Every document' }
export const DocumentsNoneYet: Story = { ...phone('docs', { noDocs: true }), name: 'None yet' }
