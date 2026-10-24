// Which items a list shows: by tab, by the preset view (on Items the status is a view, not a filter), by the filters
// and the search, in the list's order. Pure: from the project and the list's settings.

import { closed, inQueue, needsYou } from './items'
import type { ListKey, ListQuery } from './route'
import type { Input, Item } from './types'
import { ARCHIVE_FILTER_WORD, LETTER, RULE_STATUS_WORD, SORT_WORDS, STATUS_FILTER_WORD, STATUS_WORD, WHEN_WORD, type Tab } from './words'

/** An item's words, for the search: its code, title, text, next and talk. */
const HAY = new WeakMap<Item, string>()
export function hay(it: Item): string {
  let h = HAY.get(it)
  if (h === undefined) {
    h = (it.code + ' ' + LETTER[it.type] + it.n + ' ' + it.title + ' ' + it.body + ' ' + it.next + ' ' + it.thread.map((x) => x.text).join(' ')).toLowerCase()
    HAY.set(it, h)
  }
  return h
}

export const searchWords = (q: string) => q.trim().toLowerCase().split(/\s+/).filter(Boolean)

/** On Items with the usual order the status is the preset view the list shows, not a filter laid over it. */
export const statusIsView = (tab: Tab, list: ListQuery) => tab === 'items' && list.sort === 'all'

/** Anything narrows the list: search words or a filter. */
export const filtered = (tab: Tab, list: ListQuery) =>
  !!(list.q.trim() || list.type !== 'all' || list.when !== 'all' || (list.status !== 'all' && !statusIsView(tab, list)) || list.pri !== 'all')

/** Items shows the work, and rules that wait on you (an agent proposed one, or asks about it). */
export const inTab = (it: Item, t: Tab | string) =>
  t === 'rules'
    ? it.type === 'rule' && !it.archived
    : t === 'archive'
      ? it.archived
      : !it.archived && (it.type !== 'rule' || it.status === 'proposed' || needsYou(it))

export const tabOf = (it: Item): Tab => (it.archived ? 'archive' : it.type === 'rule' ? 'rules' : 'items')

function statusOk(it: Item, tab: Tab, list: ListQuery): boolean {
  const s = list.status
  if (tab === 'rules') return s === 'all' || it.status === s
  if (tab === 'archive')
    return it.archived && (s === 'all' || s === 'archived' || (s === 'active' ? !closed(it.status) : it.status === s))
  if (s === 'archived') return it.archived
  if (it.archived) return false
  if (s === 'every') return true
  if (s === 'all') return statusIsView(tab, list) ? !closed(it.status) && it.when === 'now' : true
  if (s === 'active') return !closed(it.status)
  if (s === 'closed') return closed(it.status)
  if (s === 'wait') return needsYou(it)
  if (s === 'queued') return inQueue(it) && it.status !== 'doing' && it.when === 'now'
  if (s === 'later') return it.when === 'later' && !closed(it.status)
  return it.status === s
}

function tabOk(it: Item, tab: Tab): boolean {
  if (tab === 'rules') return it.type === 'rule' && !it.archived
  return tab === 'archive' || it.type !== 'rule' || (it.status === 'proposed' && !it.archived) || needsYou(it)
}

export function visible(items: readonly Item[], tab: Tab, list: ListQuery): Item[] {
  const words = searchWords(list.q)
  const order =
    list.sort === 'new'
      ? (a: Item, b: Item) => b.n - a.n
      : list.sort === 'upd'
        ? (a: Item, b: Item) => (b.t1 || '').localeCompare(a.t1 || '') || b.n - a.n
        : (a: Item, b: Item) => a.pri.localeCompare(b.pri) || a.n - b.n // same priority: oldest first, like /next
  return items
    .filter(
      (it) =>
        !it.mergedInto &&
        tabOk(it, tab) &&
        (list.type === 'all' || tab === 'rules' || it.type === list.type) &&
        (list.when === 'all' || it.when === list.when) &&
        (list.pri === 'all' || it.pri === list.pri) &&
        statusOk(it, tab, list) &&
        words.every((w) => hay(it).includes(w)),
    )
    .sort(order)
}

export const inputMatch = (r: Input, words: readonly string[]) => words.every((w) => (r.id + ' ' + r.text).toLowerCase().includes(w))

/** Not finished, on Items. */
export const openCount = (items: readonly Item[]) => items.filter((it) => !it.mergedInto && inTab(it, 'items') && !closed(it.status)).length

/** 1234 reads 1k. */
export const tabNumber = (n: number) => (n >= 1000 ? Math.floor(n / 1000) + 'k' : n || '')

/** The filters set on a list, each with its word (a type, when, a status that is not the view, priority, sort). */
export function filtersSet(tab: Tab, list: ListQuery): [ListKey, string][] {
  const out: [ListKey, string][] = []
  if (list.type !== 'all' && tab !== 'rules') out.push(['type', list.type[0].toUpperCase() + list.type.slice(1)])
  if (list.when !== 'all') out.push(['when', WHEN_WORD[list.when as 'now'] ?? list.when])
  if (list.status !== 'all' && !statusIsView(tab, list))
    out.push(['status', tab === 'rules' ? RULE_STATUS_WORD[list.status as 'open'] || STATUS_WORD[list.status as 'open'] : STATUS_FILTER_WORD[list.status] || ARCHIVE_FILTER_WORD[list.status] || STATUS_WORD[list.status as 'open']])
  if (list.pri !== 'all') out.push(['pri', list.pri])
  if (list.sort !== 'all') out.push(['sort', SORT_WORDS.find(([v]) => v === list.sort)?.[1] ?? list.sort])
  return out
}

/** Whether the list shows exactly one of your views (its type, when, status, priority and sort). */
export const showsView = (list: Record<string, string>, v: Record<'type' | 'when' | 'status' | 'pri' | 'sort', string>) => (['type', 'when', 'status', 'pri', 'sort'] as const).every((k) => list[k] === v[k])
