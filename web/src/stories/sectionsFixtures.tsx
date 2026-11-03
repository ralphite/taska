// The helpers Sections's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import type { SectionKey } from '../features/settings/sectionList'
import { Frames } from './Frames'
import { settingsAt, type SettingsHere } from './settingsFixtures'

type Story = StoryObj

export const one = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames deskWidth={1100} height={760}>{(layout) => settingsAt(sec, layout === 'desk', h)}</Frames> })
/** a section as only the desktop draws it (this browser's notifications) */
export const onDesk = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames phone={false} deskWidth={1100} height={760}>{() => settingsAt(sec, true, h)}</Frames> })
/** a section as only the phone draws it (its pushes, a project's ⋯) */
export const onPhone = (sec: SectionKey, h: SettingsHere = {}): Story => ({ render: () => <Frames desk={false}>{() => settingsAt(sec, false, h)}</Frames> })
