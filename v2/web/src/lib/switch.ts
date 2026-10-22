// T339: going to another project, to the home page, or from the home page into a project happens in the page, as in
// any web app: the address changes, the frame shows at once (with what the page has of that project), and the data
// comes in behind. Addresses stay the same (/ and /p/<name>/...), so agents' and phone links keep working. While
// something of this project is still on its way (a voice note being recorded, inputs not sent yet, a save to retry),
// the page loads the other place the old way instead: those must not go to the wrong project.
import { CACHE, SAVE, ingest, stopPoll } from './data'
import { failedWaiting } from './toast'
import { EMPTY_STATE, R_STATE, U, byN, byR, kids, model, render, resetPageState, setProject, ctx } from './state'
import { DV } from './voice'
import { P_CACHE } from './settings'
import { noticeFresh } from './notices'

/** Which page shows: the home page or a project; `booted` once a project's page has started in this page. */
export const PAGE = { home: !/^\/p\/[^/]+/.test(location.pathname), booted: false }
const shown = new Set<() => void>()
export function onPage(fn: () => void) {
  shown.add(fn)
  return () => void shown.delete(fn)
}
const setHome = (home: boolean) => {
  PAGE.home = home
  for (const fn of shown) fn()
}

const projectOf = (path: string) => {
  const m = /^\/p\/([^/]+)/.exec(path)
  return m ? decodeURIComponent(m[1]) : null
}
// B414: what you sent goes on in the background to the project it was written in, so it does not hold the page here
const busy = () => !PAGE.home && !!(R_STATE.rec || DV.rec || failedWaiting() || U.vcSending)

/** Go to `url` (an address in Taska) without loading the page again when it can; how: a new step in the history, the
 * step it replaces, or one the browser went back or forward to. Returns false when it is not a Taska address. */
export function goTo(url: string, how: 'push' | 'replace' | 'pop' = 'push'): boolean {
  const u = new URL(url, location.href)
  if (u.origin !== location.origin) return false
  const name = projectOf(u.pathname),
    home = u.pathname === '/'
  if (!name && !home) return false
  if ((home || name !== ctx.HERE) && busy()) {
    if (how === 'replace') location.replace(u.href)
    else if (how === 'push') location.assign(u.href)
    else location.reload()
    return true
  }
  const to = u.pathname + u.search + u.hash
  if (how === 'push') history.pushState(null, '', to)
  else if (how === 'replace') history.replaceState(null, '', to)
  if (home) {
    if (!PAGE.home) {
      stopPoll()
      setHome(true)
    }
    return true
  }
  if (!PAGE.home && name === ctx.HERE) {
    void import('./nav').then(({ applyURL }) => applyURL())
    return true
  }
  if (!PAGE.booted) {
    // from the home page into the first project of this page: it starts as a fresh page would
    void import('./boot').then(({ bootProject }) => {
      bootProject(name!)
      setHome(false)
    })
    return true
  }
  stopPoll()
  resetPageState()
  model.S = structuredClone(EMPTY_STATE)
  byN.clear()
  byR.clear()
  kids.clear()
  SAVE.last = ''
  P_CACHE.guide = null
  P_CACHE.log = null
  P_CACHE.logRev = -1
  noticeFresh()
  setProject(name!)
  const seen = CACHE.get(name!) // shown before in this page: drawn at once from that (B292)
  if (seen) {
    SAVE.last = seen
    ingest(JSON.parse(seen) as typeof EMPTY_STATE)
  }
  setHome(false)
  render()
  void import('./boot').then(({ enterProject, readStart }) => {
    readStart()
    render()
    void enterProject()
  })
  return true
}

/** Go to an address: in the page when it is a place in Taska, the browser's own way otherwise (T339). */
export function navigate(url: string, replace = false) {
  if (!goTo(url, replace ? 'replace' : 'push')) {
    if (replace) location.replace(url)
    else location.assign(url)
  }
}

/** Once for the whole page: links to places in Taska, and Back or Forward between the home page and a project. */
export function wireLinks() {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]')
      if (!a || a.target || a.hasAttribute('download') || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      if (!PAGE.home && a.hasAttribute('data-act')) return // its action decides
      const drawer = document.getElementById('drawer')
      const inDrawer = !PAGE.home && !!a.closest('#drawerList') && !!drawer && !drawer.hidden && innerWidth < 1024
      if (!goTo(a.href, inDrawer ? 'replace' : 'push')) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (inDrawer) void import('./nav').then(({ closeDrawer }) => closeDrawer())
    },
    true,
  )
  addEventListener('popstate', () => {
    const home = location.pathname === '/'
    if (home !== PAGE.home) goTo(location.href, 'pop') // the project page's own handler does the rest
  })
}
