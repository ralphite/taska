// The helpers TaskMenu's stories share: how each draws its part.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { AT_BUTTON, AT_BUTTON_NARROW, acts, menuModel, opened, underList } from './menuFixtures'
import { taskMenuPop, taskMenuSheet, type TaskMenuEvents, type TaskMenuFacts } from '../features/task/TaskMenu'
import { taskMenuFacts } from '../features/task/taskMenuFacts'

type Story = StoryObj

export const on: TaskMenuEvents = acts('Task menu', ['edit', 'copy', 'agent', 'newDoc', 'addSub', 'reparent', 'later', 'archive', 'doNext', 'moveProject', 'remove', 'set', 'field', 'tag', 'group', 'waitFor'], {
  agent: 'Sheets › A task: what agents see',
  reparent: 'Move and pick › Put under',
  moveProject: 'Move and pick › Task to another project',
  remove: 'Task menu › Its submenus › Delete asks again',
  field: 'Task menu › Its submenus › Status, Priority, Tags',
})
export interface Open {
  n: number
  asking?: boolean
  arm?: TaskMenuFacts['arm']
  /** the desktop's menu at the pointer (a right-click on its row), not under the ⋯ button */
  at?: { x: number; y: number }
  /** placed in the queue by hand (Do this next) */
  rank?: number
}
export const menu = (o: Open, desk: boolean) => {
  const m = menuModel()
  const it = m.byN.get(o.n)!
  const facts = taskMenuFacts(m, o.rank != null ? { ...it, rank: o.rank } : it, !!o.asking, o.arm ?? null)
  return opened(desk ? taskMenuPop(facts, on) : taskMenuSheet(facts, on), desk, { under: underList(desk), look: desk ? { pop: true, narrow: !!o.arm, at: o.at ?? (o.arm ? AT_BUTTON_NARROW : AT_BUTTON) } : {} })
}
export const both = (o: Open): Story => ({ render: () => <Frames height={720} deskWidth={900} phoneWidth={393}>{(layout) => menu(o, layout === 'desk')}</Frames> })
export const desk = (o: Open, pseudo: Record<string, string[]>): Story => ({ parameters: { pseudo }, render: () => <Frames phone={false} height={560} deskWidth={900}>{() => menu(o, true)}</Frames> })
export const ROW = '[role="dialog"] button:nth-of-type(2)'
