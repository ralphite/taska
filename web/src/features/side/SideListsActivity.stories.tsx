// Activity beside the items on the desktop: what happened, newest first, in words.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ActivityList } from './SideLists'
import { logOn, page, rows } from '../../stories/sideListsFixtures'

export default { title: 'Components/Around the page/Side lists/Activity' } satisfies Meta
type Story = StoryObj

const none = new Set<number>()
const yours = rows.find((x) => x.undo != null)?.undo ?? -1
const hover = (sel: string) => ({ parameters: { pseudo: { hover: [sel] } } })

/** What happened, newest first, in words; your change has Undo; a line that opens what it changed. */
export const Activity: Story = { ...page('log', 0, <ActivityList rows={rows} end picked={null} asking={none} on={logOn} />), name: 'What happened' }
export const ActivityLoading: Story = { ...page('log', 0, <ActivityList rows={null} end={false} picked={null} asking={none} on={logOn} />), name: 'Loading' }
export const ActivityNothingYet: Story = { ...page('log', 0, <ActivityList rows={[]} end picked={null} asking={none} on={logOn} />), name: 'Nothing happened yet' }
export const ActivityLoadingEarlier: Story = { ...page('log', 0, <ActivityList rows={rows} end={false} picked={null} asking={none} on={logOn} />), name: 'Earlier changes loading' }
export const ActivityOnePicked: Story = { ...page('log', 0, <ActivityList rows={rows} end picked={rows[1]?.s.key ?? null} asking={none} on={logOn} />), name: 'A change picked' }
/** the pointer on your change: its Undo shows (hidden on the desktop until then) */
export const PointerOnYourChange: Story = { ...page('log', 0, <ActivityList rows={rows} end picked={null} asking={none} on={logOn} />), ...hover('.group:has(> button)'), name: 'Pointer on your change: Undo' }
/** Undo clicked once: it asks for a second click before it puts the change back */
export const UndoAsksAgain: Story = { ...page('log', 0, <ActivityList rows={rows} end picked={null} asking={new Set([yours])} on={logOn} />), ...hover('.group:has(> button)'), name: 'Undo asks again' }
