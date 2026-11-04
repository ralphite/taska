// A rule's page: in force, proposed, and retired (Reactivate brings it back).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at } from '../../stories/itemPageFixtures'

export default { title: 'Components/Item page/By item status/Rules' } satisfies Meta

export const RuleInForce: StoryObj = { ...at({ type: 'rule', parent: null, title: 'Commit messages are in English', body: 'Code, commit messages and docs are in English; Chinese only to talk with Yadong.', next: '', thread: [] }), name: 'A rule in force' }
export const RuleProposed: StoryObj = { ...at({ type: 'rule', parent: null, status: 'proposed', by: 'claude-code', title: 'Screenshots go in the item', body: 'Every screenshot of a change is posted on its item, not only in the chat.', next: '', thread: [] }), name: 'A rule proposed' }
/** Retired: no longer in force; its bar's Reactivate (D) puts it back. */
export const RuleRetired: StoryObj = { ...at({ type: 'rule', parent: null, status: 'dropped', title: 'Screenshots go in the chat', body: 'Every screenshot of a change is posted in the chat.', next: '', thread: [] }), name: 'A rule retired' }
