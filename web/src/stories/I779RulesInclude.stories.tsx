// I779 prototype (D134): shared rules put into a project's rules by a line of its text. Taska's rules document starts
// with the lines {{通用}} and {{编程}}; each reads as a block that opens its text in place, and the rest is the
// document as the Rules tab reads it today. Editing, the lines are words like the rest, and Insert shared rules writes
// one where the caret is. A name not found is red. Settings › Shared rules lists the shared documents; one opens as the
// Rules tab's document (Edit, comments, History) with the projects that use it under it, read only. Last, the text an
// agent gets. Only the new pieces are drawn here (stories/i779/rulesInclude.tsx); the rest is the page's own Rules tab
// and Settings, as their stories draw them. Nothing here changes Taska.
import { useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RulesEditing, RulesReading } from '../features/docs/RulesScreens'
import { when } from '../model/time'
import { acts } from './acts'
import { envOf } from './docPage'
import { modelOf } from './fixtures'
import { Frame, Frames } from './Frames'
import { AgentReads, RulesEditor, RulesWithLines, SHARED_KEY, TASKA_BROKEN, TASKA_RULES, sharedSection, taskaSub } from './i779/rulesInclude'
import { one } from './sectionsFixtures'
import { settingsAt } from './settingsFixtures'

export default { title: 'Prototype/I779 Rules include', parameters: { layout: 'fullscreen' } } satisfies Meta
type Story = StoryObj

const on = acts('Rules', ['history', 'copy', 'edit', 'leave'] as const, { edit: 'Prototype › I779 Rules include › Editing: the lines as text' })
const env = (desk: boolean) => envOf(modelOf([]), desk)
const NOW = env(true).now
const sub = taskaSub((t) => when(t, NOW))

/** as the Rules tab's own stories frame it (UI › Rules tab › Screens) */
const screens = (draw: (desk: boolean) => ReactNode): Story => ({
  render: () => <Frames height={852} deskWidth={1000} phoneWidth={393}>{(layout) => <div className="flex h-full flex-col">{draw(layout === 'desk')}</div>}</Frames>,
})
const reading = (md: string, open: string[]) =>
  screens((desk) => <RulesReading f={{ desk, place: '' }} sub={sub} proposals={[]} doc={<RulesWithLines md={md} desk={desk} world={env(desk).world} open={open} />} on={on} />)

function Editing({ desk, md, picking = false }: { desk: boolean; md: string; picking?: boolean }) {
  const [why, setWhy] = useState('')
  return <RulesEditing f={{ desk, place: '' }} why={why} editor={<RulesEditor desk={desk} start={md} picking={picking} />} on={{ why: setWhy, leave: on.leave }} />
}

// ---------------------------------------------------------------- a project's Rules tab

/** Taska's rules: {{通用}} closed, {{编程}} opened in place (a click on a block opens or closes it; its name goes to
 * that document in Settings › Shared rules), then Taska's own sections as the tab reads them today. */
export const Reading: Story = { ...reading(TASKA_RULES, ['编程']), name: 'Reading: shared rules in place' }

/** Edit: the whole text in the page's editor; the lines are words like the rest (moved, removed or written by hand,
 * by Yadong or an agent's proposal). */
export const EditingLines: Story = { ...screens((desk) => <Editing desk={desk} md={TASKA_RULES} />), name: 'Editing: the lines as text' }

/** Insert shared rules: the shared documents (编程 also by its sections), those already in the text ticked; a pick
 * writes its line where the caret is (here: before Taska's own rules), on a line of its own. */
export const EditingInsert: Story = { ...screens((desk) => <Editing desk={desk} md={TASKA_RULES} picking />), name: 'Editing: insert shared rules' }

// ---------------------------------------------------------------- Settings › Shared rules

/** Shared rules, after Organizer: each document's name, how many projects use it, when it last changed; New first. A
 * row opens it. */
export const SettingsList: Story = { ...one(SHARED_KEY, sharedSection()), name: 'Settings: shared rules' }

/** 编程 opened: read as the Rules tab reads its document (its comments as on any document), History, Copy, Edit (the
 * same editor); under it the projects that use it and the line each has, read only: a row goes to that project's
 * Rules. The phone opens it over the list, as a document. */
export const SettingsOpened: Story = { ...one(SHARED_KEY, sharedSection('编程')), name: 'Settings: one opened' }

/** The phone's list of Settings' sections, Shared rules last. */
export const PhoneSettingsList: Story = { name: 'Settings: the phone’s list of sections', render: () => <Frames desk={false}>{() => settingsAt(null, false, sharedSection())}</Frames> }

// ---------------------------------------------------------------- a name not found

/** {{编程X}}: no shared rules by that name; the block says so in red (an agent reading the rules is told the same). */
export const NotFoundReading: Story = { ...reading(TASKA_BROKEN, []), name: 'Not found: reading' }

/** While writing: the name not found, in red beside the buttons; it goes once the line is right. */
export const NotFoundEditing: Story = { ...screens((desk) => <Editing desk={desk} md={TASKA_BROKEN} />), name: 'Not found: editing' }

// ---------------------------------------------------------------- what an agent reads

/** What `rules` gives Taska's agents: each line replaced by its text, each of its headings saying it came from the
 * shared rules, and first that the project's own words win. For reference only. */
export const AgentText: Story = {
  name: 'What an agent reads',
  render: () => (
    <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="desk" width={1000} label="what an agent reads">
        <AgentReads world={env(true).world} />
      </Frame>
    </div>
  ),
}
