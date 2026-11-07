// Activity, Settings' page on the phone (a list beside the items on the desktop, in Side lists): the page's own
// Settings with what it shows from settingsFacts.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SectionKey } from './sectionList'
import { Frames } from '../../stories/Frames'
import { settingsAt, type SettingsHere } from '../../stories/settingsFixtures'

export default { title: 'UI/Left sidebar/A list open beside it/Activity/On the phone' } satisfies Meta
type Story = StoryObj

const phone = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames desk={false}>{() => settingsAt(sec, false, h)}</Frames> })

/** What happened, newest first; Undo puts your change back. */
export const Activity: Story = { ...phone('log'), name: 'What happened' }
export const ActivityUndoAsks: Story = { ...phone('log', { log: 'asking' }), name: 'Undo asks again' }
export const ActivityLoading: Story = { ...phone('log', { log: 'loading' }), name: 'Loading' }
export const ActivityNothingYet: Story = { ...phone('log', { log: 'empty' }), name: 'Nothing happened yet' }
export const ActivityLoadingEarlier: Story = { ...phone('log', { log: 'more' }), name: 'Earlier changes loading' }
