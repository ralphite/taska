import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../stories/Frames'
import { PRIMARY } from './tones'
import { Sheet } from './Sheet'

const meta: Meta = { title: 'Components/Menus and sheets/Sheets' }
export default meta
type Story = StoryObj

const parts = {
  title: 'Move to project',
  sub: <p className="px-5 pb-2 text-sm text-zinc-500">F012 and its 2 subitems go along.</p>,
  body: <p className="text-[15px]">The body scrolls when it is long.</p>,
  foot: (
    <div className="flex justify-end border-t border-zinc-100 p-3 dark:border-zinc-800">
      <button className={PRIMARY}>Move</button>
    </div>
  ),
}

/** A sheet from the bottom on the phone, a dialog on the desktop: title, line under it, body, foot. */
export const Frame: Story = {
  name: 'A sheet’s frame: phone and desktop',
  render: () => <Frames height={420} deskWidth={900}>{(layout) => <Sheet open look={{}} parts={parts} desk={layout === 'desk'} onClose={() => {}} />}</Frames>,
}
