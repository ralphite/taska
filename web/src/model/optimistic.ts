// What a change shows before the server has it (refactor 7): one preview per command, made from the command alone, as
// the server's handler and projection will make it (server/taska/commands/, domain/projection/), so the page never
// shows for a moment something the server will not. ChangeRunner.change() is the one way a change is made: it
// shows its preview and sends it. tools/rule_cases.py runs the same commands on the server (model/ruleCases.gen.ts);
// optimistic.test.ts holds the previews to what it did.
//
// What the page cannot know it leaves to the server's answer: which subitems followed an item to Later, to Won't do
// or to Archive (the log knows; the view does not), so putting the item back shows only the item back at once.

import type { Command, CommandOf, Op } from './commands'
import { allComments, sameText } from './docs'
import { closed } from './items'
import { STAND, type DocPatch, type InputPatch, type ItemPatch, type ProjectModel } from './project'
import type { Comment, Doc, FileRef, Input, Item, ItemType, Status } from './types'
import { DECISIONS as DECIDE, DEFAULT_PRI, PEOPLE as WHO, PRIORITIES, STATUSES as ALL, TASKA, TYPES as KINDS, WHENS } from './vocab.gen'
import { saidText } from './voices'

/** What a change shows: its items', inputs' and documents' changes over the server's data. */
export interface Shown {
  patches: ItemPatch[]
  inputPatches: InputPatch[]
  docPatches: DocPatch[]
}

const PEOPLE: readonly string[] = WHO
const DECISIONS: Record<string, readonly string[]> = DECIDE
const TYPES: readonly string[] = KINDS
const STATUSES: readonly string[] = ALL
const NONE = ['', '-', 'none', 'null']

/** The project as the change goes on: the model with what the change did so far (a change may hold several
 * commands, each sees the ones before). */
class Work {
  readonly byN: Map<number, Item>
  readonly inputs: Map<string, Input>
  readonly docs: Map<number, Doc>
  readonly out: Shown = { patches: [], inputPatches: [], docPatches: [] }
  readonly m: ProjectModel
  readonly at: number
  constructor(m: ProjectModel, at: number) {
    this.m = m
    this.at = at
    this.byN = new Map(m.byN)
    this.inputs = new Map(m.byId)
    this.docs = new Map(m.docs.map((d) => [d.d, d]))
  }

  /** The item a reference names (B03, b3, 3); a merged one leads to where it went, unless `follow` is false. */
  item(ref: unknown, follow = true): Item | undefined {
    const m = /^([A-Za-z])?0*(\d+)$/.exec(String(ref ?? '').trim())
    let it = m ? this.byN.get(Number(m[2])) : undefined
    for (let i = 0; follow && it?.mergedInto && i < 50; i++) it = this.byN.get(it.mergedInto)
    return it
  }

  /** Every subitem under an item, at any depth (not merged). */
  under(n: number): Item[] {
    const out: Item[] = []
    for (let todo = [n]; todo.length; ) {
      const p = todo.pop()
      for (const k of this.byN.values())
        if (k.parent === p && !k.mergedInto) {
          out.push(k)
          todo.push(k.n)
        }
    }
    return out
  }

  put(n: number, f: Partial<Item>): void {
    const it = this.byN.get(n)
    if (!it) return
    this.byN.set(n, { ...it, ...f })
    this.out.patches.push({ n, f })
  }

  gone(n: number): void {
    this.byN.delete(n)
    this.out.patches.push({ n, f: {}, gone: true })
  }

  input(id: string, f: Partial<Input>): void {
    const r = this.inputs.get(id)
    if (!r) return
    this.inputs.set(id, { ...r, ...f })
    this.out.inputPatches.push({ id, f })
  }

  doc(p: DocPatch): void {
    this.out.docPatches.push(p)
  }
}

// -- items (commands/items.py) ---------------------------------------------------------------------------------

