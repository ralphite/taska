// The helpers Finders's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { paletteRows } from '../app/actions'
import { codeOf } from '../model/project'
import { PROJECT_TONES } from '../ui/tones'
import { After, Frames } from './Frames'
import { menuModel, no, opened } from './menuFixtures'
import { Palette, Switcher } from '../features/find/Finders'

type Story = StoryObj

export const COMMANDS = [...paletteRows(true), ...paletteRows(false)]
export const ROWS = [
  { slug: 'taska', title: 'taska', tone: PROJECT_TONES[0], needs: 2, here: true },
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], needs: 11, here: false },
  { slug: 'todos', title: 'todos', tone: PROJECT_TONES[2], needs: 0, here: false },
  { slug: 'notes', title: 'Notes', tone: PROJECT_TONES[3], needs: 0, here: false },
]
export const field = (root: HTMLElement) => root.querySelector<HTMLInputElement>('[role="dialog"] input')
export const palette = (desk: boolean, open: number | null) => {
  const m = menuModel()
  return opened({ title: 'Go to or do', body: <Palette items={m.items} code={(n) => codeOf(m, n)} open={open} commands={COMMANDS} desk={desk} onItem={no} onCommand={no} /> }, desk)
}
export const switcher = (desk: boolean) => opened({ title: 'Switch project', body: <Switcher rows={ROWS} loading={false} onOpen={no} /> }, desk)
/** the projects not listed yet: Loading… under the field */
export const switcherLoading = (desk: boolean) => opened({ title: 'Switch project', body: <Switcher rows={[]} loading onOpen={no} /> }, desk)
export const one = (draw: (desk: boolean) => ReturnType<typeof opened>, run?: (root: HTMLElement) => void, height = 720, pseudo?: Record<string, string[]>): Story => ({
  ...(pseudo ? { parameters: { pseudo } } : {}),
  render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => (run ? <After run={run}>{draw(layout === 'desk')}</After> : draw(layout === 'desk'))}</Frames>,
})
