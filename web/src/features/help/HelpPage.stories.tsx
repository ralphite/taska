// Help as the page draws it, laid out as docs sites are: opened on its first topic, a topic open, the keys' topic, a
// narrower window, the phone's Topics, a search with what it finds and with nothing found. The topics are Help's own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { keyHelp } from '../../app/actions'
import { Frames } from '../../stories/Frames'
import { Rich } from '../../ui/Markdown'
import { HelpPage, KeyTable } from './HelpPage'
import { searchHelp, shownTopic } from './topics'

export default { title: 'Components/Help' } satisfies Meta
type Story = StoryObj

const WORLD = { find: () => null, url: () => '', size: () => undefined }
const on = { open() {}, href: (k: string) => '#' + k, search() {}, back() {}, menu() {} }
const help = (key: string | null, q = '', f: { menu?: boolean; deskWidth?: number } = {}): Story => ({
  render: () => (
    <Frames deskWidth={f.deskWidth ?? 1320} height={760}>
      {(layout) => {
        const topic = shownTopic(key)
        return (
          <div className="flex h-full flex-col">
            <HelpPage desk={layout === 'desk'} topic={topic} q={q} found={searchHelp(q)} back="Items" menu={!!f.menu} render={(text) => <Rich text={text} world={WORLD} />} extra={topic.key === 'keys' ? <KeyTable groups={keyHelp()} /> : null} place="" on={on} />
          </div>
        )
      }}
    </Frames>
  ),
})

export const Index: Story = { ...help(null), name: 'Opened: the first topic' }
export const ATopic: Story = { ...help('agents'), name: 'A topic open: How agents get work' }
export const ATopicWithATable: Story = { ...help('items'), name: 'A topic with tables: Items' }
export const Keys: Story = { ...help('keys'), name: 'Keyboard shortcuts' }
/** a desktop window too narrow for On this page: the topic and the column only */
export const Narrower: Story = { ...help('items', '', { deskWidth: 1080 }), name: 'A narrower window: no On this page' }
/** the phone's Topics: every topic in its group, the search above them */
export const PhoneTopics: Story = { ...help('agents', '', { menu: true }), name: 'The phone: Topics open' }
export const Searching: Story = { ...help(null, 'agent', { menu: true }), name: 'Searching: what it finds' }
export const NothingFound: Story = { ...help(null, 'invoice', { menu: true }), name: 'Searching: nothing found' }
/** a topic in the column under the pointer, one from the keys (the browser's ring) */
export const PointerAndKeys: Story = { ...help(null), name: 'Topics: pointer and keys', parameters: { pseudo: { hover: ['nav li:nth-of-type(2) a'], focusVisible: ['nav li:nth-of-type(3) a'] } } }
/** words typed while a topic is open: Search results take the topic's place, the topic stays marked in the column */
export const SearchingFromATopic: Story = { ...help('agents', 'phone', { menu: true }), name: 'Searching from a topic' }
