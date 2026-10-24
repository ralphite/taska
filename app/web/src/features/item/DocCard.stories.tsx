import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { T } from '../../stories/fixtures'
import { comment, doc } from '../../stories/itemFixtures'
import { DocCard } from './DocCard'

const meta: Meta = { title: 'Components/Item/Document card' }
export default meta
type Story = StoryObj

const now = Date.parse(T) + 60_000
const card = (d: Parameters<typeof DocCard>[0]['d'], waiting = '') => (
  <div className="p-3">
    <DocCard d={d} now={now} waiting={waiting} onOpen={() => {}} />
  </div>
)

/** A document on an item: plain, with comments, a web page, choices ticked and not sent, a long title. */
export const Cards: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={560}>
      {() => (
        <States
          items={[
            ['no comments', card(doc({ d: 1, n: 12 }))],
            ['two comments', card(doc({ d: 2, n: 12, blocks: [{ key: 'k1', kind: 'para', text: 'x', comments: [comment({ id: 1 }), comment({ id: 2, by: 'codex' })] }] }))],
            ['a web page', card(doc({ d: 3, n: 12, fmt: 'html', title: 'Mock-up of the export dialog' }))],
            ['choices not sent', card(doc({ d: 4, n: 12 }), '2 choices not sent')],
            ['a long title', card(doc({ d: 5, n: 12, title: '自行全面测试并修复网页文档的所有 bug，包括评论、选区、截图和导出' }))],
          ]}
        />
      )}
    </Frames>
  ),
}
