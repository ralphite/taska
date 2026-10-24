import type { Meta, StoryObj } from '@storybook/react-vite'
import { findRef } from '../../model/project'
import { doc } from '../../stories/docFixtures'
import { item, modelOf, T } from '../../stories/fixtures'
import { Frames } from '../../stories/Frames'
import { factsOf, type DocLook } from './docFacts'
import { DocView, type DocEvents } from './DocView'
import type { DocEnv } from './Thread'

const meta: Meta = { title: 'Components/Document' }
export default meta
type Story = StoryObj

const d = doc()
const m = modelOf([item({ n: 12, title: 'Rewrite Taska from scratch' })], [], {}, [d])
const no = () => {}
const on: DocEvents = { ref: no, picture: no, play: no, words: no, view: no, edit: no, move: no, takeOff: no, remove: no, resolve: no, reply: no, goItem: no, toggle: no, away: no, pick: no, say: no, sayCancel: no, type: no, moveDoc: no, deleteDoc: no, circle: no, quote: no, editDoc: no, whole: no, tick: no, modifyTicks: no }
const env = (desk: boolean): DocEnv => ({ world: { find: (c) => findRef(m, c), url: (f) => '#' + f, size: () => undefined }, now: Date.parse(T), desk, tidy: true, play: () => ({ playing: false, t: null }), url: (f) => '#' + f })
const look = (f: Partial<DocLook> = {}): DocLook => ({ threads: new Set(), sel: new Set(), quote: null, reply: null, circle: false, typing: false, ...f })
const seen = { since: T }

const view = (l: DocLook, height = 900) => (
  <Frames height={height} deskWidth={820} phoneWidth={393}>
    {(layout) => (
      <div className={layout === 'desk' ? 'h-full overflow-y-auto px-8 pt-8 pb-12' : 'h-full overflow-y-auto px-4 pt-2'}>
        <DocView facts={factsOf(m, d, l, seen, layout === 'desk', {}, false, { mine: {}, going: {}, open: new Set() })} env={env(layout === 'desk')} on={on} />
      </div>
    )}
  </Frames>
)

/** Its title, words, a heading, a list, a quote, code and a table; each commented paragraph shows its count (beside
 * the text on the desktop, a chip on the phone), the words a thread quotes marked. */
export const Reading: Story = { render: () => view(look()) }

/** A thread open: over the text on the desktop, under its paragraph on the phone. */
export const ThreadOpen: Story = { render: () => view(look({ threads: new Set(['p1#1', 'p1']) })) }

/** A paragraph picked to comment on (the phone's row to speak or type under it), and the whole document's comments. */
export const Picked: Story = { render: () => view(look({ sel: new Set(['l1']), threads: new Set(['doc']) })) }

/** Drawing around an area. */
export const Circling: Story = { render: () => view(look({ circle: true }), 500) }
