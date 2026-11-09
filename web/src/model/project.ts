// A project's data on the page: what the server sent (merged from the changes it sends), and the same with the
// changes you made that the server does not have yet laid over it. Both are plain values; nothing here changes in
// place.

import { closed } from './items'
import type { Comment, Doc, FileRef, Input, Item, Message, NoNews, ProjectFacts, ServerFacts, ViewAnswer, Voice } from './types'
import { LETTER } from './words'
import { draftKey, draftTarget } from './draftTarget'
import { isVoice, saidText, withVoice } from './voices'

export interface ServerCopy {
  cursor: string
  items: ReadonlyMap<number, Item>
  inputs: ReadonlyMap<string, Input>
  docs: ReadonlyMap<number, Doc>
  /** every voice note's words, by its file (B682) */
  voices: ReadonlyMap<string, Voice>
  facts: ProjectFacts
  server: ServerFacts
  /** when this answer came (ms) */
  at: number
}

/** A question on a closed item is history, not a pending one. */
const settled = (it: Item): Item => (closed(it.status) && it.wait ? { ...it, wait: null } : it)

/** The server's answer, come at `at`, folded into the copy the page has (all of it, or what changed; nothing changed
 * comes only for a copy there is). */
export function merge(prev: ServerCopy, a: ViewAnswer | NoNews, at: number): ServerCopy
export function merge(prev: ServerCopy | null, a: ViewAnswer, at: number): ServerCopy
export function merge(prev: ServerCopy | null, a: ViewAnswer | NoNews, at: number): ServerCopy {
  if (a.same) return { ...(prev as ServerCopy), cursor: a.cursor, server: a.server, at }
  const full = a.full || !prev
  const items = new Map(full ? [] : prev.items)
  const inputs = new Map(full ? [] : prev.inputs)
  const docs = new Map(full ? [] : prev.docs)
  const changed = full || !!a.voices?.length || !!a.removed?.voices?.length
  const voices = changed ? new Map(full ? [] : prev.voices) : prev.voices
  for (const n of a.removed?.items || []) items.delete(n)
  for (const id of a.removed?.inputs || []) inputs.delete(id)
  for (const d of a.removed?.docs || []) docs.delete(d)
  for (const f of a.removed?.voices || []) (voices as Map<string, Voice>).delete(f)
  for (const it of a.items || []) items.set(it.n, settled(it))
  for (const r of a.inputs || []) inputs.set(r.id, r)
  for (const d of a.docs || []) docs.set(d.d, d)
  for (const v of a.voices || []) (voices as Map<string, Voice>).set(v.f, v)
  return { cursor: a.cursor, items, inputs, docs, voices, facts: a.project ?? prev?.facts, server: a.server ?? prev?.server, at }
}

// -- what was said, with each voice note's words (B682) ---------------------------------------------------------

type Voices = ReadonlyMap<string, Voice>
const joined = new WeakMap<object, { voices: Voices; out: unknown }>()
/** Each thing with its voice notes' words, worked out once per thing and voices (a WeakMap memo of a pure function). */
function once<T extends object>(x: T, voices: Voices, make: () => T): T {
  const hit = joined.get(x)
  if (hit && hit.voices === voices) return hit.out as T
  const out = make()
  joined.set(x, { voices, out })
  return out
}

const filesWith = (files: FileRef[] | undefined, voices: Voices) => (files?.some(isVoice) ? files.map((f) => withVoice(f, voices)) : files || [])

/** An input as the page shows it: its files with their notes' words; `text` what was said (typed, then the words). */
export const inputWithVoices = (r: Input, voices: Voices): Input =>
  !r.files?.some(isVoice)
    ? r
    : once(r, voices, () => {
        const files = filesWith(r.files, voices)
        const typed = r.typed ?? r.text // put together before: what was typed stays what it was
        return { ...r, files, typed, text: saidText(typed, files) }
      })

