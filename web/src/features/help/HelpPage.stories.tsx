// Help as the page draws it: opened (the first topic on the desktop, the index on the phone), a topic open, the keys' topic, a search with what it finds and
// with nothing found, on the desktop and the phone. The topics are Help's own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { keyHelp } from '../../app/actions'
import { Frames } from '../../stories/Frames'
import { Rich } from '../../ui/Markdown'
import { HelpPage, KeyTable } from './HelpPage'
import { searchHelp, shownTopic } from './topics'

export default { title: 'Components/Help' } satisfies Meta
type Story = StoryObj

const WORLD = { find: () => null, url: () => '', size: () => undefined }
const on = { open() {}, href: (k: string) => '#' + k, search() {}, back() {} }
const help = (key: string | null, q = ''): Story => ({
  render: () => (
    <Frames deskWidth={1080} height={760}>
      {(layout) => {
        const topic = shownTopic(key, layout === 'desk')
        const body = topic ? (
          <>
            <Rich text={topic.text} world={WORLD} />
            {topic.key === 'keys' ? <div className="mt-6"><KeyTable groups={keyHelp()} /></div> : null}
          </>
        ) : null
        return <div className="flex h-full flex-col"><HelpPage desk={layout === 'desk'} topic={topic} q={q} found={searchHelp(q)} back="Items" body={body} place="" on={on} /></div>
      }}
    </Frames>
  ),
})

export const Index: Story = { ...help(null), name: 'Opened: the first topic (the phone: every topic by group)' }
export const ATopic: Story = { ...help('agents'), name: 'A topic open: How agents get work' }
export const ATopicWithATable: Story = { ...help('items'), name: 'A topic with a table: Items' }
export const Keys: Story = { ...help('keys'), name: 'Keyboard shortcuts' }
export const Searching: Story = { ...help(null, 'agent'), name: 'Searching: what it finds' }
export const NothingFound: Story = { ...help(null, 'invoice'), name: 'Searching: nothing found' }
// ---- more states (T639)
/** a topic in the column under the pointer, one from the keys (the browser's ring), an index card under the pointer */
export const PointerAndKeys: Story = { ...help(null), name: 'Topics: pointer and keys', parameters: { pseudo: { hover: ['nav a:nth-of-type(2)', 'section a:first-of-type'], focusVisible: ['nav a:nth-of-type(3)'] } } }
/** words typed while a topic is open (desktop): Search results take the topic's place, the topic stays lit in the column */
export const SearchingFromATopic: Story = { ...help('agents', 'phone'), name: 'Searching from a topic' }
