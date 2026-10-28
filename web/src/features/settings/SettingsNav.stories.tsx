// Settings' column of sections on the desktop under the pointer, from the keys, pressed (T591: Settings): the page's
// own Settings, side by side.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { settingsAt } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings' } satisfies Meta
type Story = StoryObj

const ROW = '[aria-label="Sections of Settings"] a[href]:nth-of-type(3)'
export const NavLooks: Story = {
  name: 'Sections: pointer, keys, pressed',
  parameters: { pseudo: { hover: [`[data-look="pointer"] ${ROW}`], focusVisible: [`[data-look="keys"] ${ROW}`], active: [`[data-look="pressed"] ${ROW}`] } },
  render: () => (
    <div className="flex flex-wrap gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {(['pointer', 'keys', 'pressed'] as const).map((look) => (
        <Frame key={look} layout="desk" width={560} height={480} label={look === 'keys' ? 'keys (the browser draws the ring itself)' : look}>
          <div data-look={look} className="h-full">
            {settingsAt('agents', true)}
          </div>
        </Frame>
      ))}
    </div>
  ),
}
