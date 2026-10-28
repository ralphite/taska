// Documents, Activity and Deleted, Settings' pages on the phone (lists beside the items on the desktop, in Side
// lists), and Projects' phone rows (T591: Settings): the page's own Settings with what it shows from settingsFacts.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SectionKey } from './sectionList'
import { Frames } from '../../stories/Frames'
import { settingsAt } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings' } satisfies Meta
type Story = StoryObj

const phone = (sec: SectionKey): Story => ({ render: () => <Frames desk={false}>{() => settingsAt(sec, false)}</Frames> })

/** Newest first, each with its item and its comments. */
export const Documents: Story = { ...phone('docs'), name: 'Documents' }
/** What happened, newest first; Undo puts your change back. */
export const Activity: Story = { ...phone('log'), name: 'Activity' }
/** What was deleted: items, documents and what you said; Restore puts it back. */
export const Deleted: Story = { ...phone('deleted'), name: 'Deleted' }
