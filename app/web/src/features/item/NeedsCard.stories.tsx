import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frames, States } from '../../stories/Frames'
import { item, message, modelOf } from '../../stories/fixtures'
import { noItemEvents, talkEnv } from '../../stories/itemFixtures'
import { NeedsCard } from './NeedsCard'

const meta: Meta = { title: 'Components/Item/Needs card' }
export default meta
type Story = StoryObj

const proposal = message({ id: 5, kind: 'propose', text: 'Keep the filter in the export: the rows the list shows, and the filter in the file name.' })
const report = message({ id: 6, text: 'Done: the export writes the rows the list shows. Tested with three filters.' })
const ask = message({ id: 7, kind: 'ask', text: 'Which format should the export use?\n\n- ( ) CSV\n- ( ) Excel' })

function card(it: Item, desk: boolean, extra: Partial<Parameters<typeof NeedsCard>[0]> = {}) {
  const m = modelOf([it])
  return (
    <div className="p-3">
      <NeedsCard it={it} env={talkEnv(m, desk, extra.env ? extra.env : {})} on={noItemEvents} remodify={false} {...extra} />
    </div>
  )
}

/** What waits on you: a proposal, finished work, a question (open, picked), a question to answer in words, a block. */
export const Waiting: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['proposed: Won’t do · Approve', card(item({ n: 12, status: 'proposed', thread: [proposal] }), desk)],
              ['finished: Not yet · Accept', card(item({ n: 12, status: 'review', thread: [report] }), desk)],
              ['a question with choices', card(item({ n: 12, thread: [ask], wait: { id: 7, kind: 'ask', text: ask.text, by: 'claude-code', files: [] } }), desk)],
              ['a choice picked', card(item({ n: 12, thread: [ask], wait: { id: 7, kind: 'ask', text: ask.text, by: 'claude-code', files: [] } }), desk, { env: talkEnv(modelOf([]), desk, { choosing: { picked: new Set([1]), pick: () => {} } }) })],
              ['a question to answer below', card(item({ n: 12, wait: { id: 8, kind: 'ask', text: 'Should the old export stay for a while?', by: 'codex', ses: 'tests', files: [] } }), desk)],
              ['blocked', card(item({ n: 12, status: 'doing', wait: { id: 9, kind: 'block', text: 'I need the API key for staging.', by: 'codex', files: [] } }), desk)],
              ['proposed and asked: Approve beside the answer', card(item({ n: 12, status: 'proposed', thread: [ask], wait: { id: 7, kind: 'ask', text: ask.text, by: 'claude-code', files: [] } }), desk)],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

/** What you decided: grey, your choice ticked, Modify; Modify open; you replied instead of deciding. */
export const Decided: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const desk = layout === 'desk'
        const approved = item({ n: 12, status: 'open', thread: [proposal], decided: { from: 'proposed', to: 'open', msg: 5, t: '' } })
        return (
          <States
            items={[
              ['approved', card(approved, desk)],
              ['won’t do', card(item({ n: 12, status: 'dropped', thread: [proposal], decided: { from: 'proposed', to: 'dropped', msg: 5, t: '' } }), desk)],
              ['accepted', card(item({ n: 12, status: 'done', thread: [report], decided: { from: 'review', to: 'done', msg: 6, t: '' } }), desk)],
              ['not yet', card(item({ n: 12, status: 'doing', thread: [report], decided: { from: 'review', to: 'doing', msg: 6, t: '' } }), desk)],
              ['Modify open', card(approved, desk, { remodify: true })],
              ['you replied instead', card(item({ n: 12, status: 'proposed', talked: true, thread: [proposal, message({ id: 9, by: 'you', kind: 'say', text: 'Only the filter, not the sort.' })] }), desk)],
            ]}
          />
        )
      }}
    </Frames>
  ),
}
