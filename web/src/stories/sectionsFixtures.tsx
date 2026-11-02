// The helpers Sections's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { SectionKey } from '../features/settings/sectionList'
import { Frames } from './Frames'
import { settingsAt, type SettingsHere } from './settingsFixtures'

type Story = StoryObj

export const one = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames deskWidth={1100} height={760}>{(layout) => settingsAt(sec, layout === 'desk', h)}</Frames> })
