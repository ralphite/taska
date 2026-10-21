// The address (T102): /p/<project>/ is Items; /inputs /archive /rules a tab; /B03 an item; /D4 a document; /new the
// New input page; /agents /log /projects /phone /spellings ... the sections of Settings, /settings their list (B162);
// ?q= and the filters ride along. Changing tab, opening a document, a section of Settings or New input, an item on the
// phone and full width are steps Back can undo, and so is a link to an item (B9); choosing items in the list on the
// desktop, search and filters only rewrite the address.
//
// Back on the phone (B150): every sheet, the Go through card, the image viewer, the projects drawer and search is one
// step in the history, so Back closes what is on top and only that.
import { PSEC } from './settings-data'
import { D, U, byN, code, ctx, desk, docById, els, liveN, parseRef, tabOf, type UI } from './state'
import type { Tab } from './constants'

export const URLS = { applying: false, selfBack: false, hold: false }
export const viewPath = (): string =>
  D.page
    ? D.section
      ? PSEC[D.section][0]
      : 'settings'
    : U.doc && !U.docEdit
      ? `D${U.doc}`
      : desk() && D.compose
        ? 'new'
        : desk() && U.tab === 'inputs'
          ? 'inputs'
          : U.open
            ? code(U.open)
            : desk() && U.side
              ? PSEC[U.side][0]
              : U.tab === 'items'
                ? ''
                : U.tab
export function viewQuery() {
  const q = new URLSearchParams()
  if (U.q) q.set('q', U.q)
  for (const k of ['type', 'when', 'status', 'pri', 'sort'] as const) if (U[k] && U[k] !== 'all') q.set(k, U[k])
  const s = q.toString()
  return s ? '?' + s : ''
}

const LAY = { back: 0, q: [] as (() => void)[], t: 0, at: '', popping: false }
export const here = () => location.pathname + location.search
export function hist(fn: () => void) {
  if (LAY.back) LAY.q.push(fn)
  else {
    fn()
    LAY.at = here()
  }
}
function histBack() {
  // a step back the page takes itself: its popstate changes nothing
  LAY.back++
  history.back()
  clearTimeout(LAY.t)
  LAY.t = window.setTimeout(histDone, 1500) // no step to go back to: go on anyway
}
function histDone() {
  LAY.back = 0
  clearTimeout(LAY.t)
  while (!LAY.back && LAY.q.length) LAY.q.shift()?.()
  LAY.at = here()
}
/** A popstate the page caused itself (histBack): it changes nothing. -> whether it was one. */
export function ownPop() {
  if (!LAY.back) return false
  if (--LAY.back === 0) histDone()
  return true
}
export const layAt = () => LAY.at
export const setLayAt = () => {
  LAY.at = here()
}
export const layersNow = (): string[] => (history.state?.layers as string[]) || []
export const searchStep = () => (!desk() && U.searching ? { layers: ['search'] } : {})
export function layerOpen(kind: string) {
  if (desk() || URLS.applying) return
  hist(() => {
    if (!layersNow().includes(kind))
      history.pushState({ ...(history.state || {}), layers: [...layersNow(), kind] }, '', location.href)
  })
}
export function layerShut(kind: string) {
  // closed by its own button: its step goes too
  if (desk() || LAY.popping) return
  hist(() => {
    const l = layersNow()
    if (l.at(-1) === kind) {
      histBack()
      hist(() => writeURL(false))
    } else if (l.includes(kind)) history.replaceState({ ...history.state, layers: l.filter((k) => k !== kind) }, '')
  })
}
export const isPopping = () => LAY.popping
export function setPopping(on: boolean) {
  LAY.popping = on
}
export function writeURL(push = false, state?: unknown) {
  if (URLS.applying || URLS.hold) return
  hist(() => {
    const url = ctx.P + viewPath() + viewQuery(),
      now = location.pathname + location.search + location.hash
    if (push && url !== now) history.pushState(state ?? { v: viewPath(), ...searchStep() }, '', url)
    else if (url !== now || state !== undefined)
      history.replaceState(state === undefined ? history.state : state, '', url)
  })
}
// A view you leave by Esc or x: if it was a step in the history, step back; otherwise just rewrite the address.
export function leaveView(v: string) {
  if (URLS.applying) return false
  if (!desk()) {
    hist(() => {
      if (history.state?.v === v) histBack()
      else writeURL(false)
    })
    return true
  }
  if (history.state?.v === v) {
    URLS.selfBack = true
    history.back()
    return true
  }
  return false
}
export function readURL() {
  const seg = decodeURIComponent(location.pathname.slice(ctx.P.length)).replace(/\/$/, '')
  const old = location.hash.slice(1) // links from before: #B03
  return { seg: seg || (parseRef(old) ? old : ''), qs: new URLSearchParams(location.search) }
}
export function fixURL() {
  const seg = decodeURIComponent(location.pathname.slice(ctx.P.length)).replace(/\/$/, '')
  if (U.open && parseRef(seg) === U.open && seg !== code(U.open) && !/^[Dd]\d+$/.test(seg)) writeURL(false)
}
// B9: a step you leave keeps how far its page was scrolled, and Back puts it there again.
export const scroller = () =>
  D.page ? (D.section || desk() ? els.projectBody : els.projectNav) : U.tab === 'inputs' ? els.inputsView : els.list
export function keepPlace() {
  if (URLS.applying || URLS.hold || !(desk() || D.page)) return
  const top = scroller()?.scrollTop ?? 0,
    keep = () => history.replaceState({ ...history.state, top }, '')
  if (desk()) keep()
  else hist(keep) // after a step back that is on its way (B150)
}
export function restorePlace() {
  const top = history.state?.top,
    el = (desk() || D.page) && typeof top === 'number' && scroller()
  if (el)
    requestAnimationFrame(() => {
      el.scrollTop = top
    })
}
export const PSEC_AT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PSEC).map(([sec, [path]]) => [path, sec])),
  settings: 'agents',
  connect: 'connect',
  about: 'projects',
}

// The page follows the address: when it loads, and on Back / Forward. Each part is done by nav.ts.
export interface UrlTarget {
  doc?: number
  item?: number
  section?: string | null
  side?: 'docs' | 'log' | 'deleted'
  compose?: 'new'
  tab: Tab
}
export function parseTarget(seg: string): UrlTarget {
  const doc = /^[Dd](\d+)$/.exec(seg),
    n = doc ? 0 : parseRef(seg)
  if (doc) return { doc: Number(doc[1]), tab: U.tab }
  if (n && byN.has(n)) return { item: n, tab: tabOf(byN.get(liveN(n)) as NonNullable<ReturnType<typeof byN.get>>) }
  if (desk() && /^(docs|log|deleted)$/.test(seg)) return { side: seg as 'docs', tab: U.tab } // T402
  if (Object.hasOwn(PSEC_AT, seg)) return { section: seg, tab: U.tab }
  if (seg === 'new') return { compose: 'new', tab: U.tab }
  return { tab: (/^(inputs|archive|rules)$/.test(seg) ? seg : 'items') as Tab }
}
export function readFilters(qs: URLSearchParams, u: UI = U) {
  u.q = qs.get('q') || ''
  if (els.q) els.q.value = u.q
  for (const k of ['type', 'when', 'status', 'pri', 'sort'] as const) u[k] = qs.get(k) || 'all'
}
export const docExists = (d: number) => !!docById(d)
