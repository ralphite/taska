// T339: going to another project happens in the page, as in any web app: the address changes, the frame shows at once
// with that project's kept copy, and its data comes in behind. Its address stays the project's own (/p/<name>/...),
// so agents' and phone links keep working. While something of this project is still on its way (a voice note being
// recorded, inputs not sent yet, a save to retry), the page loads the other project the old way instead: those must
// not go to the wrong project.
import { CACHE, SAVE, ingest, stopPoll } from './data'
import { failedRetry } from './toast'
import { EMPTY_STATE, R_STATE, U, byN, byR, kids, model, render, resetPageState, setProject, ctx } from './state'
import { DV } from './voice'
import { P_CACHE } from './settings'
import { noticeFresh } from './notices'

const projectOf = (path: string) => {
  const m = /^\/p\/([^/]+)/.exec(path)
  return m ? decodeURIComponent(m[1]) : null
}
const busy = () => !!(R_STATE.rec || DV.rec || U.outbox.length || failedRetry.length || U.vcSending)

/** Go to `url` (an address in Taska) without loading the page again when it can; how: a new step in the history, the
 * step it replaces, or one the browser went back or forward to. Returns false when it is not a project address. */
export function goTo(url: string, how: 'push' | 'replace' | 'pop' = 'push'): boolean {
  const u = new URL(url, location.href)
  const name = u.origin === location.origin ? projectOf(u.pathname) : null
  if (!name) return false
  if (name !== ctx.HERE && busy()) {
    if (how === 'replace') location.replace(u.href)
    else if (how === 'push') location.assign(u.href)
    else location.reload()
    return true
  }
  if (how === 'push') history.pushState(null, '', u.pathname + u.search + u.hash)
  else if (how === 'replace') history.replaceState(null, '', u.pathname + u.search + u.hash)
  if (name === ctx.HERE) {
    void import('./nav').then(({ applyURL }) => applyURL())
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
  setProject(name)
  const seen = CACHE.get(name) // shown before in this page: drawn at once from that (B292)
  if (seen) {
    SAVE.last = seen
    ingest(JSON.parse(seen) as typeof EMPTY_STATE)
  }
  render()
  void import('./boot').then(({ enterProject, readStart }) => {
    readStart()
    render()
    void enterProject()
  })
  return true
}

/** Go to an address: in the page when it is a place in Taska, the browser's own way otherwise (T339). */
export function navigate(url: string) {
  if (!goTo(url)) location.assign(url)
}
