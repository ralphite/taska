// Settings' column of sections on the desktop under the pointer, from the keys, pressed (T591: Settings): the page's
// own Settings, side by side.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame } from '../../stories/Frames'
import { settingsAt } from '../../stories/settingsFixtures'

export default { title: 'Components/Settings, help and parts/Settings/The page and its parts' } satisfies Meta
type Story = StoryObj

const ROW = '[aria-label="Sections of Settings"] a[href]:nth-of-type(3)'
export const NavLooks: Story = {
  name: 'Sections: pointer, keys, pressed',
  parameters: { pseudo: { hover: [`[data-look="pointer"] ${ROW}`], focusVisible: [`[data-look="keys"] ${ROW}`] } },
  render: () => (
    <div className="flex flex-wrap gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {(['pointer', 'keys', 'pressed'] as const).map((look) => (
        <Frame key={look} layout="desk" width={560} height={480} label={look === 'keys' ? 'keys (the browser draws the ring itself)' : look}>
          <div data-look={look} className="h-full">
            {look === 'pressed' ? <After run={(root) => root.querySelector(ROW)?.setAttribute('data-pressed', '')}>{settingsAt('projects', true)}</After> : settingsAt('projects', true)}
          </div>
        </Frame>
      ))}
    </div>
  ),
}
