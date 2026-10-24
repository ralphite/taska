// The page's addresses, read and written: / is every project; /p/<project>/ is its Items; /inputs /archive /rules a
// tab; /B03 an item; /D4 a document; /new the New input page; /docs /log /deleted the lists beside the items (on the
// desktop); /settings and its sections (/agents /projects /phone ...). The list's search and filters ride along as
// ?q= &type= &when= &status= &pri= &sort=. Addresses are part of the product: links and bookmarks depend on them.

import type { Tab } from './words'

export const LIST_KEYS = ['q', 'type', 'when', 'status', 'pri', 'sort'] as const
export type ListKey = (typeof LIST_KEYS)[number]
export type ListQuery = Record<ListKey, string>
export const NO_FILTERS: ListQuery = { q: '', type: 'all', when: 'all', status: 'all', pri: 'all', sort: 'all' }

/** The sections of Settings, by their address. */
export const SETTINGS_PATHS: Record<string, string> = {
  agents: 'agents',
  connect: 'connect',
  projects: 'projects',
  phone: 'phone',
  notifications: 'notifications',
  spellings: 'spellings',
  organizer: 'organizer',
  about: 'about',
}

export type Place =
  | { kind: 'tab' }
  | { kind: 'new' }
  | { kind: 'item'; ref: string }
  | { kind: 'doc'; d: number }
  | { kind: 'side'; side: 'docs' | 'log' | 'deleted' }
  | { kind: 'settings'; section: string | null }

export type Route =
  | { page: 'home'; query: URLSearchParams }
  | { page: 'dev'; path: string }
  | { page: 'project'; slug: string; tab: Tab; place: Place; list: ListQuery }

/** the project an address shows (none: '') */
export const routeSlug = (r: Route): string => (r.page === 'project' ? r.slug : '')

/** the number of the item an address opens (none: null) */
export function openItemN(r: Route): number | null {
  if (r.page !== 'project' || r.place.kind !== 'item') return null
  const n = Number(/\d+/.exec(r.place.ref)?.[0])
  return Number.isFinite(n) && n ? n : null
}

const ITEM = /^[A-Za-z]?\d+$/
const DOC = /^[Dd](\d+)$/

export function parseRoute(pathname: string, search: string, hash = ''): Route {
  if (pathname.startsWith('/dev/')) return { page: 'dev', path: pathname }
  const m = /^\/p\/([^/]+)\/?(.*)$/.exec(pathname)
  if (!m) return { page: 'home', query: new URLSearchParams(search) }
  const slug = decodeURIComponent(m[1])
  let seg = decodeURIComponent(m[2]).replace(/\/$/, '')
  if (!seg && ITEM.test(hash.slice(1))) seg = hash.slice(1) // links from before: #B03
  const qs = new URLSearchParams(search)
  const list = { ...NO_FILTERS }
  for (const k of LIST_KEYS) list[k] = qs.get(k) || NO_FILTERS[k]
  let tab: Tab = 'items'
  let place: Place = { kind: 'tab' }
  const doc = DOC.exec(seg)
  if (doc) place = { kind: 'doc', d: Number(doc[1]) }
  else if (ITEM.test(seg)) place = { kind: 'item', ref: seg }
  else if (seg === 'new') place = { kind: 'new' }
  else if (seg === 'docs' || seg === 'log' || seg === 'deleted') place = { kind: 'side', side: seg }
  else if (seg === 'settings') place = { kind: 'settings', section: null }
  else if (Object.hasOwn(SETTINGS_PATHS, seg)) place = { kind: 'settings', section: seg }
  else if (seg === 'inputs' || seg === 'archive' || seg === 'rules') tab = seg
  return { page: 'project', slug, tab, place, list }
}

export function listSearch(list: ListQuery): string {
  const q = new URLSearchParams()
  if (list.q) q.set('q', list.q)
  for (const k of ['type', 'when', 'status', 'pri', 'sort'] as const) if (list[k] && list[k] !== 'all') q.set(k, list[k])
  const s = q.toString()
  return s ? '?' + s : ''
}

/** The address of a place in a project. The list's search and filters ride along only where the list is. */
export function projectPath(slug: string, tab: Tab, place: Place, list: ListQuery): string {
  const base = `/p/${encodeURIComponent(slug)}/`
  switch (place.kind) {
    case 'settings':
      return base + (place.section ? SETTINGS_PATHS[place.section] : 'settings')
    case 'side':
      return base + place.side
    case 'doc':
      return base + `D${place.d}` + listSearch(list)
    case 'item':
      return base + place.ref + listSearch(list)
    case 'new':
      return base + (tab === 'items' ? 'new' : tab) + listSearch(list)
    case 'tab':
      return base + (tab === 'items' ? '' : tab) + listSearch(list)
  }
}