/** A field's value as sent -> as the server keeps it (commands/items.py field_value); undefined: refused. */
function value(w: Work, name: string, v: unknown, me: Item): { ok: boolean; v?: unknown } {
  const s = String(v ?? '')
  switch (name) {
    case 'type':
      return TYPES.includes(s.toLowerCase()) ? { ok: true, v: s.toLowerCase() } : { ok: false }
    case 'pri':
      return (PRIORITIES as readonly string[]).includes(s.toUpperCase()) ? { ok: true, v: s.toUpperCase() } : { ok: false }
    case 'when':
      return (WHENS as readonly string[]).includes(s.toLowerCase()) ? { ok: true, v: s.toLowerCase() } : { ok: false }
    case 'status': {
      const st = s.toLowerCase() === 'drop' ? 'dropped' : s.toLowerCase()
      return STATUSES.includes(st) ? { ok: true, v: st } : { ok: false }
    }
    case 'title': {
      const t = s.split(/\s+/).filter(Boolean).join(' ')
      return t ? { ok: true, v: t.slice(0, 300) } : { ok: false }
    }
    case 'body':
    case 'next':
      return { ok: true, v: s.trim() }
    case 'archived':
      return { ok: true, v: typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(s.toLowerCase()) }
    case 'later_until':
      if (v == null || NONE.includes(s.trim().toLowerCase())) return { ok: true, v: null }
      return /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? { ok: true, v: s.trim() } : { ok: false }
    case 'rank':
      if (v == null || NONE.includes(s.trim().toLowerCase())) return { ok: true, v: null }
      return Number.isFinite(Number(v)) ? { ok: true, v: Number(v) } : { ok: false }
    case 'parent': {
      if (NONE.includes(s.trim().toLowerCase())) return { ok: true, v: null }
      const p = w.item(v)
      for (let up = p, i = 0; up && i < 100; up = up.parent != null ? w.byN.get(up.parent) : undefined, i++) if (up.n === me.n) return { ok: false }
      return p ? { ok: true, v: p.n } : { ok: false }
    }
  }
  return { ok: false }
}

/** What you decided on a proposal or on finished work, kept on the item (domain/projection/items.py _set). */
export function decision(it: Item, to: string): Pick<Item, 'decided'> | null {
  const was = it.status
  const dec = it.decided
  if (to === was) return null
  if (DECISIONS[was]) {
    const last = [...it.thread].reverse().find((x) => !PEOPLE.includes(x.by) && x.by !== TASKA)
    return { decided: { from: was, to, msg: last?.id ?? null, t: '' } }
  }
  if (dec && dec.from === to) return { decided: null }
  if (dec && dec.to === was && DECISIONS[dec.from]?.includes(to)) return { decided: { ...dec, to } }
  return null
}

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null)

/** Fields put on an item by you: kept as they are, what you decided with them. */
function setOn(w: Work, it: Item, f: Partial<Item>): void {
  const dec = 'status' in f ? decision(it, String(f.status)) : null
  w.put(it.n, { ...f, ...(dec ?? {}), ...(f.status && closed(f.status) ? { wait: null } : {}) })
}

/** What you do to an item is done to the items under it (commands/items.py cascade): put Later, they go Later;
 * marked won't do, the unfinished ones too; archived, the finished ones too. (Back again: only the ones that
 * followed it, which the page does not know.) */
function cascade(w: Work, it: Item, f: Partial<Item>): void {
  for (const k of w.under(it.n)) {
    const g: Partial<Item> = {}
    if (f.when === 'later' && !closed(k.status) && k.when !== 'later') g.when = 'later'
    if (f.status === 'dropped' && !closed(k.status)) g.status = 'dropped'
    if (f.archived === true && closed(k.status) && !k.archived) g.archived = true
    if (Object.keys(g).length) setOn(w, k, g)
  }
}

function set(w: Work, c: CommandOf<'set'>): void {
  const it = w.item(c.ref)
  if (!it) return
  const f: Partial<Item> & Record<string, unknown> = {}
  for (const [k, v] of Object.entries(c.f || {})) {
    const x = value(w, k, v, it)
    if (!x.ok) return // refused: nothing changes
    if (!same(x.v, (it as unknown as Record<string, unknown>)[k])) f[k] = x.v
  }
  // Later until a day is Later; back to Now, or Later with no day, the day goes (D115 #21)
  if (f.later_until && it.when !== 'later') f.when = 'later'
  if (it.later_until && !('later_until' in f) && 'when' in f) f.later_until = null
  if (f.when === 'now' && f.later_until) return
  // any item can be archived; only setting it open again brings it back
  if (it.archived && 'status' in f && !closed(String(f.status)) && !('archived' in f)) f.archived = false
  if (!Object.keys(f).length) return
  setOn(w, it, f)
  cascade(w, it, f)
}