export const commentWithVoices = (c: Comment, voices: Voices): Comment =>
  !c.files?.some(isVoice)
    ? c
    : once(c, voices, () => {
        const files = filesWith(c.files, voices)
        const typed = c.typed ?? c.text
        return { ...c, files, typed, text: saidText(typed, files) }
      })

const docWithVoices = (d: Doc, voices: Voices): Doc =>
  once(d, voices, () => {
    const cs = (list: Comment[]) => list.map((c) => commentWithVoices(c, voices))
    return { ...d, blocks: d.blocks.map((b) => ({ ...b, comments: cs(b.comments) })), whole: cs(d.whole || []), detached: d.detached.map((t) => ({ ...t, comments: cs(t.comments) })) }
  })

/** Your message is the input it came from: what it says has that input's voice notes' words after its own. */
const messageWithVoices = (x: Message, inputs: ReadonlyMap<string, Input>, voices: Voices): Message => {
  const r = x.by === 'you' && x.src && !x.change ? inputs.get(x.src) : undefined
  const own = r && r.files?.some(isVoice) && (x.id === r.seq || x.text.startsWith(`${r.id} updated:`))
  if (!own && !x.files?.some(isVoice)) return x
  const files = filesWith(x.files, voices)
  const typed = x.typed ?? x.text
  return { ...x, files, typed, text: own ? saidText(typed, filesWith(r.files, voices)) : typed }
}

export const itemWithVoices = (it: Item, inputs: ReadonlyMap<string, Input>, voices: Voices): Item =>
  once(it, voices, () => ({ ...it, thread: it.thread.map((x) => messageWithVoices(x, inputs, voices)) }))


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
  /** every voice note's words, by its file (B682) */
  voices: ReadonlyMap<string, Voice>
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

/** A change to a document shown before the server has it: deleted, a thread resolved or open again, a comment gone
 * or (shown while it is saved) there, its text edited. */
export type DocPatch =
  | { d: number; gone: true }
  | { d: number; resolved: { tk: string; on: boolean } }
  | { d: number; commentGone: number }
  | { d: number; comment: Comment }
  | { d: number; f: Partial<Pick<Doc, 'md' | 'title' | 'n'>> }

function patchedDoc(doc: Doc, p: DocPatch): Doc {
  if ('resolved' in p) {
    const resolved = { ...doc.resolved }
    if (p.resolved.on) resolved[p.resolved.tk] ||= new Date(0).toISOString()
    else delete resolved[p.resolved.tk]
    return { ...doc, resolved }
  }
  if ('commentGone' in p) {
    const keep = (cs: Comment[]) => cs.filter((c) => c.id !== p.commentGone)
    return { ...doc, whole: keep(doc.whole), blocks: doc.blocks.map((b) => ({ ...b, comments: keep(b.comments) })), detached: doc.detached.map((t) => ({ ...t, comments: keep(t.comments) })) }
  }
  if ('comment' in p) {
    const c = p.comment
    if (c.key === 'doc') return { ...doc, whole: [...doc.whole, c] }
    if (doc.blocks.some((b) => b.key === c.key)) return { ...doc, blocks: doc.blocks.map((b) => (b.key === c.key ? { ...b, comments: [...b.comments, c] } : b)) }
    return doc.fmt === 'html' ? { ...doc, blocks: [...doc.blocks, { key: c.key, kind: 'para', text: c.quote, comments: [c] }] } : doc
  }
  return 'f' in p ? { ...doc, ...p.f } : doc
}

export function project(copy: ServerCopy, patches: readonly ItemPatch[] = [], at = copy.at, inputPatches: readonly InputPatch[] = [], docPatches: readonly DocPatch[] = []): ProjectModel {
  const voices = copy.voices ?? new Map<string, Voice>()
  const joinedInputs = new Map<string, Input>()
  for (const [id, r] of copy.inputs) joinedInputs.set(id, inputWithVoices(r, voices))
  const byN = new Map<number, Item>()
  for (const [n, it] of copy.items) byN.set(n, itemWithVoices(it, copy.inputs, voices))
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
  let byId: ReadonlyMap<string, Input> = joinedInputs
  if (inputPatches.length) {
    const m = new Map(joinedInputs)
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
    docs: docPatches.length ? docsPatched(joinedDocs(copy.docs, voices), docPatches) : [...joinedDocs(copy.docs, voices).values()],
    voices,
    facts: copy.facts,
    width: copy.facts.width,
    at,
  }
}

