// An agent's message by what it is: progress, a reply, a note to another session, a finished report, a proposal, a decision, blocked.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { you } from '../../stories/itemPage'
import { at, later } from '../../stories/talkFromAgentFixtures'

export default { title: 'Components/Conversation/Message/From an agent/Kinds of message' } satisfies Meta
type Story = StoryObj

export const Progress = at([message({ id: 2 })])
export const Reply = at([you(1, 'Does it keep the sort too?'), message({ id: 2, kind: 'say', text: 'Yes: the export writes the rows in the order the list shows.', t: later(2) })])
export const ToAnotherSession: Story = { ...at([message({ id: 2, to: ['worker-b'], text: '@worker-b take the tests for the export' })]), name: 'To another session (→ worker)' }
export const FinishedReport: Story = { ...at(
  [message({ id: 6, text: '**Result**: the export writes the rows the list shows.\n\n**How to check**: filter the list, then Export.\n\n**What changed**\n- the export reads the list\n- the file name says the filter' })],
  {},
  { status: 'review' },
), name: 'Finished: its report' }
export const Proposal = at([message({ id: 2, kind: 'propose', text: 'Put the filter in the file name.' }), { ...message({ id: 3, text: 'Started on it.' }), t: later(3) }])
export const Decision = at([message({ id: 2, kind: 'decide', text: 'CSV it is; Excel later (F016).' })])
export const BlockedAnsweredSince: Story = { ...at([message({ id: 2, kind: 'block', text: 'I need the API key for staging.' }), { ...you(3, 'It is in the vault, under staging.'), t: later(4) }]), name: 'Blocked (answered since)' }
