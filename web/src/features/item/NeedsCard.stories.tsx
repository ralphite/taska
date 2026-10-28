// The card on an item that waits on you, one story for each kind and each answer: the page's own NeedsCard with that item's data, on the phone and the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, item, message, modelOf } from '../../stories/fixtures'
import { noItemEvents, talkEnv } from '../../stories/itemFixtures'
import { NeedsCard } from './NeedsCard'

export default { title: 'Components/Item page/Needs-you card' } satisfies Meta
type Story = StoryObj

const proposal = message({ id: 5, kind: 'propose', text: 'Keep the filter in the export: the rows the list shows, and the filter in the file name.' })
const report = message({ id: 6, text: 'Done: the export writes the rows the list shows. Tested with three filters.' })
const askOf = (text: string, kind: 'ask' | 'block' = 'ask', by = 'claude-code') => ({ id: 7, kind, text, by, files: [] })
const you = message({ id: 9, by: 'you', kind: 'say', text: 'Only the filter, not the sort.' })

const at = (f: Partial<Item>, o: { remodify?: boolean } = {}): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const it = item({ n: 12, ...f })
        return (
          <div className="p-3">
            <NeedsCard it={it} env={talkEnv(modelOf([it]), layout === 'desk')} on={noItemEvents} remodify={!!o.remodify} />
          </div>
        )
      }}
    </Frames>
  ),
})
const q = (text: string) => ({ thread: [message({ id: 7, kind: 'ask', text })], wait: askOf(text) })
const approved = { status: 'open' as const, thread: [proposal], decided: { from: 'proposed' as const, to: 'open' as const, msg: 5, t: T } }
const repliedOnProposal = { status: 'proposed' as const, talked: true, thread: [proposal, you] }

export const Question = at(q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel'))
export const ChecklistQuestion = at(q('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'))
export const Blocked = at({ status: 'doing', wait: askOf('I need the API key for staging.', 'block', 'codex') })
export const Proposal = at({ status: 'proposed', thread: [proposal] })
export const ProposedNothingSaid: Story = { ...at({ status: 'proposed', by: 'claude-code', thread: [] }), name: 'Proposed, nothing said' }
export const QuestionOnAProposal = at({ status: 'proposed', ...q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel') })
export const WaitsForReview = at({ status: 'review', thread: [report] })
export const RuleProposed = at({ type: 'rule', status: 'proposed', title: 'Screenshots go in the item', thread: [message({ id: 5, kind: 'propose', text: 'Every screenshot of a change is posted on its item.' })] })
export const ProposalApproved = at(approved)
export const ProposalApprovedPointerOnIt: Story = { ...at(approved), name: 'Proposal approved, pointer on it', parameters: { pseudo: { hover: true } } }
export const ProposalApprovedModifyPressed: Story = { ...at(approved, { remodify: true }), name: 'Proposal approved, Modify pressed' }
export const ProposalDeclined = at({ status: 'dropped', thread: [proposal], decided: { from: 'proposed', to: 'dropped', msg: 5, t: T } })
export const WorkAccepted = at({ status: 'done', thread: [report], decided: { from: 'review', to: 'done', msg: 6, t: T } })
export const WorkSentBack: Story = { ...at({ status: 'doing', thread: [report], decided: { from: 'review', to: 'doing', msg: 6, t: T } }), name: 'Work sent back (Not yet)' }
export const FinishedYouReplied: Story = { ...at({ status: 'review', talked: true, thread: [report, you] }), name: 'Finished, you replied' }
export const ProposalYouReplied: Story = { ...at(repliedOnProposal), name: 'Proposal, you replied' }
export const ProposalYouRepliedPointerOnApprove: Story = {
  ...at(repliedOnProposal),
  name: 'Proposal, you replied, pointer on Approve',
  parameters: { pseudo: { hover: ['button'] } },
}
