import type { Meta, StoryObj } from '@storybook/react-vite'
import { item } from '../../stories/fixtures'
import { SheetFrames, no } from '../../stories/sheetFixtures'
import { PROJECT_TONES } from '../../ui/tones'
import { Palette, Switcher, keysSheet } from './Finders'

const meta: Meta = { title: 'Components/Sheets/Finders' }
export default meta
type Story = StoryObj

/** Every key (?). */
export const Keys: Story = { render: () => <SheetFrames height={820} parts={() => keysSheet()} /> }

/** G P: the projects, the keys' row on the first that is not this one. */
export const Switch: Story = {
  render: () => (
    <SheetFrames
      parts={() => ({
        title: 'Switch project',
        body: (
          <Switcher
            rows={[
              { slug: 'taska', title: 'taska', tone: PROJECT_TONES[0], needs: 2, here: true },
              { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], needs: 11, here: false },
              { slug: 'todos', title: 'todos', tone: PROJECT_TONES[2], needs: 0, here: false },
            ]}
            loading={false}
            onOpen={no}
          />
        ),
      })}
    />
  ),
}

/** Cmd-K: the open item's commands, the page's, and items found. */
export const Commands: Story = {
  render: () => <SheetFrames height={760} parts={() => ({ title: 'Go to or do', body: <Palette items={[item({ n: 12 })]} code={(n) => 'F' + String(n).padStart(3, '0')} open={12} onItem={no} onKeys={no} /> })} />,
}
