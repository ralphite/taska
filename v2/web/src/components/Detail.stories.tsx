import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemPage, NeedsCard } from './Detail'
import { ask, item, load } from '../test/fixture'
import { byN } from '../lib/state'
import type { Msg, Wait } from '../lib/types'

const t = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const thread: Msg[] = [
  { id: 1, by: 'you', text: 'Exports should follow the filter I set.', t: t(90), src: null } as unknown as Msg,
  {
    id: 2,
    by: 'claude-code',
    kind: 'progress',
    text: 'Found it: the export reads the list before the filter applies.',
    t: t(60),
  } as unknown as Msg,
  {
    id: 3,
    by: 'claude-code',
    kind: 'ask',
    text: 'Which format should the export use?\n- ( ) CSV\n- ( ) JSON',
    t: t(30),
  } as unknown as Msg,
]
const setup = (n: number) => () => {
  load([
    item(1, {
      type: 'bug',
      title: 'Export ignores the filter',
      body: 'When a filter is set, **Export** still writes every row.',
      pri: 'P0',
      status: 'doing',
      thread,
      wait: { ...ask(1, thread[2].text), id: 3 } as unknown as Wait,
    }),
    item(2, {
      title: 'Write the user docs',
      status: 'review',
      thread: [
        {
          id: 4,
          by: 'codex',
          kind: 'progress',
          text: 'Done: the install page and the FAQ are in docs/.',
          t: t(5),
        } as unknown as Msg,
      ],
    }),
  ])
  return { n }
}
const meta: Meta = { title: 'Page/Item' }
export default meta

/** The item page: title, its properties, the conversation, what it needs from you at the end. */
export const Page: StoryObj = {
  loaders: [setup(1)],
  render: () => (
    <div className="h-[860px] max-w-[46rem] overflow-y-auto">
      <ItemPage it={byN.get(1)!} />
    </div>
  ),
}
/** The card an agent's question becomes: tap a choice, then Send answer. */
export const Question: StoryObj = {
  loaders: [setup(1)],
  render: () => (
    <div className="max-w-[40rem] p-4">
      <NeedsCard it={byN.get(1)!} />
    </div>
  ),
}
/** Finished work waits for you to accept it. */
export const Review: StoryObj = {
  loaders: [setup(2)],
  render: () => (
    <div className="max-w-[40rem] p-4">
      <NeedsCard it={byN.get(2)!} />
    </div>
  ),
}
