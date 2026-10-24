import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../stories/Frames'
import { Icon, StateIcon } from './Icon'
import { ICON, STATE_ICON, type IconName } from './icon-paths'

const meta: Meta = { title: 'Components/Primitives/Icons' }
export default meta
type Story = StoryObj

/** Every icon of the page, with its name. */
export const Icons: Story = {
  render: () => (
    <Frames phone={false} deskWidth={720}>
      {() => (
        <div className="grid grid-cols-6 gap-3 p-4">
          {(Object.keys(ICON) as IconName[]).map((n) => (
            <div key={n} className="flex flex-col items-center gap-1 text-zinc-700 dark:text-zinc-300">
              <Icon n={n} />
              <span className="font-mono text-[10px] text-zinc-400">{n}</span>
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}

/** Each status's round icon, in its own colour. */
export const StatusIcons: Story = {
  render: () => (
    <Frames phone={false} deskWidth={720}>
      {() => (
        <div className="grid grid-cols-6 gap-3 p-4">
          {Object.keys(STATE_ICON).map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <StateIcon s={s} label={s} />
              <span className="font-mono text-[10px] text-zinc-400">{s}</span>
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}
