// The keyboard shortcuts sheet (?).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { keyHelp } from '../../app/actions'
import { opened } from '../../stories/menuFixtures'
import { keysSheet } from './Finders'
import { one } from '../../stories/findersFixtures'

export default { title: 'Components/Menus and sheets/Sheets/Keyboard shortcuts' } satisfies Meta
type Story = StoryObj

/** ?: every key. */
export const Keys: Story = { ...one((desk) => opened(keysSheet(keyHelp()), desk), undefined, 900), name: 'Keyboard shortcuts' }
