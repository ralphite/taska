// Made-up data for stories: items, inputs and the facts a row or a list shows, each built from a few fields.

import type { RowEvents, RowFacts, RowLook } from '../features/list/ListRows'
import type { Input, Item, Message } from '../model/types'

const T = '2026-10-23T14:30:00-07:00'

export function item(f: Partial<Item> & { n: number }): Item {
  return {
    code: 'F' + String(f.n).padStart(3, '0'),
    type: 'feature',
    title: 'Export ignores the active filter',
    body: '',
    pri: 'P2',
    when: 'now',
    status: 'open',
    parent: null,
    next: '',
    srcs: [],
    mergedInto: null,
    archived: false,
    t0: T,
    t1: T,
    by: 'you',
    thread: [],
    wait: null,
    talked: false,
    ...f,
  }
}

export function message(f: Partial<Message> & { id: number }): Message {
  return { by: 'claude-code', kind: 'progress', text: 'Reproduced it: the export reads the list before the filter.', t: T, src: null, files: [], ...f }
}

export function input(f: Partial<Input> & { id: string }): Input {
  return { t: T, by: 'you', text: 'The export should keep the filter I set.', scope: null, files: [], acked: false, touched: [], org: null, seq: 1, v: 0, ...f }
}

export function facts(f: Partial<RowFacts> = {}): RowFacts {
  return { code: 'F012', parentCode: null, image: null, kids: null, openKids: 0, talk: 0, draft: false, next: false, unread: false, worker: null, hitLine: null, ...f }
}

export const look = (desk: boolean, f: Partial<RowLook> = {}): RowLook => ({ current: false, selected: false, words: [], desk, ...f })

export const noRowEvents: RowEvents = {
  open: () => {},
  act: () => {},
  need: () => {},
  reopen: () => {},
  fold: () => {},
  goto: () => {},
  picture: () => {},
}

/** A small picture, drawn here, for a row's thumbnail. */
export const PICTURE =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#dbeafe"/><rect x="10" y="12" width="44" height="8" rx="2" fill="#60a5fa"/><rect x="10" y="28" width="60" height="6" rx="2" fill="#93c5fd"/><rect x="10" y="40" width="36" height="6" rx="2" fill="#93c5fd"/></svg>')
