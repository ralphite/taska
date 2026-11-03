// The Archive and Rules tabs.
import type { Meta } from '@storybook/react-vite'
import { item } from '../../stories/fixtures'
import { view } from '../../stories/itemListFixtures'
import { PROJECT } from '../../stories/listFixtures'

export default { title: 'Components/Item list/Views/Archive and Rules' } satisfies Meta

export const Archive = view('archive', {})
export const Rules = view('rules', {})
// ---- more states (T639)
/** Rules with one retired: its own group at the end, the rule struck through and faded */
export const RulesWithARetiredOne = { ...view('rules', {}, [...PROJECT, item({ n: 13, type: 'rule', status: 'dropped', title: 'Screenshots go in the chat' })]), name: 'Rules, one retired' }
