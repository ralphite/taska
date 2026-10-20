/** The addresses the server opens the page on (VIEW_PATH in server/taska/web.py): the home page and every view of
 * every project. The service worker keeps the page for these (T293). */
export const VIEWS =
  'inputs|archive|rules|new-rule|new|settings|agents|connect|phone|notifications|spellings|log|deleted|docs|about|projects|organizer|[A-Za-z]\\d+'
const VIEW = new RegExp(`^/p/[^/]+/(${VIEWS})?$`)
export const isPage = (path: string) => path === '/' || VIEW.test(path)
