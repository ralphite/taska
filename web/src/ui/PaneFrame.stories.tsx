import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { Icon } from './Icon'
import { PaneFrame } from './PaneFrame'

const meta: Meta = { title: 'Components/Item page/Pane frame' }
export default meta
type Story = StoryObj

const head = (
  <span className="flex items-center gap-2 text-sm font-semibold">
    <span className="font-mono text-purple-600 dark:text-purple-400">F012</span>
    Export ignores the active filter
  </span>
)
const acts = (
  <button title="Done · D" className="grid size-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
    <Icon n="done" />
  </button>
)
const nav = (
  <button title="Next · J" className="grid size-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
    <Icon n="down" />
  </button>
)
const body = <p className="px-8 py-4 text-[15px]">The item's page goes here.</p>

/** The pane's bar and body: with its head, actions and the way to the next item; the New input page's head; empty. */
export const Frame: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={560}>
      {(layout) => (
        <States
          items={[
            ['an item', <div className="flex h-44 flex-col"><PaneFrame place="" desk={layout === 'desk'} head={head} acts={acts} nav={nav} menu onBack={() => {}} onMenu={() => {}}>{body}</PaneFrame></div>],
            ['New input', <div className="flex h-36 flex-col"><PaneFrame place="" desk={layout === 'desk'} head={<span className="flex items-center gap-2 text-sm font-semibold"><Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />New input</span>} onBack={() => {}} /></div>],
            ['nothing open', <div className="flex h-36 flex-col"><PaneFrame place="" desk={layout === 'desk'} onBack={() => {}} /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