function archive(w: Work, c: CommandOf<'archive'>): void {
  const on = c.on ?? true
  const ns: number[] = []
  for (const ref of c.refs || []) {
    const it = w.item(ref, false)
    if (!it || it.archived === on || ns.includes(it.n) || (on && !closed(it.status))) continue
    ns.push(it.n)
  }
  if (on) for (const n of [...ns]) for (const k of w.under(n)) if (closed(k.status) && !k.archived && !ns.includes(k.n)) ns.push(k.n)
  for (const n of ns) w.put(n, { archived: on })
}

function newItem(w: Work, c: CommandOf<'new'>): void {
  const parent = c.parent ? w.item(c.parent) : undefined
  if (c.parent && !parent) return
  const title = c.title.split(/\s+/).filter(Boolean).join(' ').slice(0, 300)
  if (!title) return
  // a stand-in, its number from STAND up (its code reads "…" until Taska gives it one)
  const n = STAND + (w.at % 1e11) + w.out.patches.length
  const t = new Date(w.at).toISOString()
  const add: Item = {
    n, code: '…', type: (c.type || 'idea') as ItemType, title, body: (c.body || '').trim(), pri: c.pri || DEFAULT_PRI, when: c.when || 'now',
    status: (c.status || 'open') as Status, parent: parent?.n ?? null, next: (c.next || '').trim(), srcs: [], mergedInto: null, archived: false,
    t0: t, t1: t, by: 'you', thread: [], wait: null, talked: false, rank: null, decided: null,
  }
  w.byN.set(n, add)
  w.out.patches.push({ n, f: {}, add })
}

function remove(w: Work, c: CommandOf<'idel'>): void {
  const it = w.item(c.ref, false)
  if (!it) return
  for (const k of [it, ...w.under(it.n)]) w.gone(k.n)
}

function hide(w: Work, c: CommandOf<'hide'>): void {
  const it = w.item(c.ref)
  if (!it?.thread.some((x) => x.id === c.id && !PEOPLE.includes(x.by))) return
  const on = c.on ?? true
  w.put(it.n, { thread: it.thread.map((x) => (x.id === c.id ? { ...x, hidden: on } : x)) })
}

function merge(w: Work, c: CommandOf<'merge'>): void {
  const it = w.item(c.ref)
  const into = w.item(c.into)
  if (!it || !into || it.n === into.n) return
  for (const k of w.byN.values()) if (k.parent === it.n && !k.mergedInto && k.n !== into.n) w.put(k.n, { parent: into.n })
  w.put(it.n, { mergedInto: into.n })
}

function unmerge(w: Work, c: CommandOf<'unmerge'>): void {
  const it = w.item(c.ref, false)
  if (it?.mergedInto != null) w.put(it.n, { mergedInto: null })
}

/** One of your changes put back (the change log's Undo): its fields as they were. */
function revert(w: Work, c: CommandOf<'revert'>): void {
  const u = w.m.facts.undo.find((x) => x.seq === c.seq)
  const it = u ? w.byN.get(u.n) : undefined
  if (u && it) set(w, { op: 'set', ref: String(it.n), f: u.was as CommandOf<'set'>['f'] })
}

// -- what you said (commands/inputs.py) --------------------------------------------------------------------------

/** Words on an item waiting for review, or done, take it back to open (r961, r1082). */
function input(w: Work, c: CommandOf<'input'>): void {
  const it = c.scope && c.kind !== 'cancelled' ? w.item(c.scope) : undefined
  if (it && (it.status === 'review' || it.status === 'done')) setOn(w, it, { status: 'open' })
}

/** An input to Deleted, with the items only it made. */
function deleteInput(w: Work, c: CommandOf<'delete'>): void {
  const r = w.inputs.get(c.id)
  if (!r || r.moved) return
  for (const n of r.deletion?.go || []) if (w.byN.has(n)) w.gone(n)
  w.inputs.delete(c.id)
  w.out.inputPatches.push({ id: c.id, f: {}, gone: true })
}

/** Its files with the words you left for their notes. */
const withWords = (files: FileRef[], words: Record<string, string> | undefined): FileRef[] =>
  words ? files.map((f) => (f.voice && words[f.f]?.trim() ? { ...f, voice: { ...f.voice, tidied: words[f.f].trim() } } : f)) : files

