// Where you are: the address, read into a route. The browser's history is the truth; going somewhere writes it
// (a step Back can undo, or only a new address), and Back and Forward read it again.

import { createStore, type StoreApi } from 'zustand/vanilla'
import { parseRoute, type Route } from '../model/route'

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
  /** calls back on Back and Forward; returns how to stop */
  listen(fn: () => void): () => void
}

export interface RouteState {
  route: Route
  url: string
  /** go to an address: a step in the history (push) or the address rewritten */
  go(url: string, push?: boolean, state?: unknown): void
  /** the history moved (Back, Forward): read it again */
  read(): void
}

export type RouteStore = StoreApi<RouteState>

const urlOf = (p: Place) => p.path + p.search + p.hash

export function createRouteStore(history: History): RouteStore {
  const at = history.location()
  return createStore<RouteState>()((set, get) => ({
    route: parseRoute(at.path, at.search, at.hash),
    url: urlOf(at),
    go: (url, push = false, state) => {
      if (url === get().url && state === undefined) return
      if (push && url !== get().url) history.push(url, state)
      else history.replace(url, state === undefined ? history.state() : state)
      const p = history.location()
      set({ route: parseRoute(p.path, p.search, p.hash), url: urlOf(p) })
    },
    read: () => {
      const p = history.location()
      set({ route: parseRoute(p.path, p.search, p.hash), url: urlOf(p) })
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
    listen: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}
