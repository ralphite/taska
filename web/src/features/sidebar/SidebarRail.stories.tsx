// The sidebar folded to icons, and its icons under the pointer, from the keys, pressed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { rail } from '../../stories/sideFixtures'

export default { title: 'Components/Sidebar/Folded to icons' } satisfies Meta
type Story = StoryObj

export const RailFolded: Story = { name: 'Folded to icons', render: () => <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800"><Frame layout="desk" width={56} height={560}>{rail()}</Frame></div> }
/** The sidebar folded to icons: a project under the pointer, from the keys, pressed. */
export const RailLooks: Story = {
  name: 'Folded to icons: pointer, keys, pressed',
  parameters: { pseudo: { hover: ['[data-look="pointer"] #rail a:nth-of-type(1)'], focusVisible: ['[data-look="keys"] #rail a:nth-of-type(1)'], active: ['[data-look="pressed"] #rail a:nth-of-type(1)'] } },
  render: () => (
    <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {(['pointer', 'keys', 'pressed'] as const).map((look) => (
        <Frame key={look} layout="desk" width={56} height={420} label={look}>
          <div data-look={look} className="h-full">
            {rail()}
          </div>
        </Frame>
      ))}
    </div>
  ),
}
