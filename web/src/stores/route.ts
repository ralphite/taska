// Where you are: the address, read into a route. The browser's history is the truth; going somewhere writes it
// (a step Back can undo, or only a new address), and Back and Forward read it again.

import { createStore, type StoreApi } from 'zustand/vanilla'
import { parseRoute, type Route } from '../model/route'
import { TABS, type Tab } from '../model/words'

export type Side = 'docs' | 'log' | 'deleted'

export interface Place {
  path: string
  search: string
  hash: string
}

export interface History {
  location(): Place
  push(url: string, state?: unknown): void
  replace(url: string, state?: unknown): void
  state(): unknown
  back(): void
  /** n steps back at once */
  backBy(n: number): void
  /** calls back on Back and Forward; returns how to stop */
  listen(fn: () => void): () => void
}

export interface RouteState {
  route: Route
  url: string
  /** what is open over the page that Back closes (the phone's search, its drawer), the latest last */
  layers: readonly string[]
  /** the desktop's item full width (O): a step Back undoes; `link`: reached by a link while full width */
  full: boolean
  /** the list beside the pane on the desktop when it is Documents, Activity or Deleted: it stays while what you open
   * from it shows beside it */
  side: Side | null
  /** the desktop's New input page opened from an item or a document: its name, for the way back ("B333", "D89") */
  from: string | null
  /** this address came from the browser (the page loaded, Back or Forward), not from a step the page took */
  fromBrowser: boolean
  /** the list's tab came with the step (an item or a document opened in the page); without, the address was opened
   * as it is and the item's own tab is the list's */
  tabKept: boolean
  /** go full width, or back to the list (`here`: by rewriting this step, not going back) */
  setFull(on: boolean, here?: boolean): void
  /** go to an address: a step in the history (push) or the address rewritten; `layers`: what the new step has open
   * (a step from the drawer leaves it closed: its step becomes the new one); `tab`: the list's tab beside an item or a
   * document (their address does not say it) */
  go(url: string, push?: boolean, layers?: readonly string[], from?: string | null, tab?: Tab): void
  /** something opens over the page: a step Back undoes */
  openLayer(kind: string): void
  /** it closes by its own button: its step goes too; `then` runs once the history has moved */
  shutLayer(kind: string, then?: () => void): void
  /** n steps back in the history */
  backBy(n: number): void
  /** the page opened at this address (an item, on the phone): `under` goes under it in the history, so Back lands
   * there (once: a reload finds it there) */
  putUnder(under: string): void
  /** the history moved (Back, Forward): read it again */
  read(): void
}

export type RouteStore = StoreApi<RouteState>

const urlOf = (p: Place) => p.path + p.search + p.hash
const placeOf = (url: string): [string, string, string] => {
  const u = new URL(url, 'http://taska.local')
  return [u.pathname, u.search, u.hash]
}
/** an item's or a document's address */
const itemOrDoc = (url: string) => {
  const r = parseRoute(...placeOf(url))
  return r.page === 'project' && (r.place.kind === 'item' || r.place.kind === 'doc')
}
const fullOf = (state: unknown) => !!(state as { full?: unknown } | null)?.full
const SIDES: readonly string[] = ['docs', 'log', 'deleted']
const sideOf = (route: Route, state: unknown): Side | null => {
  if (route.page !== 'project') return null
  if (route.place.kind === 'side') return route.place.side
  const s = (state as { side?: unknown } | null)?.side
  return (route.place.kind === 'item' || route.place.kind === 'doc') && typeof s === 'string' && SIDES.includes(s) ? (s as Side) : null
}
const fromOf = (route: Route, state: unknown): string | null => {
  const f = (state as { from?: unknown } | null)?.from
  return route.page === 'project' && route.place.kind === 'new' && typeof f === 'string' ? f : null
}
/** The list's tab beside an item or a document, kept in its step (none: the address was opened as it is) */
export const keptTab = (state: unknown): Tab | null => {
  const t = (state as { tab?: unknown } | null)?.tab
  return typeof t === 'string' && (TABS as readonly string[]).includes(t) ? (t as Tab) : null
}
const withTab = (route: Route, state: unknown): Route => {
  const t = keptTab(state)
  return t && route.page === 'project' && (route.place.kind === 'item' || route.place.kind === 'doc') ? { ...route, tab: t } : route
}
const layersOf = (state: unknown): string[] => {
  const l = (state as { layers?: unknown } | null)?.layers
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : []
}

