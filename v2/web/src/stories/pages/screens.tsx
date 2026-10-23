// T457 (r625), T521: every page of Taska as it really is: each story opens the real page (the same code) at one of
// its own addresses, on the demo project's saved answers (.storybook/public/fixtures, made by
// v2/tools/story_fixtures.py). Nothing is drawn or done separately, so a page story can never drift from the page;
// a part in one of its states (a menu open, a sheet, the box being written in) is the Components' to show. Like a
// component story (R520, F528), a page shows the desktop (1440x900) and the phone (393x852) at once, or the one it
// is on, with nothing to pick; light or dark from the toolbar. The pages are in folders by area, most used first,
// each named as the page names it.
import type { StoryObj } from '@storybook/react-vite'
import { Both, single, type Platform } from '../lib/both'

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** The page inside, once it has drawn. */
export async function pageIn(canvas: HTMLElement) {
  const f = canvas.querySelector('iframe')
  for (let i = 0; i < 100 && !f?.contentDocument?.querySelector('#app, #home, #root > *'); i++) await wait(100)
  await wait(600)
  return f
}

/** The real page at this address; with `server` (a Demo's beginning, T457 #6481), on the real Taska server run in
 * the page. */
export function App({ path, scheme, server }: { path: string; scheme: string; server?: string }) {
  const theme = scheme === 'dark' ? 'dark' : 'light'
  return (
    <iframe
      title="Taska"
      src={`/storybook/app.html#path=${encodeURIComponent(path)}&theme=${theme}${server ? '&server=' + encodeURIComponent(server) : ''}`}
      className="block h-screen w-full border-0"
    />
  )
}

/** The demo project most pages are in. */
export const SHOP = '/p/shop/'

/** One page: the desktop and the phone at once, in frames of their size (the same frames as a component story's),
 * each the real page at this address; `on` for a page only one of them has. Each story adds its name, as the page
 * names it. */
export const screen = (path: string, on?: Platform): StoryObj => ({
  render: (_, { id, globals }) => {
    const scheme = globals.scheme === 'dark' ? 'dark' : 'light'
    return single() ? <App path={path} scheme={scheme} /> : <Both id={id} scheme={scheme} platform={on} />
  },
})

/** What every Pages file shows: the page's own frame (Shell's ProjectPage, and these), at full size. */
export const pageParams = (...covers: string[]) => ({
  layout: 'fullscreen',
  covers: ['ProjectPage', 'DeskLayout', 'PhoneLayout', ...covers],
})
