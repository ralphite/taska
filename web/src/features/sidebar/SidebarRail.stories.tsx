// The sidebar folded to icons, and its icons under the pointer and from the keys.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { rail } from '../../stories/sideFixtures'

export default { title: 'Components/Sidebar/Folded to icons' } satisfies Meta
type Story = StoryObj

export const RailFolded: Story = { name: 'As it is', render: () => <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800"><Frame layout="desk" width={56} height={560}>{rail()}</Frame></div> }
/** The sidebar folded to icons: a project under the pointer and from the keys. */
export const RailLooks: Story = {
  name: 'Pointer, keys',
  parameters: { pseudo: { hover: ['[data-look="pointer"] #rail a:nth-of-type(1)'], focusVisible: ['[data-look="keys"] #rail a:nth-of-type(1)'] } },
  render: () => (
    <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {(['pointer', 'keys'] as const).map((look) => (
        <Frame key={look} layout="desk" width={56} height={420} label={look}>
          <div data-look={look} className="h-full">
            {rail()}
          </div>
        </Frame>
      ))}
    </div>
  ),
}
// ---- more states (T639)
const folded = (f: Parameters<typeof rail>[0]) => () => <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800"><Frame layout="desk" width={56} height={560}>{rail(f)}</Frame></div>
export const RailSettingsOpen: Story = { name: 'Settings open', render: folded({ settings: true, composing: false }) }
export const RailNotListedYet: Story = { name: 'Projects not listed yet', render: folded({ loading: true }) }
