// Every key the page shows (T591: Icons and marks > Keys): the key caps of the page's own table of keys (keyHelp),
// as the page draws them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { keyHelp } from '../app/actions'
import { Kbd } from '../ui/bits'
import { Frames } from './Frames'

export default { title: 'Components/Icons and marks/Keys' } satisfies Meta
type Story = StoryObj

const keys = [...new Set(keyHelp().flatMap(([, rows]) => rows.flatMap(([k]) => k.split(/\s+/))))].filter((k) => k && k !== 'then' && k !== 'or')

export const Keys: Story = {
  name: 'Every key the page shows',
  render: () => (
    <Frames phone={false} deskWidth={720}>
      {() => (
        <div className="flex flex-wrap gap-2 p-4">
          {keys.map((k) => (
            <Kbd key={k} k={k} />
          ))}
        </div>
      )}
    </Frames>
  ),
}
