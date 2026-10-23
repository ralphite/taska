// T457, R488, D68 (6): an item's page, played by itself on the real page: open an item, see the inputs it came
// from, go to one of its subitems and back. Its voice note is not played: in Storybook the page cannot load a
// recording yet (the player's Audio is not in the page, so the saved answers never serve its file).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Script } from '../lib/player'
import { end, first, look, tap } from './steps'

const meta: Meta = {
  title: 'Demo/Item page',
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
  globals: { viewport: { value: '100pct-100pct', isRotated: false } }, // the frame fits the room (see Needs you)
}
export default meta
type Story = StoryObj

/** Open F01: its words, its document, the inputs it came from, its subitems; open one, come back. */
const open =
  (desktop: boolean): Script =>
  async (c) => {
    await first(c, 'Items \u00b7 tap F01 to open it')
    await tap(c, '', '#list [data-act="open"][data-n="1"]')
    await look(c, 'F01 \u00b7 its words, document, subitems', 3000)
    await tap(c, 'F01 \u00b7 tap From 4 inputs: your words', '#detailView [data-act="sources"]')
    await look(c, 'Came from \u00b7 your words, voice too', 3200)
    await tap(c, 'Came from \u00b7 tap \u00d7 to close it', '#dlgClose')
    await tap(c, 'F01 \u00b7 tap T15, one of its subitems', '#detailView [data-act="goto"][data-n="15"]')
    await look(c, 'T15 \u00b7 a subitem: its parent is F01', 2800)
    if (desktop) await tap(c, 'T15 \u00b7 tap F01 in the list to go back', '#list [data-act="open"][data-n="1"]')
    else await tap(c, 'T15 \u00b7 tap Back to go to F01', '#backBtn')
    await end(c, 'F01 \u00b7 back where you were')
  }
const openPhone = open(false),
  openDesktop = open(true)
export const OpenAnItem: Story = {
  name: 'Open an item \u00b7 phone',
  render: (_, { globals }) => <Player path="/p/shop/" script={openPhone} scheme={String(globals.scheme)} />,
}
export const OpenAnItemOnTheDesktop: Story = {
  name: 'Open an item \u00b7 desktop',
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={openDesktop} scheme={String(globals.scheme)} on="desktop" />
  ),
}