export function createRouteStore(history: History): RouteStore {
  const at = history.location()
  let after: (() => void) | null = null
  /** steps back the page took itself, whose arrival is not the browser's */
  let ownBack = 0
  const stepBack = (n = 1) => {
    ownBack++
    if (n === 1) history.back()
    else history.backBy(n)
  }
  const now = () => {
    const p = history.location()
    const route = withTab(parseRoute(p.path, p.search, p.hash), history.state())
    return { route, url: urlOf(p), layers: layersOf(history.state()), full: fullOf(history.state()), side: sideOf(route, history.state()), from: fromOf(route, history.state()), tabKept: !!keptTab(history.state()), fromBrowser: false }
  }
  const first = withTab(parseRoute(at.path, at.search, at.hash), history.state())
  return createStore<RouteState>()((set, get) => ({
    route: first,
    url: urlOf(at),
    layers: layersOf(history.state()),
    full: fullOf(history.state()),
    side: sideOf(first, history.state()),
    from: fromOf(first, history.state()),
    tabKept: !!keptTab(history.state()),
    fromBrowser: true,
    go: (url, push = false, layers, from, tab) => {
      const open = get().layers
      if (url === get().url && layers === undefined && (tab === undefined || tab === keptTab(history.state()))) return
      // full width goes on to what a link opens; Back from there comes back; so does the side list, beside what opens
      const full = get().full ? { full: true, link: true } : {}
      const side = get().side
      const to = side ? parseRoute(...placeOf(url)) : null
      const keep = side && to?.page === 'project' && (to.place.kind === 'item' || to.place.kind === 'doc') ? { side } : {}
      const back = from ? { from } : {}
      const lists = tab && itemOrDoc(url) ? { tab } : {}
      const state = (l: readonly string[]) => (l.length || get().full || 'side' in keep || from || 'tab' in lists ? { ...full, ...keep, ...back, ...lists, ...(l.length ? { layers: [...l] } : {}) } : null)
      if (push && url !== get().url) {
        // from the drawer: its step becomes the new one (as closing it, then going on, would leave the history)
        if (open.includes('drawer')) history.replace(url, state(layers ?? open.filter((k) => k !== 'drawer')))
        else history.push(url, state(layers ?? []))
      } else history.replace(url, layers === undefined ? (tab === undefined ? history.state() : { ...((history.state() as object | null) ?? {}), ...lists }) : state(layers))
      set(now())
    },
    setFull: (on, here = false) => {
      if (on === get().full) return
      const st = (history.state() || {}) as Record<string, unknown>
      if (on) history.push(get().url, { ...st, full: true })
      else if (st.full && !st.link && !here) return stepBack() // Back leaves full width
      else {
        const rest = { ...st }
        delete rest.full
        delete rest.link
        history.replace(get().url, Object.keys(rest).length ? rest : null)
      }
      set(now())
    },
    openLayer: (kind) => {
      const open = get().layers
      if (open.includes(kind)) return
      history.push(get().url, { layers: [...open, kind] })
      set(now())
    },
    shutLayer: (kind, then) => {
      const open = get().layers
      if (open.at(-1) === kind) {
        after = then ?? null
        stepBack()
      } else {
        if (open.includes(kind)) history.replace(get().url, { layers: open.filter((k) => k !== kind) })
        set(now())
        then?.()
      }
    },
    backBy: (n) => stepBack(n),
    putUnder: (under) => {
      const st = history.state() as Record<string, unknown> | null
      if (st?.under) return
      const here = get().url
      history.replace(under, null)
      history.push(here, { ...(st ?? {}), under: true })
      set({ ...now(), fromBrowser: get().fromBrowser })
    },
    read: () => {
      const mine = ownBack > 0
      if (mine) ownBack--
      set({ ...now(), fromBrowser: !mine })
      const run = after
      after = null
      run?.()
    },
  }))
}

export function browserHistory(): History {
  return {
    location: () => ({ path: location.pathname, search: location.search, hash: location.hash }),
    push: (url, state) => window.history.pushState(state ?? null, '', url),
    replace: (url, state) => window.history.replaceState(state ?? null, '', url),
    state: () => window.history.state,
    back: () => window.history.back(),
    backBy: (n) => window.history.go(-n),
    listen: (fn) => {
      addEventListener('popstate', fn)
      return () => removeEventListener('popstate', fn)
    },
  }
}
