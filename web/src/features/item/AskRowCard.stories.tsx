// B749 / F750 (D132): an agent's questions in a row, one card: the page's own card (AskRowCard), each send answered
// here as Taska would (the reply goes on the item, naming the questions it answers; the others keep waiting).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AskRowCard } from './AskRowCard'
import { askRowOf } from '../../model/talk'
import type { Item, Message } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { item, message, modelOf } from '../../stories/fixtures'
import { noItemEvents, talkEnv } from '../../stories/itemFixtures'

export default { title: 'Item/Questions in a row (B749)' } satisfies Meta
type Story = StoryObj

const by = { by: 'claude-code', ses: 'Shop project work' }
const QS: Message[] = [
  message({ id: 1, kind: 'ask', ...by, text: '选了答案后，自动翻到下一个问题吗？\n- ( ) 自动翻到下一个\n- ( ) 每页按 Next' }),
  message({ id: 2, kind: 'ask', ...by, text: '允许只答一部分就发吗？\n- ( ) 允许，没答的继续等 Yadong\n- ( ) 全部答完才能发' }),
  message({ id: 3, kind: 'ask', ...by, text: '原型里还想看到哪种情况？' }),
]
const reply = (id: number, of: number[], text: string) => message({ id, by: 'you', kind: 'say', text, of })
const PART = reply(4, [1, 2], '- 选了答案后，自动翻到下一个问题吗？ → ✓ 自动翻到下一个\n- 允许只答一部分就发吗？ → ✓ 允许，没答的继续等 Yadong')
const REST = reply(5, [3], '- 原型里还想看到哪种情况？ → 只答一部分就发的样子')

/** what still waits: the latest question no reply named */
const waitOf = (thread: readonly Message[]) => {
  const named = new Set(thread.flatMap((x) => x.of ?? []))
  const w = QS.filter((x) => !named.has(x.id)).at(-1)
  return w ? { id: w.id, kind: 'ask' as const, text: w.text, by: w.by, ses: w.ses, files: [] } : null
}

function Live({ desk, start, status = 'open' }: { desk: boolean; start: readonly Message[]; status?: Item['status'] }) {
  const [thread, setThread] = useState<Message[]>([...QS, ...start])
  const it: Item = item({ n: 1, status, thread, wait: waitOf(thread) })
  const row = askRowOf(thread, 1)!
  const on = { ...noItemEvents, sendRow: (_n: number, of: number[], text: string) => setThread((t) => [...t, reply(t.length + 10, of, text)]) }
  return <AskRowCard it={it} row={row} env={talkEnv(modelOf([it]), desk)} on={on} />
}

const at = (start: readonly Message[] = [], status?: Item['status']): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => (
        <div className="p-3">
          <Live desk={layout === 'desk'} start={start} status={status} />
        </div>
      )}
    </Frames>
  ),
})

export const ThreeQuestionsTheFirstOpen: Story = { ...at(), name: 'Three questions, the first open' }
export const TwoSentTheOneInWordsWaits: Story = { ...at([PART]), name: 'Two sent, the one in words still waits' }
export const AllSent: Story = { ...at([PART, REST]), name: 'All sent' }
export const ProposedApproveBeside: Story = { ...at([], 'proposed'), name: 'Proposed: Approve beside, the phone turns by the pages' }
