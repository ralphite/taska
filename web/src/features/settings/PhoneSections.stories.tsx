// Documents, Activity and Deleted, Settings' pages on the phone (lists beside the items on the desktop, in Side
// lists), and Projects' phone rows (T591: Settings): the page's own Settings with what it shows from settingsFacts.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SectionKey } from './sectionList'
import { Frames } from '../../stories/Frames'
import { settingsAt, type SettingsHere } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings/On the phone: Documents, Activity, Deleted' } satisfies Meta
type Story = StoryObj

const phone = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames desk={false}>{() => settingsAt(sec, false, h)}</Frames> })

/** Newest first, each with its item and its comments. */
export const Documents: Story = { ...phone('docs'), name: 'Documents' }
/** What happened, newest first; Undo puts your change back. */
export const Activity: Story = { ...phone('log'), name: 'Activity' }
/** What was deleted: items, documents and what you said; Restore puts it back. */
export const Deleted: Story = { ...phone('deleted'), name: 'Deleted' }
// ---- more states (T639)
export const DocumentsNoneYet: Story = { ...phone('docs', { noDocs: true }), name: 'Documents: none yet' }
export const ActivityLoading: Story = { ...phone('log', { log: 'loading' }), name: 'Activity: loading' }
export const ActivityNothingYet: Story = { ...phone('log', { log: 'empty' }), name: 'Activity: nothing yet' }
export const ActivityUndoAsks: Story = { ...phone('log', { log: 'asking' }), name: 'Activity: Undo asks again' }
export const ActivityLoadingEarlier: Story = { ...phone('log', { log: 'more' }), name: 'Activity: earlier changes loading' }
export const DeletedNothing: Story = { ...phone('deleted', { nothingDeleted: true }), name: 'Deleted: nothing' }
