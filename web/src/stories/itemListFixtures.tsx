// The helpers ItemList's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { ListQuery } from '../model/route'
import type { SavedView } from '../model/types'
import type { Tab } from '../model/words'
import { Frames } from './Frames'
import { PROJECT, listOf } from './listFixtures'

type Story = StoryObj

export const view = (tab: Tab, q: Partial<ListQuery>, items = PROJECT, saved: readonly SavedView[] = []): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={760}>{(layout) => listOf(items, tab, q, layout === 'desk', { saved })}</Frames>,
})

export const bugs: SavedView = { name: 'Bugs first', type: 'bug', when: 'all', status: 'all', pri: 'all', sort: 'all' }
