// A row that waits on you, one story for each kind (T591: the groups and names Yadong had before the rewrite): the
// page's own NeedsRow with its one action on the right, on the phone and the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frames, States } from '../../stories/Frames'
import { facts, item, look, noRowEvents } from '../../stories/fixtures'
import { NeedsRow, type RowFacts, type RowLook } from './ListRows'

export default { title: 'Components/Item list/Needs-you row' } satisfies Meta
type Story = StoryObj

interface Row {
  it: Partial<Item>
  excerpt?: string
  f?: Partial<RowFacts>
  l?: Partial<RowLook>
}

const ask = (text: string, by = 'claude-code'): Partial<Item> => ({ wait: { id: 4, kind: 'ask', text, by, files: [] } })
const row = (r: Row, desk: boolean) => <NeedsRow it={item({ n: 12, ...r.it })} depth={0} facts={facts(r.f)} look={look(desk, r.l)} excerpt={r.excerpt ?? ''} on={noRowEvents} />
const one = (r: Row): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={460}>{(layout) => row(r, layout === 'desk')}</Frames> })
const question: Row = { it: ask('Keep the old export for a while?'), excerpt: 'Keep the old export for a while?' }

/** Under the pointer, open in the pane, picked, dragged and where a dragged row would go, together. */
export const Together: Story = {
  name: 'Pointer, keys, picked, dragged: all side by side',
  parameters: { pseudo: { hover: ['[data-pointer] .group'] } },
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['under the pointer', <div data-pointer>{row(question, desk)}</div>],
              ['open in the pane (where the keys are)', row({ ...question, l: { current: true } }, desk)],
              ['picked', row({ ...question, l: { selected: true } }, desk)],
              ['dragged', row({ ...question, l: { drag: 'dragging' } }, desk)],
              ['a dragged row would go under it', row({ ...question, l: { drag: 'into' } }, desk)],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

export const Question = one(question)
export const ChecklistQuestion = one({ it: ask('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'), excerpt: 'Which formats should the export offer?' })
export const Blocked = one({ it: { status: 'doing', wait: { id: 4, kind: 'block', text: 'I need the API key for staging', by: 'codex', files: [] } }, excerpt: 'I need the API key for staging' })
export const Proposed = one({ it: { status: 'proposed', by: 'claude-code' }, excerpt: 'Proposed by Claude Code' })
export const WaitsForReview = one({ it: { status: 'review' }, excerpt: 'Done: the export keeps the filter now' })
export const RuleProposed = one({ it: { n: 15, type: 'rule', status: 'proposed', title: 'Screenshots go in the item' }, f: { code: 'R015' } })
export const LaterPartOfAnother: Story = { ...one({ it: { n: 14, status: 'proposed', when: 'later', parent: 3 }, excerpt: 'Split from F003', f: { code: 'F014', parentCode: 'F003' } }), name: 'Later, part of another item' }
