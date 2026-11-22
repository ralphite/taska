// Which tasks a list shows: by tab, by the preset view (on Tasks the status is a view, not a filter) and by the
// filters, in the list's order. Pure: from the project and the list's settings.

import { closed } from './tasks'
import { needsYou } from './needStates'
import type { ListKey, ListQuery } from './route'
import type { Task } from './types'
import { OLD_LETTERS } from './vocab.gen'
import { ARCHIVE_FILTER_WORD, SORT_WORDS, STATUS_FILTER_WORD, STATUS_WORD, WHEN_WORD, type Tab } from './words'

/** A task's words, for picking one by them on the page: its code (and the older ones: T12 is T12), tags, title, text, next and talk (what the server finds
 * a task by is gathered in one place too: domain/finding.task_text). */
const HAY = new WeakMap<Task, string>()
export function hay(it: Task): string {
  let h = HAY.get(it)
  if (h === undefined) {
    h = (it.code + ' ' + [...OLD_LETTERS].map((l) => l + it.n).join(' ') + ' ' + it.tags.map((t) => '#' + t).join(' ') + ' ' + it.title + ' ' + it.body + ' ' + it.next + ' ' + it.thread.map((x) => x.text).join(' ')).toLowerCase()
    HAY.set(it, h)
  }
  return h
}

/** On Tasks with the usual order the status is the preset view the list shows, not a filter laid over it. */
export const statusIsView = (tab: Tab, list: ListQuery) => tab === 'tasks' && list.sort === 'all'

/** Anything narrows the list: a filter. */
export const filtered = (tab: Tab, list: ListQuery) =>
  !!(list.tag !== 'all' || list.when !== 'all' || (list.status !== 'all' && !statusIsView(tab, list)) || list.pri !== 'all')

/** Tasks shows the work; Archive what was put away (the Rules tab is the rules document, T693: no tasks). */
export const inTab = (it: Task, t: Tab | string) => (t === 'rules' ? false : t === 'archive' ? it.archived : !it.archived)

export const tabOf = (it: Task): Tab => (it.archived ? 'archive' : 'tasks')

function statusOk(it: Task, tab: Tab, list: ListQuery): boolean {
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

function tabOk(_it: Task, tab: Tab): boolean {
  return tab !== 'rules'
}

export function visible(tasks: readonly Task[], tab: Tab, list: ListQuery): Task[] {
  const order =
    list.sort === 'new'
      ? (a: Task, b: Task) => b.n - a.n
      : list.sort === 'upd'
        ? (a: Task, b: Task) => (b.t1 || '').localeCompare(a.t1 || '') || b.n - a.n
        : (a: Task, b: Task) => a.pri.localeCompare(b.pri) || a.n - b.n // same priority: oldest first, like /next
  return tasks
    .filter(
      (it) =>
        !it.mergedInto &&
        tabOk(it, tab) &&
        (list.tag === 'all' || it.tags.includes(list.tag)) &&
        (list.when === 'all' || it.when === list.when) &&
        (list.pri === 'all' || it.pri === list.pri) &&
        statusOk(it, tab, list),
    )
    .sort(order)
}

/** Not finished, on Tasks. */
export const openCount = (tasks: readonly Task[]) => tasks.filter((it) => !it.mergedInto && inTab(it, 'tasks') && !closed(it.status)).length

/** 1234 reads 1k. */
export const tabNumber = (n: number) => (n >= 1000 ? Math.floor(n / 1000) + 'k' : n || '')

/** The filters set on a list, each with its word (a tag, when, a status that is not the view, priority, sort). */
export function filtersSet(tab: Tab, list: ListQuery): [ListKey, string][] {
  const out: [ListKey, string][] = []
  if (list.tag !== 'all') out.push(['tag', '#' + list.tag])
  if (list.when !== 'all') out.push(['when', WHEN_WORD[list.when as 'now'] ?? list.when])
  if (list.status !== 'all' && !statusIsView(tab, list))
    out.push(['status', STATUS_FILTER_WORD[list.status] || ARCHIVE_FILTER_WORD[list.status] || STATUS_WORD[list.status as 'open']])
  if (list.pri !== 'all') out.push(['pri', list.pri])
  if (list.sort !== 'all') out.push(['sort', SORT_WORDS.find(([v]) => v === list.sort)?.[1] ?? list.sort])
  return out
}

/** Whether the list shows exactly one of your views (its tag, when, status, priority and sort). */
export const showsView = (list: Record<string, string>, v: Record<'tag' | 'when' | 'status' | 'pri' | 'sort', string>) => (['tag', 'when', 'status', 'pri', 'sort'] as const).every((k) => list[k] === v[k])

/** The list shows the work order (so a row dragged near another's top or bottom is put before or after it, T754):
 * Tasks in its own order, not the finished nor what waits on you. */
export const inWorkOrder = (tab: Tab, list: ListQuery) =>
  tab === 'tasks' && list.sort === 'all' && !['done', 'dropped', 'wait'].includes(list.status)
