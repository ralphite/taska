// A project's data on the page: what the server sent (merged from the changes it sends), and the same with the
// changes you made that the server does not have yet laid over it. Both are plain values; nothing here changes in
// place.

import { closed } from './items'
import type { Doc, Input, Item, ProjectFacts, ServerFacts, ViewAnswer } from './types'
import { LETTER } from './words'

export interface ServerCopy {
  cursor: string
  items: ReadonlyMap<number, Item>
  inputs: ReadonlyMap<string, Input>
  docs: ReadonlyMap<number, Doc>
  facts: ProjectFacts
  server: ServerFacts
  /** when this answer came (ms) */
  at: number
}

/** A question on a closed item is history, not a pending one. */
const settled = (it: Item): Item => (closed(it.status) && it.wait ? { ...it, wait: null } : it)

/** The server's answer, come at `at`, folded into the copy the page has (all of it, or what changed). */
export function merge(prev: ServerCopy | null, a: ViewAnswer, at: number): ServerCopy {
  if (a.same && prev) return { ...prev, cursor: a.cursor, server: a.server, at }
  const full = a.full || !prev
  const items = new Map(full ? [] : prev.items)
  const inputs = new Map(full ? [] : prev.inputs)
  const docs = new Map(full ? [] : prev.docs)
  for (const n of a.removed?.items || []) items.delete(n)
  for (const id of a.removed?.inputs || []) inputs.delete(id)
  for (const d of a.removed?.docs || []) docs.delete(d)
  for (const it of a.items || []) items.set(it.n, settled(it))
  for (const r of a.inputs || []) inputs.set(r.id, r)
  for (const d of a.docs || []) docs.set(d.d, d)
  return { cursor: a.cursor, items, inputs, docs, facts: a.project ?? prev?.facts, server: a.server ?? prev?.server, at }
}

/** A change to an item shown before the server has it. */
export interface ItemPatch {
  n: number
  f: Partial<Item>
}

/** The fields of a patch over an item, as the server will make them: reopening brings an archived item back. */
export function patched(it: Item, f: Partial<Item>): Item {
  const back = 'status' in f && !closed(String(f.status)) && it.archived && !('archived' in f)
  const out: Item = { ...it, ...f }
  if (back) out.archived = false
  if (closed(out.status)) out.wait = null
  return out
}

export interface ProjectModel {
  /** live items in the server's order */
  items: Item[]
  byN: ReadonlyMap<number, Item>
  /** each item's subitems (not merged) */
  kids: ReadonlyMap<number, Item[]>
  inputs: Input[]
  byId: ReadonlyMap<string, Input>
  docs: Doc[]
  facts: ProjectFacts
  width: number
  /** the time its times are told against ("2m ago", quiet agents): when the server last answered or you last
   * changed something, as the page draws then */
  at: number
}

/** The page's view: the server's copy with your pending changes over it. */
export function project(copy: ServerCopy, patches: readonly ItemPatch[] = [], at = copy.at): ProjectModel {
  const byN = new Map(copy.items)
  for (const p of patches) {
    const it = byN.get(p.n)
    if (it) byN.set(p.n, patched(it, p.f))
  }
  const items = [...byN.values()]
  const kids = new Map<number, Item[]>()
  for (const it of items)
    if (it.parent && !it.mergedInto) {
      const list = kids.get(it.parent)
      if (list) list.push(it)
      else kids.set(it.parent, [it])
    }
  const inputs = [...copy.inputs.values()]
  return {
    items,
    byN,
    kids,
    inputs,
    byId: copy.inputs,
    docs: [...copy.docs.values()],
    facts: copy.facts,
    width: copy.facts.width,
    at,
  }
}

/** An item's code as the page shows it, padded to the project's width. */
export function codeOf(m: Pick<ProjectModel, 'byN' | 'width'>, n: number | null | undefined): string {
  if (n == null) return ''
  const it = m.byN.get(n)
  return (it ? LETTER[it.type] : '?') + String(n).padStart(m.width, '0')
}

/** The item a merged one went into, and on. */
export function liveN(m: Pick<ProjectModel, 'byN'>, n: number): number {
  let it = m.byN.get(n)
  for (let i = 0; it?.mergedInto && m.byN.has(it.mergedInto) && i < 50; i++) it = m.byN.get(it.mergedInto)
  return it ? it.n : n
}
