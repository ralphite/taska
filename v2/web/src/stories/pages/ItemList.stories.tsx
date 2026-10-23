// T521: Pages > Item list: the project's page at each view of its list, searched and filtered; T522: then the list
// with nothing in a view, nothing found, very long words, and while it loads, fails or loses Taska (the real page,
// only Taska answers otherwise: screens.tsx `as`)
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LONG_B2, SHOP, pageParams, screen, thenTap } from './screens'

const meta: Meta = { title: 'Pages/Item list', parameters: pageParams() }
export default meta

export const Active: StoryObj = { ...screen(SHOP), name: 'Active' }
export const NeedsYou: StoryObj = { ...screen(SHOP + '?status=wait'), name: 'Needs you' }
export const All: StoryObj = { ...screen(SHOP + '?status=every'), name: 'All' }
export const Queue: StoryObj = { ...screen(SHOP + '?status=queued'), name: 'Queue' }
export const Later: StoryObj = { ...screen(SHOP + '?status=later'), name: 'Later' }
export const Finished: StoryObj = { ...screen(SHOP + '?status=closed'), name: 'Finished' }
export const Archive: StoryObj = { ...screen(SHOP + 'archive'), name: 'Archive' }
export const Rules: StoryObj = { ...screen(SHOP + 'rules'), name: 'Rules' }
export const Search: StoryObj = { ...screen(SHOP + '?q=%E5%AF%BC%E5%87%BA'), name: 'Search' }
export const FilteredBugs: StoryObj = { ...screen(SHOP + '?type=bug'), name: 'Filtered: bugs' }
/** T522: a view with nothing in it (Mobile app has nothing that needs you). */
export const EmptyView: StoryObj = { ...screen('/p/mobile-app/?status=wait'), name: 'Empty view: nothing needs you' }
/** T522: words found nowhere in this project; another project has them. */
export const SearchNothingFound: StoryObj = { ...screen(SHOP + '?q=zzzz'), name: 'Search: nothing found' }
/** T522: the other projects are still being searched (Taska has not answered yet): the page shows nothing for them
 * meanwhile, as if none had the words. */
export const SearchOtherProjectsWaiting: StoryObj = {
  ...screen(SHOP + '?q=%E5%AF%BC%E5%87%BA', undefined, { net: { '^/api/search': 'hang' } }),
  name: 'Search: other projects still searching',
}
/** T522: a row (the first, B2) with a very long title: one line on the desktop, two on the phone, then cut. */
export const VeryLongTitle: StoryObj = { ...screen(SHOP, undefined, { items: LONG_B2 }), name: 'A very long title' }
/** T522: every request to Taska waits: the first moments of the page (no copy of the project kept in this browser):
 * "Loading…" in the list; the desktop shows the New input page beside it. */
export const Loading: StoryObj = { ...screen(SHOP, undefined, { net: { '^/(p|api)/': 'hang' } }), name: 'Loading' }
/** T522: Taska refuses (stopped, restarting) when the page opens: the page stays at "Loading…" and tries again;
 * nothing says Taska is out of reach. */
export const LoadRefused: StoryObj = {
  ...screen(SHOP, undefined, { net: { '^/(p|api)/': 'down' } }),
  name: 'Load failed: Taska refused',
}
/** T522: Taska answers the project's data with a server error (500): the same as refused, "Loading…" with no word
 * of why. */
export const LoadServerError: StoryObj = {
  ...screen(SHOP, undefined, { net: { '/api/state$': 500 } }),
  name: 'Load failed: server error',
}
/** T522: Taska stops answering after the page loaded: the agent pill reads "Offline, retrying…" and the list stays
 * as it was. */
export const ConnectionLost: StoryObj = {
  ...screen(SHOP, undefined, { net: { '/api/poll$': 'down' } }),
  name: 'Connection lost',
}
/** T522: another project picked in the sidebar (on the phone, in the drawer), its data not here yet: its name and
 * "Loading…" at once; the sidebar's Documents, Activity and Deleted wait for it. */
export const SwitchingProject: StoryObj = {
  ...screen(SHOP, undefined, { net: { '^/p/mobile-app/api/': 'hang' } }),
  play: thenTap('a[href="/p/mobile-app/"]'),
  name: 'Switching project',
}
