// The item list in each of its views: Needs you, Active, All, Queue, Later, Finished.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { view } from '../../stories/itemListFixtures'

export default { title: 'Components/Item list/Views/The Items tab’s views' } satisfies Meta

export const NeedsYou: StoryObj = { ...view('items', { status: 'wait' }), name: 'Needs you' }
export const Active = view('items', { status: 'all' })
export const All = view('items', { status: 'every' })
export const Queue = view('items', { status: 'queued' })
export const Later = view('items', { status: 'later' })
export const Finished = view('items', { status: 'closed' })
