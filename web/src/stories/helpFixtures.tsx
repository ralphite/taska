// What Help's stories share: the page's own HelpPage with Help's own topics, at both sizes.
import type { StoryObj } from '@storybook/react-vite'
import { Frames } from './Frames'
import { Rich } from '../ui/Markdown'
import { HelpPage } from '../features/help/HelpPage'
import { searchHelp, shownTopic } from '../features/help/topics'

type Story = StoryObj

const WORLD = { find: () => null, url: () => '', size: () => undefined }
const on = { open() {}, href: (k: string) => '#' + k, search() {}, back() {}, menu() {} }
export const help = (key: string | null, q = '', f: { menu?: boolean; deskWidth?: number } = {}): Story => ({
  render: () => (
    <Frames deskWidth={f.deskWidth ?? 1320} height={760}>
      {(layout) => {
        const topic = shownTopic(key)
        return (
          <div className="flex h-full flex-col">
            <HelpPage desk={layout === 'desk'} topic={topic} q={q} found={searchHelp(q)} back="Items" menu={!!f.menu} render={(text) => <Rich text={text} world={WORLD} />} place="" on={on} />
          </div>
        )
      }}
    </Frames>
  ),
})
