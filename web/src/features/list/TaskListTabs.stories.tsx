// The Archive tab (the Rules tab is the rules document: features/docs/Rules.stories, T693).
import type { Meta } from '@storybook/react-vite'
import { view } from '../../stories/taskListFixtures'

export default { title: 'UI/List pane/Views/Archive' } satisfies Meta

export const Archive = view('archive', {})
