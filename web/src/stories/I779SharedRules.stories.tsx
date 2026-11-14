// I779 prototype (approved idea: shared rule groups): rules shared across projects, written once. Groups live in
// Settings › Shared rules (All projects, Coding, Writing), each its text and the projects that include it; a project's
// Rules tab says what it includes (Change picks), reads each group's sections under a quiet label, then its own. An
// agent gets that as one text. Only the new pieces are drawn here (stories/i779/sharedRules.tsx); the rest is the
// page's own Settings and Rules tab, as their stories draw them. Nothing here changes Taska.
import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RulesReading } from '../features/docs/RulesScreens'
import { ruleWho } from '../model/rules'
import { when } from '../model/time'
import type { RuleVersion } from '../model/types'
import { acts } from './acts'
import { envOf } from './docPage'
import { modelOf } from './fixtures'
import { Frames } from './Frames'
import { SHARED, SHOP_HISTORY, SharedReading, withShared } from './i779/sharedRules'
import { one } from './sectionsFixtures'
import { settingsAt } from './settingsFixtures'

export default { title: 'Prototype/I779 Shared rule groups', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

// ---------------------------------------------------------------- Settings › Shared rules

/** Shared rules, after Organizer in Settings' column (the phone: its list of sections). */
export const PhoneSettingsList: Story = { name: 'Settings: the phone’s list of sections', render: () => <Frames desk={false}>{() => settingsAt(null, false, withShared())}</Frames> }

/** The groups: each its name, how many projects include it, when it last changed; New group. A row opens it. */
export const TheGroups: Story = { ...one(SHARED, withShared()), name: 'Settings: the groups' }

/** A group opened (Coding): its text as the Rules tab reads a document, Edit as the Rules tab's Edit; the projects,
 * each with its switch (Home and Shop include it, 读书笔记 does not). The phone opens it over the list, as a document. */
export const AGroupOpened: Story = { ...one(SHARED, withShared('coding')), name: 'Settings: a group opened' }

// ---------------------------------------------------------------- a project's Rules tab

const on = acts('Rules', ['history', 'copy', 'edit'] as const)
const NOW = envOf(modelOf([]), true).now
const x = SHOP_HISTORY.at(-1) as RuleVersion
const sub = `v${x.v} · ${ruleWho(x.by)} · ${when(x.t, NOW)}`

/** as the Rules tab's own stories frame it (UI › Rules tab › Screens) */
const screens = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames height={852} deskWidth={1000} phoneWidth={393}>{(layout) => <div className="flex h-full flex-col">{draw(layout === 'desk')}</div>}</Frames>,
})
const reading = (changing: boolean) => screens((desk) => <RulesReading f={{ desk, place: '' }} sub={sub} proposals={[]} doc={<SharedReading desk={desk} changing={changing} />} on={on} />)

/** Shop's rules: Includes All projects and Coding (a chip goes to its sections; Change picks); each group's sections
 * under its label (how many projects share it; Edit, in Settings), then Shop's own as today. */
export const IncludesTwoGroups: Story = { ...reading(false), name: 'Rules tab: includes two groups' }

/** Change: the groups to pick, the included ticked; a pick adds or takes away its sections at once. */
export const ChangeOpen: Story = { ...reading(true), name: 'Rules tab: Change open' }
