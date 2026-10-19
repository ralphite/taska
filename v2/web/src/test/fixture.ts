// A small project state for tests: items in every place an item can be, an input, a document.
import { EMPTY_STATE, setProject } from '../lib/state'
import { ingest } from '../lib/data'
import type { Item, State } from '../lib/types'

export function item(n: number, f: Partial<Item> = {}): Item {
  return {
    n,
    code: '',
    type: 'task',
    title: `Item ${n}`,
    body: '',
    pri: 'P2',
    when: 'now',
    status: 'open',
    parent: null,
    next: '',
    thread: [],
    srcs: [],
    merged_into: null,
    archived: false,
    t0: '2026-10-19T10:00:00+08:00',
    t1: `2026-10-19T10:${String(n).padStart(2, '0')}:00+08:00`,
    wait: null,
    reply: false,
    ...f,
  }
}
export function load(items: Item[], extra: Partial<State> = {}) {
  setProject('demo')
  const S: State = {
    ...EMPTY_STATE,
    rev: 1,
    boot: 'b',
    project: 'demo',
    title: 'Demo',
    base: 'http://127.0.0.1:7341/p/demo',
    org: { on: false, model: '', busy: null },
    items,
    inputs: [],
    deleted: [],
    docs: [],
    gone: [],
    ...extra,
  }
  ingest(S)
  return S
}
export const ask = (n: number, text: string) => ({
  id: 100 + n,
  kind: 'ask',
  by: 'claude-code',
  text,
  t: '2026-10-19T11:00:00+08:00',
})
