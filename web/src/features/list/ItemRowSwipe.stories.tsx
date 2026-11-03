// A row swiped on the phone: forward to its next step, back to the others.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { agent, swiped } from '../../stories/itemRowFixtures'
import { askOf } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item list/Item row/Swiping on the phone' } satisfies Meta
type Story = StoryObj

export const SwipingForward: Story = { ...swiped({ it: { status: 'doing', agent } }, 140), name: 'Swiping forward' }
export const SwipingBack: Story = { ...swiped({ it: { status: 'review' } }, -160), name: 'Swiping back' }
// ---- more states (T639): every row's swipe, forward and back
export const ForwardAnswer: Story = { ...swiped({ it: { wait: askOf('Which format should the export use?') } }, 140), name: 'Forward on a question: Answer' }
export const ForwardApprove: Story = { ...swiped({ it: { status: 'proposed', by: 'claude-code' } }, 140), name: 'Forward on a proposal: Approve' }
export const ForwardAccept: Story = { ...swiped({ it: { status: 'review' } }, 140), name: 'Forward on finished work: Accept' }
export const ForwardSubitemsOpen: Story = { ...swiped({ it: { status: 'doing', agent }, f: { kids: { done: 1, all: 3 }, openKids: 2 }, foldable: true }, 140), name: 'Forward to Done: subitems still open' }
export const FinishedForward: Story = { ...swiped({ it: { status: 'done' } }, 140), name: 'A finished row forward: Archive' }
export const FinishedBack: Story = { ...swiped({ it: { status: 'done' } }, -160), name: 'A finished row back: Reopen' }
export const ArchivedBack: Story = { ...swiped({ it: { status: 'done', archived: true } }, -160), name: 'An archived row back: Unarchive' }
export const RuleBack: Story = { ...swiped({ it: { type: 'rule', title: 'Commit messages are in English' } }, -160), name: 'A rule back: Retire' }
export const RetiredRuleBack: Story = { ...swiped({ it: { type: 'rule', status: 'dropped', title: 'Screenshots go in the chat' } }, -160), name: 'A retired rule back: Reactivate' }
export const ProposedRuleBack: Story = { ...swiped({ it: { type: 'rule', status: 'proposed', by: 'claude-code', title: 'Screenshots go in the item' } }, -160), name: "A proposed rule back: Won't do" }
export const WaitingBack: Story = { ...swiped({ it: { wait: askOf('Which format should the export use?') } }, -220), name: "A question back: Won't do, Later, Done" }
