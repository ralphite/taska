import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { PROJECT_TONES } from '../../ui/tones'
import { DeskNav, PhoneIndex, type NavFacts } from './SettingsNav'

const meta: Meta = { title: 'Components/Settings/Navigation' }
export default meta
type Story = StoryObj

const f: NavFacts = { title: 'taska', tone: PROJECT_TONES[4], agentTone: 'ok', right: { agents: 'Claude Code ready', projects: 9, spellings: 3, organizer: 'Off', notifications: 'Off' } }
const on = { open() {}, back() {}, keys() {}, href: () => '#' }

/** The desktop's column of sections (Agents open), and the phone's index. */
export const Nav: Story = {
  render: () => (
    <div className="flex gap-6">
      <Frame layout="desk" width={240} height={560}>
        <div className="flex h-full flex-col">
          <DeskNav current="agents" back="New input" f={f} on={on} />
        </div>
      </Frame>
      <Frame layout="phone" width={393} height={560}>
        <div className="h-full bg-zinc-100 dark:bg-zinc-950">
          <PhoneIndex f={f} on={on} />
        </div>
      </Frame>
    </div>
  ),
}
