// From Codex, and from the organizer (with an input from another item).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { input, item, message } from '../../stories/fixtures'
import { at } from '../../stories/talkFromAgentFixtures'

export default { title: 'UI/Item pane/Talk/Message/From an agent/Who sent it' } satisfies Meta
type Story = StoryObj

export const FromCodex: Story = { ...at([message({ id: 2, by: 'codex', ses: 'tests', text: 'The export tests pass with three filters.' })]), name: 'From Codex' }
export const FromTheOrganizer: Story = { ...at([message({ id: 2, by: 'org', kind: 'say', src: 'r4', text: 'Added to F012: keep the filter' })]), name: 'From the organizer' }
export const FromTheOrganizerInputFromAnotherItem: Story = {
  ...at([message({ id: 2, by: 'org', kind: 'say', src: 'r4', text: 'Added to F012: keep the filter' })], {
    inputs: [input({ id: 'r4', text: 'Keep the filter, and the sort.', scope: 13 })],
    others: [item({ n: 13, title: 'Export options' })],
  }),
  name: 'From the organizer, input from another item',
}
