// T457, R488, D68 (4): the item list, played by itself on the real page: its views, folding subitems, search.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Player, type Script } from '../lib/player'
import { end, first, look, tap, type } from './steps'

const meta: Meta = {
  title: 'Demo/Item list',
  parameters: { layout: 'fullscreen', viewport: { disable: true } },
  globals: { viewport: { value: '100pct-100pct', isRotated: false } }, // the frame fits the room (see Needs you)
}
export default meta
type Story = StoryObj

const VIEW = (v: string) => `[data-act="set-filter"][data-v="${v}"]`
/** The views over the same items, then the subitems under an item folded and unfolded. */
const views: Script = async (c) => {
  await first(c, 'Active \u00b7 open and in-progress items')
  await tap(c, 'Active \u00b7 tap Queue: what comes next', VIEW('queued'))
  await tap(c, 'Queue \u00b7 tap Finished: what is done', VIEW('closed'))
  await tap(c, 'Finished \u00b7 tap Active to go back', VIEW('all'))
  await tap(c, 'Active \u00b7 tap F01\u2019s arrow to fold it', '[data-act="fold"][data-n="1"]')
  await tap(c, 'F01 folded \u00b7 tap the arrow to unfold', '[data-act="fold"][data-n="1"]')
  await end(c, 'Its subitems are back under F01')
}
export const ViewsAndSubitems: Story = {
  name: 'Views and subitems \u00b7 phone',
  render: (_, { globals }) => <Player path="/p/shop/" script={views} scheme={String(globals.scheme)} />,
}
export const ViewsAndSubitemsOnTheDesktop: Story = {
  name: 'Views and subitems \u00b7 desktop',
  render: (_, { globals }) => <Player path="/p/shop/" script={views} scheme={String(globals.scheme)} on="desktop" />,
}

const EXPORT = '\u5bfc\u51fa' // "export", a word in several of the demo's items
/** Search: on the phone the magnifier opens the field; on the desktop it is always there. */
const search =
  (desktop: boolean): Script =>
  async (c) => {
    if (desktop) await first(c, 'Items \u00b7 the search field is at the top')
    else {
      await first(c, 'Items \u00b7 search finds items, inputs')
      await tap(c, 'Items \u00b7 tap the magnifier to search', '#searchBtn')
    }
    if (desktop) await tap(c, 'Items \u00b7 tap Search items', '#q')
    await type(c, `Search \u00b7 type a word: ${EXPORT} (export)`, '#q', EXPORT)
    await look(c, 'Found \u00b7 here, and in other projects', 3000)
    await tap(c, 'Found \u00b7 tap F01 to open it', '#list [data-act="open"][data-n="1"]')
    await end(c, 'F01 \u00b7 opened from the search')
  }
const searchPhone = search(false),
  searchDesktop = search(true)
export const Search: Story = {
  name: 'Search \u00b7 phone',
  render: (_, { globals }) => <Player path="/p/shop/" script={searchPhone} scheme={String(globals.scheme)} />,
}
export const SearchOnTheDesktop: Story = {
  name: 'Search \u00b7 desktop',
  render: (_, { globals }) => (
    <Player path="/p/shop/" script={searchDesktop} scheme={String(globals.scheme)} on="desktop" />
  ),
}
