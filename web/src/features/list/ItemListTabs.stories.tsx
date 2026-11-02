// The Archive and Rules tabs.
import type { Meta } from '@storybook/react-vite'
import { view } from '../../stories/itemListFixtures'

export default { title: 'Components/Item list/Views/Archive and Rules' } satisfies Meta

export const Archive = view('archive', {})
export const Rules = view('rules', {})