function joinedDocs(docs: ReadonlyMap<number, Doc>, voices: Voices): ReadonlyMap<number, Doc> {
  const m = new Map<number, Doc>()
  for (const [d, doc] of docs) m.set(d, docWithVoices(doc, voices))
  return m
}

function docsPatched(docs: ReadonlyMap<number, Doc>, patches: readonly DocPatch[]): Doc[] {
  const m = new Map(docs)
  for (const p of patches) {
    const doc = m.get(p.d)
    if (!doc) continue
    if ('gone' in p) m.delete(p.d)
    else m.set(p.d, patchedDoc(doc, p))
  }
  return [...m.values()]
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

/** How many inputs an item was made from (an answer to its question is not one): its head's "From N inputs". */
export const sourceCount = (m: Pick<ProjectModel, 'byId'>, it: Item) => it.srcs.filter((id) => m.byId.get(id)?.kind !== 'answer').length

/** An item's documents (not deleted). */
export const docsOf = (m: Pick<ProjectModel, 'docs'>, n: number) => m.docs.filter((d) => d.n === n)

/** What a code in some words names in this project: an item (its letter must match), a document, an input. */
export function findRef(m: Pick<ProjectModel, 'byN' | 'byId' | 'docs'>, c: string): { kind: 'item'; n: number } | { kind: 'doc'; d: number } | { kind: 'input'; id: string } | null {
  if (/^[r#]\d+$/.test(c)) {
    const r = 'r' + c.slice(1)
    return m.byId.has(r) ? { kind: 'input', id: r } : null
  }
  const n = Number(c.slice(1))
  if (c[0] === 'D') return m.docs.some((d) => d.d === n) ? { kind: 'doc', d: n } : null
  const it = m.byN.get(n)
  return it && LETTER[it.type] === c[0] ? { kind: 'item', n } : null
}

/** The items with a draft not sent: words in any tab of this browser, or files waiting (a draft of a comment on a
 * document counts for the item it belongs to). */
export function draftCodes(m: ProjectModel, words: Readonly<Record<string, string>>, files: Readonly<Record<string, readonly unknown[]>>): Set<string> {
  const out = new Set<string>()
  for (const k of new Set([...Object.keys(words), ...Object.keys(files)])) {
    if (!String(words[k] || '').trim() && !files[k]?.length) continue
    const t = draftTarget(k)
    const doc = t.kind === 'doc' ? m.docs.find((x) => x.d === t.d) : undefined
    if (doc && doc.kind !== 'rules') out.add(codeOf(m, liveN(m, doc.n)))
    else if (t.kind === 'reply') out.add(t.code)
  }
  return out
}

/** Which of an input's drafts (an edit, details to add) waits, unless it is the one being written now. */
export function inputDraft(id: string, words: Readonly<Record<string, string>>, writing: { id: string; mode: 'edit' | 'append' } | null): 'edit' | 'append' | null {
  return (['edit', 'append'] as const).find((mode) => !(writing?.id === id && writing.mode === mode) && String(words[draftKey({ kind: 'amend', mode, id })] || '').trim()) || null
}

/** A new project's first steps (D115 #20), each done when the data says so: an agent has come, something was said
 * here (one deleted since counts), Taska was used on a phone. */
export function firstSteps(m: ProjectModel): { agent: boolean; input: boolean; phone: boolean } {
  return { agent: m.facts.agents.length > 0, input: m.inputs.length > 0 || m.facts.deletedInputs.length > 0, phone: !!m.facts.phone }
}
