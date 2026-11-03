// A row that needs you, by what it needs: a question, a checklist, blocked, proposed, waits for review, a rule proposed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ask, one, question } from '../../stories/needsYouRowFixtures'

export default { title: 'Components/Item list/Needs-you row/By what it needs' } satisfies Meta

export const Question = one(question)
export const ChecklistQuestion: StoryObj = { ...one({ it: ask('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'), excerpt: 'Which formats should the export offer?' }), name: 'A checklist question' }
export const Blocked = one({ it: { status: 'open', wait: { id: 4, kind: 'block', text: 'I need the API key for staging', by: 'codex', files: [] } }, excerpt: 'I need the API key for staging' })
export const Proposed = one({ it: { status: 'proposed', by: 'claude-code' }, excerpt: 'Proposed by Claude Code' })
export const WaitsForReview: StoryObj = { ...one({ it: { status: 'review' }, excerpt: 'Done: the export keeps the filter now' }), name: 'Waits for review' }
export const RuleProposed: StoryObj = { ...one({ it: { n: 15, type: 'rule', status: 'proposed', title: 'Screenshots go in the item' }, f: { code: 'R015' } }), name: 'A rule proposed' }
