// A rule's row, and an archived row, swiped on the phone: a rule has no Later and no Done, an archived row only
// comes back.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { swiped } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/Swiping on the phone/Rules and archived rows' } satisfies Meta
type Story = StoryObj

export const ProposedRuleForward: Story = { ...swiped({ it: { type: 'rule', status: 'proposed', by: 'claude-code', title: 'Screenshots go in the item' } }, 140), name: 'A proposed rule forward: Approve' }
export const ProposedRuleBack: Story = { ...swiped({ it: { type: 'rule', status: 'proposed', by: 'claude-code', title: 'Screenshots go in the item' } }, -160), name: "A proposed rule back: Won't do" }
export const RuleBack: Story = { ...swiped({ it: { type: 'rule', title: 'Commit messages are in English' } }, -160), name: 'An active rule back: Retire' }
export const RetiredRuleBack: Story = { ...swiped({ it: { type: 'rule', status: 'dropped', title: 'Screenshots go in the chat' } }, -160), name: 'A retired rule back: Reactivate' }
export const RetiredRuleForward: Story = { ...swiped({ it: { type: 'rule', status: 'dropped', title: 'Screenshots go in the chat' } }, 140), name: 'A retired rule forward: Archive' }
export const ArchivedBack: Story = { ...swiped({ it: { status: 'done', archived: true } }, -160), name: 'An archived row back: Unarchive' }
