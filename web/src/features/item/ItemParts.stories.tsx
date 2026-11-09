// The parts of an item's page above its talk, each alone: its chips, its editor, its subitems (ItemPage puts them
// together; its stories show them in place).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { Frames, States } from '../../stories/Frames'
import { item, modelOf } from '../../stories/fixtures'
import { itemFacts, noItemEvents } from '../../stories/itemFixtures'
import { KIDS, PARENT } from '../../stories/itemPage'
import { base } from '../../stories/itemPageFixtures'
import type { Item } from '../../model/types'
import { Chips, Editor, Subitems } from './ItemParts'
import type { ItemFacts } from './ItemPage'

export default { title: 'UI/Item pane/Parts' } satisfies Meta
type Story = StoryObj

const facts = (it: Item, f: Partial<ItemFacts> = {}, others: Item[] = [PARENT]) => itemFacts(modelOf([it, ...others]), it, f)
const framed = (node: (desk: boolean) => ReactNode) => (
  <Frames phoneWidth={393} deskWidth={720}>
    {(layout) => <div className="p-4">{node(layout === 'desk')}</div>}
  </Frames>
)

const chips = (it: Item, f: Partial<ItemFacts> = {}) =>
  framed(() => (
    <div className="flex flex-wrap items-center gap-2">
      <Chips it={it} f={facts(it, f)} on={noItemEvents} />
    </div>
  ))

export const ChipStates: Story = {
  name: 'Chips',
  render: () => (
    <States
      items={[
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
      items={[
        ['its own words', framed(() => <Editor it={base({})} kept={null} on={noItemEvents} />)],
        ['what you typed before and did not save', framed(() => <Editor it={base({})} kept={{ title: 'Exports keep the filter', body: 'Started on this before.', next: '' }} on={noItemEvents} />)],
      ]}
    />
  ),
}

const parentOf = (it: Item) => KIDS.map((k) => ({ ...k, parent: it.n }))
export const SubitemStates: Story = {
  name: 'Subitems',
  render: () => {
    const it = base({})
    return (
      <States
        items={[
          ['its subitems, one done', framed(() => <Subitems it={it} f={facts(it, { kids: parentOf(it) })} on={noItemEvents} />)],
          ['adding one, a title started', framed(() => <Subitems it={it} f={facts(it, { kids: parentOf(it), addingSub: true, subDraft: 'Name the file after the filter' })} on={noItemEvents} />)],
          ['adding the first', framed(() => <Subitems it={item({ n: 20, title: 'A new one' })} f={facts(item({ n: 20 }), { kids: [], addingSub: true })} on={noItemEvents} />)],
        ]}
      />
    )
  },
}