function amend(w: Work, c: CommandOf<'amend'>): void {
  const r = w.inputs.get(c.id)
  if (!r || r.moved || (c.mode !== 'edit' && c.mode !== 'append')) return
  const was = r.typed ?? r.text
  const text = (c.text || '').trim()
  const typed = c.mode === 'append' ? [was, text].filter(Boolean).join('\n\n').trim() : text
  const files = withWords(r.files, c.words)
  w.input(c.id, { typed, text: saidText(typed, files), files })
}

function correct(w: Work, c: CommandOf<'correct'>): void {
  const r = w.inputs.get(c.id)
  const wrong = c.wrong.split(/\s+/).filter(Boolean).join(' ')
  const right = c.right.split(/\s+/).filter(Boolean).join(' ')
  if (!r || !wrong || !r.text.includes(wrong)) return
  const typed = r.typed ?? r.text
  if (typed.includes(wrong)) {
    const t = typed.split(wrong).join(right)
    return w.input(c.id, { typed: t, text: saidText(t, r.files) })
  }
  const files = r.files.map((f) => (f.voice && f.voice.tidied.includes(wrong) ? { ...f, voice: { ...f.voice, tidied: f.voice.tidied.split(wrong).join(right) } } : f))
  w.input(c.id, { files, text: saidText(typed, files) })
}

function rescope(w: Work, c: CommandOf<'rescope'>): void {
  const it = w.item(c.to)
  if (it && w.inputs.get(c.id)?.kind !== 'cancelled') w.input(c.id, { scope: it.n })
}

function unfile(w: Work, c: CommandOf<'unfile'>): void {
  if ('d' in c) {
    const doc = w.docs.get(c.d)
    const x = doc && allComments(doc).find((y) => y.id === c.id)
    if (x && PEOPLE.includes(x.by)) w.doc({ d: c.d, edited: { ...x, files: x.files.filter((f) => f.f !== c.f) } })
    return
  }
  const r = w.inputs.get(c.id)
  if (r?.files.some((f) => f.f === c.f)) w.input(c.id, { files: r.files.filter((f) => f.f !== c.f) })
}

// -- documents (commands/docs.py) --------------------------------------------------------------------------------

function writeDoc(w: Work, c: CommandOf<'doc'>): void {
  const doc = c.d ? w.docs.get(c.d) : undefined
  const md = c.md.trim()
  if (doc && md && doc.kind !== 'rules') w.doc({ d: doc.d, f: { md } })
}

/** A comment of yours shows at once in the thread it will be in: a reply in its own, words on the same selection in
 * the thread it started (domain/projection/docs.py thread_of). Its id a stand-in's (below 0). */
function comment(w: Work, c: CommandOf<'dc'>): void {
  const doc = w.docs.get(c.d)
  if (!doc) return
  const key = c.key ?? 'doc'
  const text = saidText(c.text || '', (c.files || []).map((f) => ({ f: f.f, name: f.name || '', mime: f.mime, voice: c.words?.[f.f] ? { f: f.f, state: 'done', said: '', tidied: c.words[f.f] } : undefined })))
  if (!text && !c.files?.length) return
  const mine = allComments(doc).filter((x) => x.key === key)
  // what you selected, else the paragraph (commands/docs.py comment)
  const block = key === 'doc' ? undefined : doc.blocks.find((b) => b.key === key)
  const quote = ((c.quote || '').split(/\s+/).filter(Boolean).join(' ') || (block?.text ?? '')).slice(0, 500)
  const th = c.th != null && mine.some((x) => x.th === c.th) ? c.th : (mine.find((x) => x.th === x.id && sameText(x.quote, quote))?.th ?? 0)
  const files: FileRef[] = (c.files || []).map((f) => ({ f: f.f, name: f.name || '', ...(f.mime ? { mime: f.mime } : {}), ...(f.size != null ? { size: f.size } : {}) }))
  const stand: Comment = { id: -(w.at + w.out.docPatches.length), key, th, quote, text: text || '…', by: 'you', t: new Date(w.at).toISOString(), files }
  w.doc({ d: c.d, comment: stand })
}

