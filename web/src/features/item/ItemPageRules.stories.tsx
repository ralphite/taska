// A rule's page: in force, and proposed.
import type { Meta } from '@storybook/react-vite'
import { at } from '../../stories/itemPageFixtures'

export default { title: 'Components/Item page/By item status/Rules' } satisfies Meta

export const RuleInForce = at({ type: 'rule', parent: null, title: 'Commit messages are in English', body: 'Code, commit messages and docs are in English; Chinese only to talk with Yadong.', next: '', thread: [] })
export const RuleProposed = at({ type: 'rule', parent: null, status: 'proposed', by: 'claude-code', title: 'Screenshots go in the item', body: 'Every screenshot of a change is posted on its item, not only in the chat.', next: '', thread: [] })
