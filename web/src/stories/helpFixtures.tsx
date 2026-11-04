// What Help's stories share: the page's own HelpPage with Help's own topics, at both sizes.
import type { StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { act } from './acts'
import { Frames } from './Frames'
import { Rich } from '../ui/Markdown'
import { HelpPage } from '../features/help/HelpPage'
import { searchHelp, shownTopic } from '../features/help/topics'

type Story = StoryObj

const WORLD = { find: () => null, url: () => '', size: () => undefined }
/** Help as HelpContainer holds it: a topic opens (the search and the phone's menu close), the search types and finds,
 * the phone's menu opens; the way back leaves Help (the Actions panel). */
function LiveHelp({ desk, start, q: q0, menu: menu0 }: { desk: boolean; start: string | null; q: string; menu: boolean }) {
  const [key, setKey] = useState(start)
  const [q, setQ] = useState(q0)
  const [menu, setMenu] = useState(menu0)
  const topic = shownTopic(key)
  const on = {
    open: (k: string) => (setQ(''), setMenu(false), setKey(k)),
    href: (k: string) => '#' + k,
    search: setQ,
    back: act('Help: back'),
    menu: setMenu,
  }
  return <HelpPage desk={desk} topic={topic} q={q} found={searchHelp(q)} back="Items" menu={menu} render={(text) => <Rich text={text} world={WORLD} />} place="" on={on} />
}
export const help = (key: string | null, q = '', f: { menu?: boolean; deskWidth?: number } = {}): Story => ({
  render: () => (
    <Frames deskWidth={f.deskWidth ?? 1320} height={760}>
      {(layout) => (
        <div className="flex h-full flex-col">
          <LiveHelp desk={layout === 'desk'} start={key} q={q} menu={!!f.menu} />
        </div>
      )}
    </Frames>
  ),
})
