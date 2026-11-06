// The Archive tab (the Rules tab is the rules document: features/docs/Rules.stories, I693).
import type { Meta } from '@storybook/react-vite'
import { view } from '../../stories/itemListFixtures'

export default { title: 'Components/Item list/Views/Archive' } satisfies Meta

export const Archive = view('archive', {})
