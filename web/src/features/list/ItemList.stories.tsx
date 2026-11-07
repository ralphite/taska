// The item list in each of its views: Needs you, Active, All, Open, Later, Done, Won't do.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { view } from '../../stories/itemListFixtures'

export default { title: "UI/List pane/Views/The Items tab's views" } satisfies Meta

export const NeedsYou: StoryObj = { ...view('items', { status: 'wait' }), name: 'Needs you' }
export const Active = view('items', { status: 'all' })
export const All = view('items', { status: 'every' })
export const Open: StoryObj = { ...view('items', { status: 'open' }), name: 'Open' }
export const Later = view('items', { status: 'later' })
export const Done = view('items', { status: 'done' })
export const WontDo: StoryObj = { ...view('items', { status: 'dropped' }), name: "Won't do" }
