import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { NewProjectField } from './NewProjectField'

const meta: Meta = { title: 'Components/Sidebar/New project' }
export default meta
type Story = StoryObj

const on = { create: () => {}, cancel: () => {} }

/** A name and Create (any name: its address is made from it); not made, why. */
export const Field: Story = {
  render: () => (
    <Frames phoneWidth={320} deskWidth={260}>
      {() => (
        <div className="flex flex-col gap-4 bg-zinc-50 py-2 dark:bg-zinc-900">
          <NewProjectField error="" on={on} />
          <NewProjectField error="A project of that name exists" on={on} />
        </div>
      )}
    </Frames>
  ),
}
