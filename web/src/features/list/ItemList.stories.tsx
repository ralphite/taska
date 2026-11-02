// The item list in each of its views: Needs you, Active, All, Queue, Later, Finished, and your own views.
import type { Meta } from '@storybook/react-vite'
import { PROJECT } from '../../stories/listFixtures'
import { bugs, view } from '../../stories/itemListFixtures'

export default { title: 'Components/Item list/Views/Views of Items' } satisfies Meta

export const NeedsYou = view('items', { status: 'wait' })
export const Active = view('items', { status: 'all' })
export const All = view('items', { status: 'every' })
export const Queue = view('items', { status: 'queued' })
export const Later = view('items', { status: 'later' })
export const Finished = view('items', { status: 'closed' })
export const YourOwnViews = view('items', { type: 'bug' }, PROJECT, [bugs, { name: 'Later ideas', type: 'idea', when: 'later', status: 'all', pri: 'all', sort: 'all' }])
