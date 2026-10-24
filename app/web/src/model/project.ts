// A project's data on the page: what the server sent (merged from the changes it sends), and the same with the
// changes you made that the server does not have yet laid over it. Both are plain values; nothing here changes in
// place.

import { closed } from './items'
import type { Doc, FileRef, Input, Item, ProjectFacts, ServerFacts, ViewAnswer } from './types'
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

/** A change to an item shown before the server has it; `add`: an item shown before the server makes it (its number
 * a stand-in's, from STAND up: its code reads "…" until Taska gives it one). */
export interface ItemPatch {
  n: number
  f: Partial<Item>
  add?: Item
  /** gone at once (deleted, moved to another project) */
  gone?: boolean
}

/** Stand-in numbers start here, above any real one, growing with time: a stand-in sorts after its older siblings. */
export const STAND = 1e12

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
/** A change to an input shown before the server has it (an edit, details added). */
export interface InputPatch {
  id: string
  f: Partial<Input>
  /** gone at once (deleted) */
  gone?: boolean
}

export function project(copy: ServerCopy, patches: readonly ItemPatch[] = [], at = copy.at, inputPatches: readonly InputPatch[] = []): ProjectModel {
  const byN = new Map(copy.items)
  for (const p of patches) {
    const it = byN.get(p.n)
    if (p.gone) byN.delete(p.n)
    else if (it) byN.set(p.n, patched(it, p.f))
    else if (p.add) byN.set(p.n, p.add)
  }
  const items = [...byN.values()]
  const kids = new Map<number, Item[]>()
  for (const it of items)
    if (it.parent && !it.mergedInto) {
      const list = kids.get(it.parent)
      if (list) list.push(it)
      else kids.set(it.parent, [it])
    }
  let byId: ReadonlyMap<string, Input> = copy.inputs
  if (inputPatches.length) {
    const m = new Map(copy.inputs)
    for (const p of inputPatches) {
      const r = m.get(p.id)
      if (p.gone) m.delete(p.id)
      else if (r) m.set(p.id, { ...r, ...p.f })
    }
    byId = m
  }
  const inputs = [...byId.values()]
  return {
    items,
    byN,
    kids,
    inputs,
    byId,
    docs: [...copy.docs.values()],
    facts: copy.facts,
    width: copy.facts.width,
    at,
  }
}

/** An item's code as the page shows it, padded to the project's width. */
export function codeOf(m: Pick<ProjectModel, 'byN' | 'width'>, n: number | null | undefined): string {
  if (n == null) return ''
  if (n >= STAND) return '\u2026'
  const it = m.byN.get(n)
  return (it ? LETTER[it.type] : '?') + String(n).padStart(m.width, '0')
}

/** The item a merged one went into, and on. */
export function liveN(m: Pick<ProjectModel, 'byN'>, n: number): number {
  let it = m.byN.get(n)
  for (let i = 0; it?.mergedInto && m.byN.has(it.mergedInto) && i < 50; i++) it = m.byN.get(it.mergedInto)
  return it ? it.n : n
}

/** An item's own files: those of the inputs it was made from (a reply keeps its files to itself). */
export function filesOf(m: Pick<ProjectModel, 'byId'>, it: Item): FileRef[] {
  const replies = new Set(it.thread.filter((x) => x.by === 'you' && x.src).map((x) => x.src))
  const seen = new Set<string>()
  const out: FileRef[] = []
  for (const rid of it.srcs)
    if (!replies.has(rid))
      for (const f of m.byId.get(rid)?.files || [])
        if (!seen.has(f.f)) {
          seen.add(f.f)
          out.push(f)
        }
  return out
}

/** An item's documents (not deleted). */
export const docsOf = (m: Pick<ProjectModel, 'docs'>, n: number) => m.docs.filter((d) => d.n === n)

/** What a code in some words names in this project: an item (its letter must match), a document, an input. */
export function findRef(m: Pick<ProjectModel, 'byN' | 'byId' | 'docs'>, c: string): { kind: 'item'; n: number } | { kind: 'doc'; d: number } | { kind: 'input'; id: string } | null {
  if (/^[rR#]\d+$/.test(c)) {
    const r = 'r' + c.slice(1)
    return m.byId.has(r) ? { kind: 'input', id: r } : null
  }
  const n = Number(c.slice(1))
  if (c[0] === 'D') return m.docs.some((d) => d.d === n) ? { kind: 'doc', d: n } : null
  const it = m.byN.get(n)
  return it && LETTER[it.type] === c[0] ? { kind: 'item', n } : null
}
