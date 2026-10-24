import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { CopyBtn, Loading, Part, PhHead, PhLabel, PhNote, PH_GROUP, Setting, TextBox, Toggle } from './SettingsParts'

const meta: Meta = { title: 'Components/Settings/Parts' }
export default meta
type Story = StoryObj

/** A part with text to copy, a setting with a switch, Loading; and the phone's head, label, group and note. */
export const Parts: Story = {
  render: () => (
    <div className="flex gap-6">
      <Frame layout="desk" width={620} height={520}>
        <div className="px-8 pt-6">
          <Part title="Link" about="Open this on your phone to use Taska anywhere.">
            <TextBox t="https://taska.example/k/abc/p/home/" />
            <CopyBtn label="Copy link" main onCopy={() => {}} />
          </Part>
          <Setting title="Quiet 22:00–08:00" about="Your local time." control={<Toggle on label="Quiet" onToggle={() => {}} />} />
          <Loading />
        </div>
      </Frame>
      <Frame layout="phone" width={393} height={420}>
        <div className="h-full bg-zinc-100 dark:bg-zinc-950">
          <PhHead title="Settings" onBack={() => {}} />
          <PhLabel>All projects</PhLabel>
          <div className={PH_GROUP}>
            <div className="min-h-12 px-3.5 py-2.5 text-[15px]">Projects</div>
            <div className="min-h-12 px-3.5 py-2.5 text-[15px]">Use on your phone</div>
          </div>
          <PhNote>Create, rename, delete, or restore.</PhNote>
        </div>
      </Frame>
    </div>
  ),
}
