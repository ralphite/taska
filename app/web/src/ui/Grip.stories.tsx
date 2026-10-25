import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Frames } from '../stories/Frames'
import { Grip } from './Grip'

const meta: Meta = { title: 'Components/Item page/Layout and editing' }
export default meta
type Story = StoryObj

function Panes() {
  const [w, setW] = useState(160)
  return (
    <div className="flex h-40 border border-zinc-200 dark:border-zinc-800">
      <div style={{ width: w }} className="relative shrink-0 border-r border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
        {w}px
        <Grip name="side" axis="x" place="absolute inset-y-0 right-0 z-10 w-3 translate-x-1/2" measure={(el) => ({ from: el.parentElement?.getBoundingClientRect().left ?? 0, most: 400 })} onSize={setW} onDone={setW} onReset={() => setW(160)} />
      </div>
      <div className="p-2 text-xs">Drag the line; a double-click puts it back</div>
    </div>
  )
}

/** A pane's edge: pointed at or dragged, the line turns blue. */
export const Edge: Story = {
  name: 'The line between panes: pointer, dragged', render: () => <Frames phone={false} deskWidth={640}>{() => <Panes />}</Frames> }
