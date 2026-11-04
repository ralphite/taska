// The helpers Finders's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { PROJECT_TONES } from '../ui/tones'
import { After, Frames } from './Frames'
import { act, opened } from './menuFixtures'
import { Switcher } from '../features/find/Finders'

type Story = StoryObj

export const ROWS = [
  { slug: 'taska', title: 'taska', tone: PROJECT_TONES[0], needs: 2, here: true },
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], needs: 11, here: false },
  { slug: 'todos', title: 'todos', tone: PROJECT_TONES[2], needs: 0, here: false },
  { slug: 'notes', title: 'Notes', tone: PROJECT_TONES[3], needs: 0, here: false },
]
export const field = (root: HTMLElement) => root.querySelector<HTMLInputElement>('[role="dialog"] input')
export const switcher = (desk: boolean) => opened({ title: 'Switch project', body: <Switcher rows={ROWS} loading={false} onOpen={act('Switch project: open')} /> }, desk)
/** the projects not listed yet: Loading… under the field */
export const switcherLoading = (desk: boolean) => opened({ title: 'Switch project', body: <Switcher rows={[]} loading onOpen={act('Switch project: open')} /> }, desk)
export const one = (draw: (desk: boolean) => ReturnType<typeof opened>, run?: (root: HTMLElement) => void, height = 720, pseudo?: Record<string, string[]>): Story => ({
  ...(pseudo ? { parameters: { pseudo } } : {}),
  render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => (run ? <After run={run}>{draw(layout === 'desk')}</After> : draw(layout === 'desk'))}</Frames>,
})