function editComment(w: Work, c: CommandOf<'dcedit'>): void {
  const doc = w.docs.get(c.d)
  const x = doc && allComments(doc).find((y) => y.id === c.id)
  if (!x || !PEOPLE.includes(x.by)) return
  const typed = c.text.trim()
  const files = withWords([...x.files, ...(c.files || []).map((f) => ({ f: f.f, name: f.name || '', mime: f.mime, size: f.size }))], c.words)
  w.doc({ d: c.d, edited: { ...x, typed, text: saidText(typed, files), files } })
}

function resolve(w: Work, c: CommandOf<'dcres'>): void {
  const doc = w.docs.get(c.d)
  if (!doc) return
  const ths = c.th ? [c.th] : [...new Set(allComments(doc).filter((x) => x.key === c.key).map((x) => x.th))]
  for (const th of ths) w.doc({ d: c.d, resolved: { tk: `${c.key}#${th}`, on: c.on ?? true } })
}

function moveDoc(w: Work, c: CommandOf<'dmove'>): void {
  const doc = w.docs.get(c.d)
  const it = w.item(c.to)
  if (doc && it && doc.kind !== 'rules') w.doc({ d: c.d, f: { n: it.n } })
}

/** The rules document: the text you wrote, or a version put back. */
const rulesDoc = (w: Work) => [...w.docs.values()].find((d) => d.kind === 'rules')

function writeRules(w: Work, md: string): void {
  const doc = rulesDoc(w)
  if (doc && md.trim() !== doc.md.trim()) w.doc({ d: doc.d, f: { md: md.replace(/^\n+|\n+$/g, '') } })
}

// -- one preview per command ----------------------------------------------------------------------------------------

/** Nothing the page shows changes at once: in Deleted, the organizer's, an agent's or Taska's own, or the server's
 * answer brings it (a version, a proposal decided, a comment back, ticks in the text). */
const later = () => {}

const PREVIEW: { [K in Op]: (w: Work, c: CommandOf<K>) => void } = {
  new: newItem,
  set,
  say: later,
  merge,
  unmerge,
  archive,
  idel: remove,
  iundel: later,
  hide,
  due: later,
  input,
  send: (w, c) => (w.inputs.get(c.id)?.kind === 'cancelled' ? w.input(c.id, { kind: undefined }) : undefined),
  delete: deleteInput,
  restore: later,
  correct,
  amend,
  ack: (w, c) => c.ids.forEach((id) => w.input(id, { acked: true })),
  rescope,
  doc: writeDoc,
  dticks: later,
  dc: comment,
  ddel: (w, c) => (c.on ?? true) && w.docs.get(c.d)?.kind !== 'rules' && w.doc({ d: c.d, gone: true }),
  dmove: moveDoc,
  dcmove: later,
  unfile,
  dcres: resolve,
  dcedit: editComment,
  dcdel: (w, c) => w.doc({ d: c.d, commentGone: c.id }),
  dcundel: later,
  'diagram-failed': later,
  rules: (w, c) => writeRules(w, c.md),
  redit: later,
  rpropose: later,
  rdecide: later,
  rrestore: (w, c) => {
    const x = rulesDoc(w)?.history?.find((v) => v.v === c.v)
    if (x) writeRules(w, x.md)
  },
  rundo: later,
  rreply: later,
  'filing-undo': later,
  'filing-redo': later,
  'organize-again': later,
  revert,
  cfg: later,
  icon: later,
}

/** What these commands, in order, show at once over the page's view `m`, made at `at` (ms). */
export function preview(m: ProjectModel, commands: readonly Command[], at: number): Shown {
  const w = new Work(m, at)
  for (const c of commands) (PREVIEW[c.op] as (w: Work, c: Command) => void)(w, c)
  return w.out
}

/** An item moved to another project (POST move-item): here it and its subitems end won't do and archived. */
export function movedItem(m: ProjectModel, n: number): Shown {
  const w = new Work(m, 0)
  const it = w.byN.get(n)
  if (it) for (const k of [it, ...w.under(n)]) w.put(k.n, { status: 'dropped', archived: true })
  return w.out
}

/** An input moved to another project (POST move-input): it shows moved, its new number with Taska's answer. */
export const movedInput = (id: string, to: string): Shown => ({ patches: [], inputPatches: [{ id, f: { moved: { to, as: '' } } }], docPatches: [] })
