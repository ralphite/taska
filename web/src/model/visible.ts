// Which items a list shows: by tab, by the preset view (on Items the status is a view, not a filter) and by the
// filters, in the list's order. Pure: from the project and the list's settings.

import { closed } from './items'
import { needsYou } from './needStates'
import type { ListKey, ListQuery } from './route'
import type { Item } from './types'
import { ARCHIVE_FILTER_WORD, LETTER, SORT_WORDS, STATUS_FILTER_WORD, STATUS_WORD, WHEN_WORD, type Tab } from './words'

/** An item's words, for picking one by them on the page: its code, title, text, next and talk (what the server finds
 * an item by is gathered in one place too: domain/finding.item_text). */
const HAY = new WeakMap<Item, string>()
export function hay(it: Item): string {
  let h = HAY.get(it)
  if (h === undefined) {
    h = (it.code + ' ' + LETTER[it.type] + it.n + ' ' + it.title + ' ' + it.body + ' ' + it.next + ' ' + it.thread.map((x) => x.text).join(' ')).toLowerCase()
    HAY.set(it, h)
  }
  return h
}

/** On Items with the usual order the status is the preset view the list shows, not a filter laid over it. */
export const statusIsView = (tab: Tab, list: ListQuery) => tab === 'items' && list.sort === 'all'

/** Anything narrows the list: a filter. */
export const filtered = (tab: Tab, list: ListQuery) =>
  !!(list.type !== 'all' || list.when !== 'all' || (list.status !== 'all' && !statusIsView(tab, list)) || list.pri !== 'all')

/** Items shows the work; Archive what was put away (the Rules tab is the rules document, I693: no items). */
export const inTab = (it: Item, t: Tab | string) => (t === 'rules' ? false : t === 'archive' ? it.archived : !it.archived)

export const tabOf = (it: Item): Tab => (it.archived ? 'archive' : 'items')

function statusOk(it: Item, tab: Tab, list: ListQuery): boolean {
  const s = list.status
  if (tab === 'archive')
    return it.archived && (s === 'all' || s === 'archived' || (s === 'active' ? !closed(it.status) : it.status === s))
  if (s === 'archived') return it.archived
  if (it.archived) return false
  if (s === 'every') return true
  if (s === 'all') return statusIsView(tab, list) ? !closed(it.status) && it.when === 'now' : true
  if (s === 'active') return !closed(it.status)
  if (s === 'wait') return needsYou(it)
  if (s === 'open') return it.status === 'open' && it.when === 'now'
  if (s === 'later') return it.when === 'later' && !closed(it.status)
  return it.status === s
}

function tabOk(_it: Item, tab: Tab): boolean {
  return tab !== 'rules'
}

export function visible(items: readonly Item[], tab: Tab, list: ListQuery): Item[] {
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
        (list.type === 'all' || it.type === list.type) &&
        (list.when === 'all' || it.when === list.when) &&
        (list.pri === 'all' || it.pri === list.pri) &&
        statusOk(it, tab, list),
    )
    .sort(order)
}

/** Not finished, on Items. */
export const openCount = (items: readonly Item[]) => items.filter((it) => !it.mergedInto && inTab(it, 'items') && !closed(it.status)).length

/** 1234 reads 1k. */
export const tabNumber = (n: number) => (n >= 1000 ? Math.floor(n / 1000) + 'k' : n || '')

/** The filters set on a list, each with its word (a type, when, a status that is not the view, priority, sort). */
export function filtersSet(tab: Tab, list: ListQuery): [ListKey, string][] {
  const out: [ListKey, string][] = []
  if (list.type !== 'all') out.push(['type', list.type[0].toUpperCase() + list.type.slice(1)])
  if (list.when !== 'all') out.push(['when', WHEN_WORD[list.when as 'now'] ?? list.when])
  if (list.status !== 'all' && !statusIsView(tab, list))
    out.push(['status', STATUS_FILTER_WORD[list.status] || ARCHIVE_FILTER_WORD[list.status] || STATUS_WORD[list.status as 'open']])
  if (list.pri !== 'all') out.push(['pri', list.pri])
  if (list.sort !== 'all') out.push(['sort', SORT_WORDS.find(([v]) => v === list.sort)?.[1] ?? list.sort])
  return out
}

/** Whether the list shows exactly one of your views (its type, when, status, priority and sort). */
export const showsView = (list: Record<string, string>, v: Record<'type' | 'when' | 'status' | 'pri' | 'sort', string>) => (['type', 'when', 'status', 'pri', 'sort'] as const).every((k) => list[k] === v[k])

/** The list shows the work order (so a row dragged near another's top or bottom is put before or after it, B754):
 * Items in its own order, not the finished nor what waits on you. */
export const inWorkOrder = (tab: Tab, list: ListQuery) =>
  tab === 'items' && list.sort === 'all' && !['done', 'dropped', 'wait'].includes(list.status)
