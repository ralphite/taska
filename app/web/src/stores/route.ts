// Where you are: the address, read into a route. The browser's history is the truth; going somewhere writes it
// (a step Back can undo, or only a new address), and Back and Forward read it again.

import { createStore, type StoreApi } from 'zustand/vanilla'
import { parseRoute, type Route } from '../model/route'

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
  /** go full width, or back to the list (`here`: by rewriting this step, not going back) */
  setFull(on: boolean, here?: boolean): void
  /** go to an address: a step in the history (push) or the address rewritten; `layers`: what the new step has open
   * (a step from the drawer leaves it closed: its step becomes the new one) */
  go(url: string, push?: boolean, layers?: readonly string[]): void
  /** something opens over the page: a step Back undoes */
  openLayer(kind: string): void
  /** it closes by its own button: its step goes too; `then` runs once the history has moved */
  shutLayer(kind: string, then?: () => void): void
  /** n steps back in the history */
  backBy(n: number): void
  /** the history moved (Back, Forward): read it again */
  read(): void
}

export type RouteStore = StoreApi<RouteState>

const urlOf = (p: Place) => p.path + p.search + p.hash
const placeOf = (url: string): [string, string, string] => {
  const u = new URL(url, 'http://taska.local')
  return [u.pathname, u.search, u.hash]
}
const fullOf = (state: unknown) => !!(state as { full?: unknown } | null)?.full
const SIDES: readonly string[] = ['docs', 'log', 'deleted']
const sideOf = (route: Route, state: unknown): Side | null => {
  if (route.page !== 'project') return null
  if (route.place.kind === 'side') return route.place.side
  const s = (state as { side?: unknown } | null)?.side
  return (route.place.kind === 'item' || route.place.kind === 'doc') && typeof s === 'string' && SIDES.includes(s) ? (s as Side) : null
}
const layersOf = (state: unknown): string[] => {
  const l = (state as { layers?: unknown } | null)?.layers
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : []
}

export function createRouteStore(history: History): RouteStore {
  const at = history.location()
  let after: (() => void) | null = null
  const now = () => {
    const p = history.location()
    const route = parseRoute(p.path, p.search, p.hash)
    return { route, url: urlOf(p), layers: layersOf(history.state()), full: fullOf(history.state()), side: sideOf(route, history.state()) }
  }
  const first = parseRoute(at.path, at.search, at.hash)
  return createStore<RouteState>()((set, get) => ({
    route: first,
    url: urlOf(at),
    layers: layersOf(history.state()),
    full: fullOf(history.state()),
    side: sideOf(first, history.state()),
    go: (url, push = false, layers) => {
      const open = get().layers
      if (url === get().url && layers === undefined) return
      // full width goes on to what a link opens; Back from there comes back; so does the side list, beside what opens
      const full = get().full ? { full: true, link: true } : {}
      const side = get().side
      const to = side ? parseRoute(...placeOf(url)) : null
      const keep = side && to?.page === 'project' && (to.place.kind === 'item' || to.place.kind === 'doc') ? { side } : {}
      const state = (l: readonly string[]) => (l.length || get().full || 'side' in keep ? { ...full, ...keep, ...(l.length ? { layers: [...l] } : {}) } : null)
      if (push && url !== get().url) {
        // from the drawer: its step becomes the new one (as closing it, then going on, would leave the history)
        if (open.includes('drawer')) history.replace(url, state(layers ?? open.filter((k) => k !== 'drawer')))
        else history.push(url, state(layers ?? []))
      } else history.replace(url, layers === undefined ? history.state() : state(layers))
      set(now())
    },
    setFull: (on, here = false) => {
      if (on === get().full) return
      const st = (history.state() || {}) as Record<string, unknown>
      if (on) history.push(get().url, { ...st, full: true })
      else if (st.full && !st.link && !here) return history.back() // Back leaves full width
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
        history.back()
      } else {
        if (open.includes(kind)) history.replace(get().url, { layers: open.filter((k) => k !== kind) })
        set(now())
        then?.()
      }
    },
    backBy: (n) => history.backBy(n),
    read: () => {
      set(now())
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

export function memoryHistory(start = '/'): History {
  const stack: { url: string; state: unknown }[] = [{ url: start, state: null }]
  let i = 0
  const subs = new Set<() => void>()
  const place = (): Place => {
    const u = new URL(stack[i].url, 'http://taska.local')
    return { path: u.pathname, search: u.search, hash: u.hash }
  }
  return {
    location: place,
    push: (url, state) => {
      stack.splice(i + 1)
      stack.push({ url, state: state ?? null })
      i++
    },
    replace: (url, state) => {
      stack[i] = { url, state: state ?? null }
    },
    state: () => stack[i].state,
    back: () => {
      if (i > 0) {
        i--
        for (const fn of subs) fn()
      }
    },
    backBy: (n) => {
      const to = Math.max(0, i - n)
      if (to === i) return
      i = to
      for (const fn of subs) fn()
    },
    listen: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}
