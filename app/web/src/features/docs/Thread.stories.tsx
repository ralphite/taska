import type { Meta, StoryObj } from '@storybook/react-vite'
import { threadsOf } from '../../model/docs'
import { comment } from '../../stories/docFixtures'
import { T } from '../../stories/fixtures'
import { Frames } from '../../stories/Frames'
import { DraftCard, Thread, type DocEnv, type ThreadEvents } from './Thread'

const meta: Meta = { title: 'Components/Document/Thread' }
export default meta
type Story = StoryObj

const no = () => {}
const on: ThreadEvents = { ref: no, picture: no, play: no, words: no, view: no, edit: no, move: no, takeOff: no, remove: no, resolve: no, reply: no }
const env = (desk: boolean): DocEnv => ({ world: { find: () => null, url: (f) => '#' + f, size: () => undefined }, now: Date.parse(T), desk, tidy: true, play: () => ({ playing: false, t: null }), url: (f) => '#' + f })
const [t] = threadsOf([
  comment({ id: 1, key: 'p1', th: 1, quote: 'stays in use', text: 'Until when exactly?', by: 'you', files: [{ f: 'a.pdf', name: 'plan.pdf', mime: 'application/pdf', size: 12000 }] }),
  comment({ id: 2, key: 'p1', th: 1, quote: 'stays in use', text: 'Until every check is green.', edited: T }),
])

/** Under a paragraph (the phone) and as a card beside the text (the desktop): new from an agent; resolved; replying. */
export const Threads: Story = {
  render: () => (
    <Frames height={520} deskWidth={360} phoneWidth={393}>
      {(layout) => (
        <div className="flex flex-col gap-4 p-4">
          <Thread t={t} blockText="The old one stays in use." rail={layout === 'desk'} isNew done={false} replying={false} asking={null} env={env(layout === 'desk')} on={on} />
          <Thread t={t} rail={layout === 'desk'} isNew={false} done replying asking="1 a.pdf" env={env(layout === 'desk')} on={on} />
        </div>
      )}
    </Frames>
  ),
}

/** A comment not sent yet, where it will go. */
export const NotSent: Story = {
  render: () => (
    <div className="flex max-w-80 flex-col gap-3 p-6">
      <DraftCard words="Pilot first, then the rest." voice={0} transcribing={false} />
      <DraftCard words="" voice={2} transcribing />
    </div>
  ),
}
