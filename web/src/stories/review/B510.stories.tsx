// T510 (#6652, #6730, #6738, #7013): a task the agent finished that also asks Yadong a question. Only its talk is
// drawn (#6730), with the tasks as the real server leaves them after the agent's and Yadong's commands.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TaskTalk } from '../../features/task/TaskPage'
import type { Task, Message } from '../../model/types'
import { Frames, States } from '../Frames'
import { T, input, task, message, modelOf } from '../fixtures'
import { taskFacts, noTaskEvents, talkEnv, talkFacts } from '../taskFixtures'
import { record, shown } from '../fixtures'

export default { title: 'Review/B510 Finished and asks you' } satisfies Meta
type Story = StoryObj

const at = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
const fixing = message({ id: 1, t: at(0) })
const report = (id: number, min: number) => message({ id, t: at(min), text: 'Done: the export writes the rows the list shows. Tested with three filters.' })
const ask = (id: number, min: number) => message({ id, t: at(min), kind: 'ask', text: 'Which format should the export use?\n- ( ) CSV\n- ( ) Excel' })
const waits = (x: Message): Task['wait'] => ({ id: x.id, kind: 'ask', text: x.text, by: x.by, files: [] })
const you = (id: number, min: number, text: string, src: string) => message({ id, t: at(min), by: 'you', kind: 'say', text, src })
const voice = shown(input({ id: 'r2', text: '', files: [{ f: 'f2-voice_0-09.webm', name: 'voice_0-09.webm', mime: 'audio/webm' }] }), record('f2-voice_0-09.webm', 'CSV for now, Excel later. And keep the sort too.', 'CSV for now, and Excel, Excel later. Oh and keep the sort too.'))

function talk(it: Task, desk: boolean) {
  const m = modelOf([it], [voice])
  return (
    <div className="flex flex-col gap-6 p-4">
      <TaskTalk it={it} f={taskFacts(m, it)} env={talkEnv(m, desk)} facts={talkFacts(m)} on={noTaskEvents} />
    </div>
  )
}

const cases = (list: [string, Task][]) => (
  <Frames phoneWidth={393} deskWidth={720}>
    {(layout) => <States tasks={list.map(([name, it]) => [name, talk(it, layout === 'desk')])} />}
  </Frames>
)

/** As the page is now, when the agent finished and then asked: one card, the question with Accept beside Send answer,
 * the finished work a message above it. Answered, the card says Submitted; replied instead, Skipped, and the reply
 * (here a voice note) comes after it, as it came after it. */
export const NowOneCard: Story = {
  render: () =>
    cases([
      ['finished, then asked: one card, Accept beside the answer', task({ n: 3, status: 'review', thread: [report(1, 0), ask(2, 0)], wait: waits(ask(2, 0)) })],
      ['answered by picking', task({ n: 3, status: 'review', talked: true, thread: [report(1, 0), ask(2, 0), you(3, 2, '✓ CSV', 'r1')] })],
      ['replied with a voice note instead: Skipped, the reply below', task({ n: 3, status: 'review', talked: true, thread: [report(1, 0), ask(2, 0), you(3, 2, voice.text, 'r2')] })],
    ]),
}

/** What R571 asks of agents: a question first, done after. Asked before finishing, only the question waits; answered,
 * the agent finishes and the finished work gets its own card under the answer. Finished and then a question came up:
 * the agent takes done back (doing again) and asks, so only the question waits. */
export const Option1AskFirstThenFinish: Story = {
  render: () =>
    cases([
      ['asked before finishing: only the question', task({ n: 3, status: 'open', thread: [fixing, ask(2, 1)], wait: waits(ask(2, 1)) })],
      ['answered, then finished: its own card under the answer', task({ n: 3, status: 'review', thread: [fixing, ask(2, 1), you(3, 2, '✓ CSV', 'r1'), report(4, 5)] })],
      ['finished, done taken back, then asked: only the question', task({ n: 3, status: 'open', thread: [report(1, 0), ask(2, 1)], wait: waits(ask(2, 1)) })],
    ]),
}
