import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame, Hold } from '../../stories/Frames'
import { act } from '../../stories/acts'
import { CopyBtn, Loading, Part, PhHead, PhLabel, PH_GROUP, Setting, TextBox, Toggle } from './SettingsParts'

const meta: Meta = { title: 'UI/Settings and help/Settings/The page and its parts' }
export default meta
type Story = StoryObj

/** A part with text to copy, a setting with a switch, Loading; and the phone's head, label and group. */
export const Parts: Story = {
  name: "Its parts: a part to copy from, a setting with a switch, the phone's head and rows",
  render: () => (
    <div className="flex gap-6">
      <Frame layout="desk" width={620} height={520}>
        <div className="px-8 pt-6">
          <Part title="Link" about="Open on your phone">
            <TextBox t="https://taska.example/k/abc/p/home/" />
            <CopyBtn label="Copy link" onCopy={act('Settings: copy')} />
          </Part>
          <Setting title="Count on the app icon" about="What needs you, in every project." control={<Hold<boolean> start>{(on, set) => <Toggle on={on} label="Count on the app icon" onToggle={() => set(!on)} />}</Hold>} />
          <Loading />
        </div>
      </Frame>
      <Frame layout="phone" width={393} height={420}>
        <div className="h-full bg-zinc-100 dark:bg-zinc-950">
          <PhHead title="Settings" onBack={act('Settings: back')} />
          <PhLabel>All projects</PhLabel>
          <div className={PH_GROUP}>
            <div className="min-h-12 px-3.5 py-2.5 text-[15px]">Projects</div>
            <div className="min-h-12 px-3.5 py-2.5 text-[15px]">Use on your phone</div>
          </div>
        </div>
      </Frame>
    </div>
  ),
}
