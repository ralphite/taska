// T457 (r625), T521: every page of Taska as it really is: each story opens the real page (the same code) at one of
// its own addresses, on the demo project's saved answers (.storybook/public/fixtures, made by
// v2/tools/story_fixtures.py). Nothing is drawn or done separately, so a page story can never drift from the page;
// a part in one of its states (a menu open, a sheet, the box being written in) is the Components' to show. Like a
// component story (R520, F528), a page shows the desktop (1440x900) and the phone (393x852) at once, or the one it
// is on, with nothing to pick; light or dark from the toolbar. The pages are in folders by area, most used first,
// each named as the page names it.
import type { StoryObj } from '@storybook/react-vite'
import { Both, single, type Platform } from '../lib/both'
import type { Item } from '../../lib/types'

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** The page inside, once it has drawn. */
export async function pageIn(canvas: HTMLElement) {
  const f = canvas.querySelector('iframe')
  for (let i = 0; i < 100 && !f?.contentDocument?.querySelector('#app, #home, #root > *'); i++) await wait(100)
  await wait(600)
  return f
}

/** T522: how Taska answers the page in a story, and the story's own data. `net`: for each path (a regex), "hang"
 * (Taska never answers; the page's own time limits end the wait), "down" (refused) or an HTTP status (an error);
 * `items`: items of the shown project with other fields, by number ({3: {title: ...}}). The stand-in for Taska
 * (.storybook/public/app-shim.js) answers by them; the page is the page, as it is. */
export interface Answers {
  net?: Record<string, 'hang' | 'down' | number>
  items?: Record<number, Partial<Item>>
}
const answers = (a?: Answers) =>
  (a?.net ? '&net=' + encodeURIComponent(JSON.stringify(a.net)) : '') +
  (a?.items ? '&items=' + encodeURIComponent(JSON.stringify(a.items)) : '')

/** The real page at this address; with `server` (a Demo's beginning, T457 #6481), on the real Taska server run in
 * the page; with `as`, Taska answering as it says (T522). */
export function App({ path, scheme, server, as }: { path: string; scheme: string; server?: string; as?: Answers }) {
  const theme = scheme === 'dark' ? 'dark' : 'light'
  return (
    <iframe
      title="Taska"
      src={`/storybook/app.html#path=${encodeURIComponent(path)}&theme=${theme}${server ? '&server=' + encodeURIComponent(server) : ''}${answers(as)}`}
      className="block h-screen w-full border-0"
    />
  )
}

/** The demo project most pages are in. */
export const SHOP = '/p/shop/'

/** T522: the list's first row (B2) with a very long title, where both the phone and the desktop show it without
 * scrolling. */
export const LONG_B2: Answers['items'] = {
  2: {
    title:
      'Checkout’s Pay now button does nothing on iPhone Safari when the customer has a saved card, a gift card and a coupon on the same order, and the page shows no error at all',
  },
}
/** T522: T3 with a very long title and details (a long sentence, long paragraphs, an address with no room to break),
 * for its item page. */
export const LONG_T3: Answers['items'] = {
  3: {
    title:
      'Write the returns policy page, and make sure that every link to it from the checkout page, the order confirmation email, the account page and the help centre opens the same version in the customer’s own language',
    body:
      'The new returns rules start on November 1: thirty days to return anything without giving a reason, except made-to-order products, which can only be returned when they arrive damaged or are not what was ordered. ' +
      'Refunds go back the way the customer paid, in three to five working days; we pay the shipping when the product is faulty, the customer pays it otherwise.\n\n' +
      'The page lives at https://shop.example.com/help/returns-and-refunds/policy?lang=en&from=checkout-confirmation-email-footer-link and the checkout page and the order emails link to it.\n\n' +
      'Still missing: the exception for made-to-order products, word for word from legal; the page goes live together with the links once that arrives.',
  },
}

/** One page: the desktop and the phone at once, in frames of their size (the same frames as a component story's),
 * each the real page at this address; `on` for a page only one of them has; `as` for how Taska answers it and the
 * story's own data (T522: loading, refused, an error, a very long title). Each story adds its name, as the page
 * names it. */
export const screen = (path: string, on?: Platform, as?: Answers): StoryObj => ({
  render: (_, { id, globals }) => {
    const scheme = globals.scheme === 'dark' ? 'dark' : 'light'
    return single() ? <App path={path} scheme={scheme} as={as} /> : <Both id={id} scheme={scheme} platform={on} />
  },
})

/** T522: a page reached by a tap, as you would: once the page shows `what` (a link, a button), it is tapped, and the
 * story shows what the page does then. Only in the frame that draws the page (each of the desktop and the phone). */
export const thenTap =
  (what: string): StoryObj['play'] =>
  async ({ canvasElement }) => {
    if (!single()) return
    const f = await pageIn(canvasElement)
    let el: HTMLElement | null | undefined = null
    for (let i = 0; i < 100 && !(el = f?.contentDocument?.querySelector<HTMLElement>(what)); i++) await wait(100)
    el?.click()
  }

/** What every Pages file shows: the page's own frame (Shell's ProjectPage, and these), at full size. */
export const pageParams = (...covers: string[]) => ({
  layout: 'fullscreen',
  covers: ['ProjectPage', 'DeskLayout', 'PhoneLayout', ...covers],
})
