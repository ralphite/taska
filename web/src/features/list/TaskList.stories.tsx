// The task list in each of its views: Needs you, Active, All, Open, Later, Done, Won't do.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { view } from '../../stories/taskListFixtures'

export default { title: "UI/List pane/Views/The Tasks tab's views" } satisfies Meta

export const NeedsYou: StoryObj = { ...view('tasks', { status: 'wait' }), name: 'Needs you' }
export const Active = view('tasks', { status: 'all' })
export const All = view('tasks', { status: 'every' })
export const Open: StoryObj = { ...view('tasks', { status: 'open' }), name: 'Open' }
export const Later = view('tasks', { status: 'later' })
export const Done = view('tasks', { status: 'done' })
export const WontDo: StoryObj = { ...view('tasks', { status: 'dropped' }), name: "Won't do" }
