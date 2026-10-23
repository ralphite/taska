// T522 (r717 #6209): Pages > Item page > Loading and errors: an item's address opened (or reloaded) while Taska is
// slow, refuses, fails or has no such item; the connection lost while an item is open; its pictures slow or gone.
// Each is the real page, only Taska answers otherwise (screens.tsx `as`). Where the page has no state of its own for
// a case, the story shows what it really does (said on the story).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from '../screens'

const meta: Meta = { title: 'Pages/Item page/Loading and errors', parameters: pageParams() }
export default meta

/** Every request to Taska waits: the page's first moments after a reload of an item's address (with no copy kept
 * in this browser). The page has no loading state of its own for the item: the desktop shows the New input page and
 * the phone the item list, each with "Loading…", until the data comes; then the item opens. */
export const ReloadStillLoading: StoryObj = {
  ...screen(SHOP + 'T3', undefined, { net: { '^/(p|api)/': 'hang' } }),
  name: 'Reload: still loading',
}
/** Taska refuses (stopped, restarting): the page says nothing of it and stays at "Loading…" while it tries again. */
export const ReloadRefused: StoryObj = {
  ...screen(SHOP + 'T3', undefined, { net: { '^/(p|api)/': 'down' } }),
  name: 'Reload: Taska refused',
}
/** Taska answers the project's data with a server error (500): the page stays at "Loading…", nothing says why. */
export const ReloadServerError: StoryObj = {
  ...screen(SHOP + 'T3', undefined, { net: { '/api/state$': 500 } }),
  name: 'Reload: server error',
}
/** The address names an item the project does not have (T99): the page quietly goes to the New input page (desktop)
 * or the list (phone); nothing says the item is not there. */
export const NotInThisProject: StoryObj = { ...screen(SHOP + 'T99'), name: 'Not in this project' }
/** Taska stops answering while an item is open: the desktop's agent pill reads "Offline, retrying…"; the phone's
 * item page has no pill, so nothing there says so. */
export const ConnectionLost: StoryObj = {
  ...screen(SHOP + 'T3', undefined, { net: { '/api/poll$': 'down' } }),
  name: 'Connection lost',
}
/** The item's pictures (and the list row's) still on their way: their grey places, no spinner. In a built Storybook
 * there is no slow server, and they fail instead. */
export const PicturesStillLoading: StoryObj = {
  ...screen(SHOP + 'B36', undefined, { net: { '/f/': 'hang' } }),
  name: 'Pictures still loading',
}
/** The item's pictures did not come: the browser's broken-picture mark and the file's name, cut off. */
export const PicturesFailed: StoryObj = {
  ...screen(SHOP + 'B36', undefined, { net: { '/f/': 'down' } }),
  name: 'Pictures failed',
}
