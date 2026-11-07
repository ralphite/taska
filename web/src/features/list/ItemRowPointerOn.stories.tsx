// A row under the pointer on the desktop: its quick actions show, the ones its status offers (the phone has no pointer).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { agent, hover, one } from '../../stories/itemRowFixtures'

export default { title: 'UI/List pane/Item row/Pointer, keys and picking/Pointer on it' } satisfies Meta
type Story = StoryObj

export const PointerOnIt: Story = { ...one({}), ...hover, name: "Open: Done, Won't do, Later" }
export const PointerOnItInProgress: Story = { ...one({ it: { status: 'doing', agent } }), ...hover, name: "In progress: Done, Won't do, Later" }
export const PointerOnItWaitsForReview: Story = { ...one({ it: { status: 'review' } }), ...hover, name: 'Waits for review: Accept, Not yet, Later' }
export const PointerOnItDone: Story = { ...one({ it: { status: 'done' } }), ...hover, name: 'Done: Archive, Reopen' }
export const PointerOnItArchived: Story = { ...one({ it: { status: 'done', archived: true } }), ...hover, name: 'Archived: Unarchive' }
export const PointerOnItLater: Story = { ...one({ it: { when: 'later' } }), ...hover, name: "For later: Done, Won't do, Back to now" }
