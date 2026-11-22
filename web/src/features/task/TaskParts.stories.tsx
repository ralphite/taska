// The parts of a task's page above its talk, each alone: its chips, its editor, its subtasks (TaskPage puts them
// together; its stories show them in place).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { Frames, States } from '../../stories/Frames'
import { task, modelOf } from '../../stories/fixtures'
import { taskFacts, noTaskEvents } from '../../stories/taskFixtures'
import { KIDS, PARENT } from '../../stories/taskPage'
import { base } from '../../stories/taskPageFixtures'
import type { Task } from '../../model/types'
import { Chips, Editor, Subtasks } from './TaskParts'
import type { TaskFacts } from './TaskPage'

export default { title: 'UI/Task pane/Parts' } satisfies Meta
type Story = StoryObj

const facts = (it: Task, f: Partial<TaskFacts> = {}, others: Task[] = [PARENT]) => taskFacts(modelOf([it, ...others]), it, f)
const framed = (node: (desk: boolean) => ReactNode) => (
  <Frames phoneWidth={393} deskWidth={720}>
    {(layout) => <div className="p-4">{node(layout === 'desk')}</div>}
  </Frames>
)

const chips = (it: Task, f: Partial<TaskFacts> = {}) =>
  framed(() => (
    <div className="flex flex-wrap items-center gap-2">
      <Chips it={it} f={facts(it, f)} on={noTaskEvents} />
    </div>
  ))

export const ChipStates: Story = {
  name: 'Chips',
  render: () => (
    <States
      tasks={[
        ['open, part of another, from 2 inputs', chips(base({ srcs: ['r4', 'r5'] }), { sources: 2 })],
        ['waits on you, P0, Later until Monday', chips(base({ pri: 'P0', when: 'later', later_until: '2026-11-09', wait: { id: 2, kind: 'ask', text: 'Which filter?', by: 'claude-code', files: [] } }), { laterOn: 'Mon' })],
        ['done and archived: no Later', chips(base({ status: 'done', archived: true, parent: null }))],
      ]}
    />
  ),
}

export const Editing: Story = {
  name: 'Editor',
  render: () => (
    <States
      tasks={[
        ['its own words', framed(() => <Editor it={base({})} kept={null} on={noTaskEvents} />)],
        ['what you typed before and did not save', framed(() => <Editor it={base({})} kept={{ title: 'Exports keep the filter', body: 'Started on this before.', next: '' }} on={noTaskEvents} />)],
      ]}
    />
  ),
}

const parentOf = (it: Task) => KIDS.map((k) => ({ ...k, parent: it.n }))
export const SubtaskStates: Story = {
  name: 'Subtasks',
  render: () => {
    const it = base({})
    return (
      <States
        tasks={[
          ['its subtasks, one done', framed(() => <Subtasks it={it} f={facts(it, { kids: parentOf(it) })} on={noTaskEvents} />)],
          ['adding one, a title started', framed(() => <Subtasks it={it} f={facts(it, { kids: parentOf(it), addingSub: true, subDraft: 'Name the file after the filter' })} on={noTaskEvents} />)],
          ['adding the first', framed(() => <Subtasks it={task({ n: 20, title: 'A new one' })} f={facts(task({ n: 20 }), { kids: [], addingSub: true })} on={noTaskEvents} />)],
        ]}
      />
    )
  },
}
