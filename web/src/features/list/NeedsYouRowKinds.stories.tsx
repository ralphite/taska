// A row that needs you, by what it needs: a question, a checklist, proposed, waits for review, a change to the rules
// proposed (I693).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { T } from '../../stories/fixtures'
import { Frames } from '../../stories/Frames'
import { ask, one, question } from '../../stories/needsYouRowFixtures'
import { ProposalRow } from './ListRows'

export default { title: 'UI/List pane/Needs-you row/By what it needs' } satisfies Meta

export const Question = one(question)
export const ChecklistQuestion: StoryObj = { ...one({ it: ask('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'), excerpt: 'Which formats should the export offer?' }), name: 'A checklist question' }
export const Proposed = one({ it: { status: 'proposed', by: 'claude-code' }, excerpt: 'Proposed by Claude Code' })
export const WaitsForReview: StoryObj = { ...one({ it: { status: 'review' }, excerpt: 'Done: the export keeps the filter now' }), name: 'Waits for review' }
/** An agent's change to the rules waits on you: first in Needs you; View opens it, its changes marked (I693) */
export const RulesProposed: StoryObj = {
  name: 'A change to the rules proposed',
  render: () => (
    <Frames height={120} deskWidth={460} phoneWidth={393}>
      {() => <ProposalRow p={{ id: 7, by: 'claude-code', t: T, why: 'Run the unit tests before each commit', state: 'wait', on: 8, comments: [] }} who="Claude Code" onOpen={fn()} />}
    </Frames>
  ),
}
