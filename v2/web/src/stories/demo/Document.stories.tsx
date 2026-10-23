// T457, R488, D68 (7): a document, played by itself on the real page: open an item's document, read a comment
// thread on one of its lines. On the desktop the document has a column of its own beside the list and the talk.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Script } from '../lib/player'
import { end, first, look, tap } from './steps'

const meta: Meta = {
  title: 'Demo/Document',
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
  globals: { viewport: { value: '100pct-100pct', isRotated: false } }, // the frame fits the room (see Needs you)
}
export default meta
type Story = StoryObj

/** F01's document D1: its comments are numbers beside the lines; one opens its thread. */
const read =
  (desktop: boolean): Script =>
  async (c) => {
    await first(c, 'Items \u00b7 tap F01 to open it')
    await tap(c, '', '#list [data-act="open"][data-n="1"]')
    await tap(c, 'F01 \u00b7 tap its document, D1', '[data-act="doc-open"]')
    await look(c, 'D1 \u00b7 the numbers are its comments', 3200)
    await tap(c, 'D1 \u00b7 tap 2: the talk on that line', '[data-act="doc-thread"]', '2')
    await look(c, 'D1 \u00b7 its thread: Reply or Resolve', 3500)
    if (desktop) await tap(c, 'D1 \u00b7 tap Back to F01', '[data-act="doc-close"]')
    else await tap(c, 'D1 \u00b7 tap \u00d7 to close it', '#dlgClose')
    await end(c, 'F01 \u00b7 back on the item')
  }
const readPhone = read(false),
  readDesktop = read(true)
export const ReadAComment: Story = {
  name: 'Read a comment \u00b7 phone',
  render: (_, { globals }) => <Player path="/p/shop/" script={readPhone} scheme={String(globals.scheme)} />,
}
export const ReadACommentOnTheDesktop: Story = {
  name: 'Read a comment \u00b7 desktop',
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={readDesktop} scheme={String(globals.scheme)} on="desktop" />
  ),
}
