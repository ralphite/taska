import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { item, message, modelOf } from '../../stories/fixtures'
import { comment, doc, itemFacts, noItemEvents, talkEnv, talkFacts } from '../../stories/itemFixtures'
import { ItemActs, ItemHead, ItemNav, ItemPage, Missing, NoSelection } from './ItemPage'
import type { ItemFacts } from './ItemPage'
import { PaneFrame } from './PaneFrame'

const meta: Meta = { title: 'Components/Item/Item page' }
export default meta
type Story = StoryObj

const parent = item({ n: 3, title: 'Exports that keep what you see' })
const kids = [item({ n: 14, parent: 12, title: 'Keep the filter in the file name' }), item({ n: 15, parent: 12, status: 'done', title: 'Write the rows the list shows' }), item({ n: 16, parent: 12, when: 'later', title: 'Excel as well' })]
const proposal = item({
  n: 12,
  status: 'proposed',
  parent: 3,
  pri: 'P1',
  body: 'The export writes **every** row; it should write the rows the list shows.\n\n- with the filter\n- with the sort',
  next: 'Read the filter from the address',
  srcs: ['r4'],
  thread: [message({ id: 1, by: 'you', kind: 'say', text: 'The export should keep the filter I set.' }), message({ id: 2, kind: 'propose', text: 'Keep the filter in the export, and its name in the file name.' })],
})
const docs = [doc({ d: 1, n: 12, blocks: [{ key: 'k1', kind: 'para', text: 'x', comments: [comment({ id: 9 })] }] })]

function page(it: Item, desk: boolean, f: Partial<ItemFacts> = {}) {
  const m = modelOf([parent, it, ...kids], [], {}, docs)
  const facts = itemFacts(m, it, f)
  return (
    <div className="flex h-full flex-col">
      <PaneFrame
        place=""
        desk={desk}
        split
        menu
        head={<ItemHead it={it} code={facts.code(it.n)} />}
        acts={<ItemActs it={it} on={noItemEvents} />}
        nav={<ItemNav full={false} on={{ prev: () => {}, next: () => {}, full: () => {} }} />}
        onBack={() => {}}
      >
        <ItemPage it={it} f={facts} env={talkEnv(m, desk)} facts={talkFacts(m)} on={noItemEvents} />
      </PaneFrame>
    </div>
  )
}

/** A proposal on its page: its fields, text and next step, its document and subitems, and the card in its talk. */
export const Proposal: Story = {
  render: () => <Frames phoneWidth={393} deskWidth={900} height={1000}>{(layout) => page(proposal, layout === 'desk', { sources: 1 })}</Frames>,
}

/** In progress, Later, archived; its talk past eight messages (Show earlier). */
export const Others: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={760}>
      {(layout) =>
        page(
          item({ n: 12, status: 'doing', when: 'later', archived: true, type: 'bug', pri: 'P0', title: 'Saving drops the last word', thread: Array.from({ length: 11 }, (_, i) => message({ id: i + 1, text: `Step ${i + 1} done.` })) }),
          layout === 'desk',
        )
      }
    </Frames>
  ),
}

/** Editing its title, text and next step; adding a subitem. */
export const Editing: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={760}>
      {(layout) => page(item({ n: 12, title: 'Export ignores the active filter', body: 'The rows.' }), layout === 'desk', { editing: true, addingSub: true })}
    </Frames>
  ),
}

/** The pane with nothing open, and with an item that is not here. */
export const Empty: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720} height={240}>
      {() => (
        <div className="grid h-full grid-cols-2 divide-x divide-zinc-200">
          <NoSelection side={null} />
          <Missing what="F099" loading={false} away={false} />
        </div>
      )}
    </Frames>
  ),
}
