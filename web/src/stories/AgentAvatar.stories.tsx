// An agent's avatar (T591: Icons and marks > Agent avatar): the page's own Avatar for every agent the page names, the
// organizer, and someone it does not know.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { whoName } from '../model/words'
import { Avatar } from '../ui/bits'
import { Frames } from './Frames'

export default { title: 'Components/Icons and marks/Agent avatar' } satisfies Meta
type Story = StoryObj

export const Agents: Story = {
  name: 'Every agent',
  render: () => (
    <Frames phoneWidth={393} deskWidth={480}>
      {() => (
        <div className="flex flex-col gap-2 p-3">
          {['claude-code', 'codex', 'antigravity', 'gemini', 'org', 'someone'].map((by) => (
            <div key={by} className="flex items-center gap-2 text-sm">
              <Avatar by={by} />
              <span>{whoName(by)}</span>
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}
