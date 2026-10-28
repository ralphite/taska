// The project tile (T591: Icons and marks > Project tile): the page's own ProjTile at every size the page draws it,
// in each tone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProjTile } from '../ui/bits'
import { PROJECT_TONES } from '../ui/tones'
import { Frames, States } from './Frames'

export default { title: 'Components/Icons and marks/Project tile' } satisfies Meta
type Story = StoryObj

const SIZES: [string, string][] = [
  ['in a search result', 'size-4 rounded text-[9px]'],
  ['in the sidebar’s list, the menus (the default)', 'size-5 rounded-md text-[11px]'],
  ['in the project’s bar, the desktop’s sidebar', 'size-6 rounded-md text-xs'],
  ['in the switcher, the rail', 'size-7 rounded-lg text-xs'],
  ['in the phone’s drawer and Settings', 'size-8 rounded-lg text-sm'],
  ['over the New input page', 'size-11 rounded-xl text-xl shadow-sm'],
]
export const Sizes: Story = {
  name: 'Every size the page draws',
  render: () => (
    <Frames phone={false} deskWidth={720}>
      {() => (
        <States
          items={SIZES.map(([where, cls]) => [
            where,
            <div className="flex flex-wrap items-center gap-2 p-3">
              {PROJECT_TONES.map((t, i) => (
                <ProjTile key={t} title={['Shop', 'Home', '读书笔记', 'taska', 'Notes', 'Travel', 'A long name'][i % 7]} tone={t} cls={cls} />
              ))}
            </div>,
          ])}
        />
      )}
    </Frames>
  ),
}
