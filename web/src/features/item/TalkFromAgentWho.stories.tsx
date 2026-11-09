// From Claude Code and Codex (by their icons, then the session, T711), from an agent without an icon (by name), and from
// the organizer (with an input from another item).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { input, item, message } from '../../stories/fixtures'
import { at } from '../../stories/talkFromAgentFixtures'

export default { title: 'UI/Item pane/Talk/Message/From an agent/Who sent it' } satisfies Meta
type Story = StoryObj

export const FromCodex: Story = { ...at([message({ id: 2, by: 'codex', ses: 'tests', text: 'The export tests pass with three filters.' })]), name: 'From Codex' }
/** A session named at length: cut at the message's width (T711). */
export const LongSession: Story = { ...at([message({ id: 2, ses: 'Rewrite the export so it keeps the filter, the sort and t', text: 'The export keeps the filter now.' })]), name: 'A long session name' }
/** An agent without an app icon: by its name, then its session. */
export const FromAnAgentWithoutAnIcon: Story = { ...at([message({ id: 2, by: 'antigravity', ses: 'Docs pass', text: 'The docs say how the filter is kept.' })]), name: 'From an agent without an icon' }
export const FromTheOrganizer: Story = { ...at([message({ id: 2, by: 'org', kind: 'say', src: 'r4', text: 'Added to F012: keep the filter' })]), name: 'From the organizer' }
export const FromTheOrganizerInputFromAnotherItem: Story = {
  ...at([message({ id: 2, by: 'org', kind: 'say', src: 'r4', text: 'Added to F012: keep the filter' })], {
    inputs: [input({ id: 'r4', text: 'Keep the filter, and the sort.', scope: 13 })],
    others: [item({ n: 13, title: 'Export options' })],
  }),
  name: 'From the organizer, input from another item',
}
