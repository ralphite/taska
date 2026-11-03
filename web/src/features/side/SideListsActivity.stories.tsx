// Activity beside the items on the desktop: what happened, newest first, in words.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { activityRows } from '../../model/activity'
import { LOG } from '../../stories/settingsFixtures'
import { ActivityList } from './SideLists'
import { logOn, m, no, page, rows } from '../../stories/sideListsFixtures'

export default { title: 'Components/Side lists/Activity' } satisfies Meta
type Story = StoryObj

/** What happened, newest first, in words; your change has Undo; a line that opens what it changed. */
export const Activity: Story = { ...page('log', 0, <ActivityList rows={activityRows(m, LOG)} end picked={null} on={{ open: no, item: no, input: no, undo: no, more: no }} />), name: 'What happened' }
export const ActivityLoading: Story = { ...page('log', 0, <ActivityList rows={null} end={false} picked={null} on={logOn} />), name: 'Loading' }
export const ActivityNothingYet: Story = { ...page('log', 0, <ActivityList rows={[]} end picked={null} on={logOn} />), name: 'Nothing happened yet' }
export const ActivityLoadingEarlier: Story = { ...page('log', 0, <ActivityList rows={rows} end={false} picked={null} on={logOn} />), name: 'Earlier changes loading' }
export const ActivityOnePicked: Story = { ...page('log', 0, <ActivityList rows={rows} end picked={rows[1]?.s.key ?? null} on={logOn} />), name: 'A change picked' }
