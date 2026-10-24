// What you do with a document: open and close it (on the desktop in the pane, beside the list; on the phone over its
// item), pick what a comment goes to (a paragraph, words in one, a thread to reply in, the whole document), open and
// close its threads, resolve them, move a comment, delete, restore or move the document. Each change shows at once
// and is saved behind you, with Undo.

import { allComments, docTarget, noteText, sameText, splitThread, type DocTarget } from '../model/docs'
import type { KeyValueStore } from '../stores/storage'
import type { DocTicksStore } from '../stores/docTicks'
import type { InputSender } from './inputSender'
import { blockKeys } from '../model/docs'
import { tickedBlock, tickText, tickWords, ticksOf } from '../model/docTicks'
import type { Comment } from '../model/types'
import type { Box } from './box'
import type { BoxStore } from '../stores/box'
import { codeOf, liveN, type DocPatch, type ProjectModel } from '../model/project'
import type { Tab } from '../model/words'
import type { DocViewStore } from '../stores/docView'
import type { ChangesStore } from '../stores/changes'
import type { RouteStore } from '../stores/route'
import { newId, type ChangeRunner } from './changeRunner'
import type { Fields } from './fields'
import type { Navigation } from './navigation'
import type { Sheets } from './sheets'
import type { Toasts } from './toasts'
import { docDraft, draftKey, replyDraft, type DraftKey } from '../model/draftTarget'

export interface DocsDeps {
  runner: ChangeRunner
  /** a stand-in shown while what it stands for waits (its files going up) */
  changes: ChangesStore
  toasts: Toasts
  view: DocViewStore
  nav: Navigation
  route: RouteStore
  sheets: Sheets
  fields: Fields
  desk(): boolean
  model(slug: string): ProjectModel | null
  box: Box
  boxStore: BoxStore
  kv: KeyValueStore
  ticks: DocTicksStore
  inputs: InputSender
  /** the editor's microphone: stopped (its words still go to the draft, or nowhere), and waited for before Save */
  mic?: { stop(): void; discard(key: string): void; settled(): Promise<boolean> }
}

export class Docs {
  private readonly d: DocsDeps
  readonly stop: () => void
  constructor(d: DocsDeps) {
    this.d = d
    this.follow()
    const unroute = d.route.subscribe(() => this.follow())
    // Back closed the phone's editor: its text is kept as a draft
    const ungone = d.sheets.onGone((req) => req.kind === 'doc-edit' && d.view.getState().editing && this.keep())
    this.stop = () => {
      unroute()
      ungone()
    }
  }

  /** The document shown is the address's: another one (or none) starts afresh; leaving one being edited (on the
   * desktop, in the pane) keeps its text as a draft. */
  private follow(): void {
    const r = this.d.route.getState().route
    const d = r.page === 'project' && r.place.kind === 'doc' ? r.place.d : null
    const v = this.d.view.getState()
    if (v.editing && v.newFor == null && d !== v.d) this.keep()
    v.show(d)
  }

  private here() {
    const r = this.d.route.getState().route
    if (r.page !== 'project') return null
    const m = this.d.model(r.slug)
    return m ? { r, m, slug: r.slug } : null
  }

  private send(slug: string, command: Record<string, unknown>, said: string, docPatches: DocPatch[] = []) {
    return this.d.runner.send({ id: newId(), slug, commands: [command as never], patches: [], docPatches, said, t: Date.now() })
  }

  /** A document: in the tab its item is in (from the Documents list the list stays); Back comes back. */
  open(dn: number): void {
    const h = this.here()
    if (!h) return
    const doc = h.m.docs.find((x) => x.d === dn)
    const it = doc ? h.m.byN.get(liveN(h.m, doc.n)) : undefined
    const tab: Tab = it?.archived ? 'archive' : it?.type === 'rule' ? 'rules' : 'items'
    this.d.nav.openDoc(dn, this.d.route.getState().side ? undefined : tab)
  }

  /** From an item's talk to a comment in its document: the document, the comment's thread open, its passage in view. */
  openAt(dn: number, key: string): void {
    this.open(dn)
    const v = this.d.view.getState()
    if (key !== 'doc') v.openThread(key)
    v.setAim(key)
  }

  /** Back from a document: to the list it was opened from (Documents, Activity, Deleted), else its item. */
  close(): void {
    const h = this.here()
    if (!h || h.r.place.kind !== 'doc') return
    const dn = h.r.place.d
    const doc = h.m.docs.find((x) => x.d === dn)
    if (this.d.route.getState().full) this.d.route.getState().setFull(false, true)
    this.d.view.getState().show(null)
    if (this.d.desk() && this.d.route.getState().side) return this.d.nav.closeItem()
    if (doc && h.m.byN.has(liveN(h.m, doc.n))) return this.d.nav.openItemHere(codeOf(h.m, liveN(h.m, doc.n)))
    this.d.nav.closeItem()
  }

  /** A paragraph tapped or its Comment pressed (`quote`: one item of a list); the desktop picks only by its button. */
  pick(key: string, quote: string | null, by: 'button' | 'tap'): void {
    const v = this.d.view.getState()
    const desk = this.d.desk()
    if (v.circle || (typeof getSelection !== 'undefined' && getSelection()?.toString().trim())) return
    if (desk && by === 'tap' && !v.sel.size) return // reading and copying never pick; Comment does
    if (quote) {
      if (!desk && v.quote?.key === key && v.quote.text === quote) v.pick({ quote: null })
      else v.pick({ sel: new Set(), quote: { key, text: quote }, reply: null })
      if (desk) this.d.fields.get('box')?.focus({ preventScroll: true })
      return
    }
    const sel = new Set(v.sel)
    if (sel.has(key)) sel.delete(key)
    else {
      if (!desk && !v.typing) sel.clear()
      sel.add(key)
    }
    v.pick({ sel, quote: null, reply: null })
    if (desk && sel.size) this.d.fields.get('box')?.focus({ preventScroll: true })
  }

  /** From a document to its item: the box replies there. */
  toItem(): void {
    this.close()
    requestAnimationFrame(() => this.d.fields.get('box')?.focus({ preventScroll: true }))
  }

  /** Drawn around: the paragraphs inside are picked. */
  circled(keys: string[]): void {
    const v = this.d.view.getState()
    v.setCircle(false)
    v.pick({ sel: new Set(keys), quote: null })
    if (!keys.length) this.d.toasts.show('Nothing inside the circle')
  }

  toggle(tk: string): void {
    this.d.view.getState().toggleThread(tk)
  }

  /** A click away from open comments over the text closes them (and its paragraph's). */
  away(tk: string): void {
    this.d.view.getState().closeThreads(tk, splitThread(tk).key)
  }

  reply(tk: string): void {
    this.d.view.getState().pick({ reply: tk, sel: new Set(), quote: null })
    this.d.fields.focus('box')
  }

  whole(): void {
    const v = this.d.view.getState()
    v.pick({ sel: new Set(), quote: null, reply: null })
    v.setTyping(true)
    this.d.fields.focus('box')
  }

  type(): void {
    this.d.view.getState().setTyping(true)
    this.d.fields.focus('box')
  }

  /** What the box's comment goes to now. */
  target(dn: number) {
    const doc = this.here()?.m.docs.find((x) => x.d === dn)
    const v = this.d.view.getState()
    return doc ? docTarget(doc, v) : null
  }

  unpick(): void {
    const v = this.d.view.getState()
    if (!this.d.desk() && v.typing) return v.setTyping(false)
    v.unpick()
    if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
  }

  resolve(dn: number, tk: string, on: boolean): void {
    const h = this.here()
    if (!h) return
    const { key, th } = splitThread(tk)
    const put = (v: boolean) => this.send(h.slug, { op: 'dcres', d: dn, key, on: v, ...(th ? { th } : {}) }, v ? 'resolving a thread' : 'reopening a thread', [{ d: dn, resolved: { tk, on: v } }])
    void put(on)
    if (on) this.d.view.getState().closeThreads(tk)
    else this.d.view.getState().openThread(tk)
    this.d.toasts.show(on ? 'Resolved' : 'Open again', this.d.toasts.undoable(on ? 'Resolve a thread' : 'Reopen a thread', () => put(!on)))
  }

  /** The box's words as a comment where it goes: there at once (in the thread it will be in: the same words quoted
   * again join their thread), saved behind you; not saved, the words come back to the box. Its files go once up. */
  async comment(slug: string, dn: number, t: DocTarget, key: DraftKey): Promise<boolean> {
    const m = this.d.model(slug)
    const doc = m?.docs.find((x) => x.d === dn)
    if (!doc) return false
    const { text: typed, files } = this.d.box.take(slug, key)
    if (!typed && !files.length) return false
    this.d.box.markSent(slug, key)
    // the box empties and the comment is on its passage at once; its files wait out of sight until they are up (a
    // voice note's words too, which go with it)
    const hold = draftKey({ kind: 'held', id: newId() })
    if (files.length) this.d.boxStore.getState().putFiles(hold, files)
    const live = () => this.d.boxStore.getState().files[hold] || []
    const quote = t.reply ? '' : t.quote
    const same = t.key === 'doc' ? doc.whole : doc.blocks.find((b) => b.key === t.key)?.comments || []
    const th = t.th ?? same.find((x) => x.th === x.id && sameText(x.quote, quote))?.th
    const stand: Comment = { id: -Date.now(), key: t.key, th: th ?? 0, quote, text: typed || '…', by: 'you', t: new Date().toISOString(), files: [] }
    const showing = { id: 'show-' + newId(), slug, commands: [], patches: [], docPatches: [{ d: dn, comment: stand }], said: '', t: Date.now(), showOnly: true }
    this.d.changes.getState().add(showing)
    const v = this.d.view.getState()
    v.openThread(t.th ? `${t.key}#${t.th}` : t.key)
    v.unpick()
    if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
    if (this.d.desk()) this.d.fields.get('box')?.focus({ preventScroll: true })
    for (let i = 0; live().some((f) => f.uploading || f.transcribing) && i < 240; i++) await new Promise((ok) => setTimeout(ok, 500))
    const held = files.length ? this.d.boxStore.getState().takeFiles(hold) : []
    const sent = held.filter((f) => f.f && !f.failed)
    let text = typed
    for (const f of sent) if (f.tr && !text.includes(f.tr)) text = (text ? text + '\n' : '') + f.tr
    this.d.changes.getState().remove(showing.id)
    if (!text && !sent.length) {
      this.d.box.putBack(slug, key, typed, held)
      return false
    }
    const ok = await this.d.runner.send({
      id: newId(),
      slug,
      commands: [{ op: 'dc', d: dn, key: t.key, text, files: sent.map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) })), ...(t.reply ? {} : { quote }), ...(t.th ? { th: t.th } : {}) } as never],
      patches: [],
      docPatches: [{ d: dn, comment: stand }],
      said: `commenting on D${dn}`,
      t: Date.now(),
    })
    if (!ok) this.d.box.putBack(slug, key, typed, held)
    return ok
  }

  /** Edit a comment of yours, in the box. */
  editComment(slug: string, dn: number, id: number): void {
    const c = this.commentOf(slug, dn, id)
    if (!c) return
    this.d.box.commentStart(slug, dn, id, c.text)
    this.d.fields.focus('box')
  }

  /** Save the edit: it changes at once and is saved behind you; not saved, your words come back to edit. */
  async saveComment(slug: string, dn: number, id: number, key: DraftKey): Promise<boolean> {
    const c = this.commentOf(slug, dn, id)
    const { text, files } = this.d.box.take(slug, key)
    const sent = files.filter((f) => f.f && !f.failed)
    if (!text && !sent.length && !c?.files.length) {
      this.d.box.putBack(slug, key, text, files)
      this.d.toasts.show('Write something, or delete the comment instead')
      return false
    }
    this.d.boxStore.getState().setMode(null)
    const patch: DocPatch[] = c && text ? [{ d: dn, commentGone: id }, { d: dn, comment: { ...c, text } }] : []
    const ok = await this.d.runner.send({
      id: newId(),
      slug,
      commands: [{ op: 'dcedit', d: dn, id, text, ...(sent.length ? { files: sent.map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) })) } : {}) } as never],
      patches: [],
      docPatches: patch,
      said: `editing a comment on D${dn}`,
      t: Date.now(),
    })
    if (!ok) {
      this.d.boxStore.getState().setMode({ kind: 'comment', d: dn, id, was: c?.text || '' })
      this.d.box.putBack(slug, key, text, files)
    }
    return ok
  }

  private commentOf(slug: string, dn: number, id: number): Comment | undefined {
    const doc = this.d.model(slug)?.docs.find((x) => x.d === dn)
    return doc ? allComments(doc).find((x) => x.id === id) : undefined
  }

  // ---- choices: a tap ticks one on the page; they wait until Send choices, which puts them in the document and tells
  // its item which you ticked (with what the box holds)

  /** Tick or untick the i-th choice of a paragraph. */
  tick(dn: number, k: string, i: number): void {
    const doc = this.here()?.m.docs.find((x) => x.d === dn)
    const keys = doc ? blockKeys(doc) : []
    const b = doc?.blocks[keys.indexOf(k)]
    const t = this.d.ticks.getState()
    const next = b ? tickedBlock(tickText(t, dn, k, b.text), i) : null
    if (!b || next == null) return this.d.toasts.show('Document changed; open it again', null, { error: true })
    t.set(dn, k, next === b.text ? null : next)
    if (!this.d.desk()) this.d.view.getState().setTyping(true) // the phone: the box comes under the document, with Send choices
  }

  /** A sent form made a form again, to change and send again. */
  modifyTicks(dn: number, k: string): void {
    this.d.ticks.getState().reopen(dn, k)
  }

  clearTicks(dn: number): void {
    this.d.ticks.getState().clear(dn)
  }

  /** Only the choices go into the document (as it is when they get there); the item hears which you ticked. */
  async sendTicks(slug: string, dn: number): Promise<void> {
    const m = this.d.model(slug)
    const doc = m?.docs.find((x) => x.d === dn)
    const t = this.d.ticks.getState()
    if (!m || !doc || !ticksOf(t, doc).length) return
    const n = liveN(m, doc.n)
    const sent = Object.fromEntries(ticksOf(t, doc).map(({ k, now }) => [k, now]))
    const words = tickWords(t, doc)
    if (m.byN.has(n)) {
      // what the box holds goes along (it writes to the item on the desktop, to the document on the phone)
      const { text: note, files } = this.d.box.take(slug, this.d.desk() ? replyDraft(codeOf(m, n)) : docDraft(dn))
      this.d.inputs.push({ slug, text: [`Answered in D${dn}:`, ...(words.length ? words : ['nothing ticked']), ...(note ? ['', note] : [])].join('\n'), scope: codeOf(m, n), files: files.map(({ key: fk, ...f }) => ({ ...f, key: fk })), kind: 'answer' })
      if (!this.d.desk()) this.d.toasts.show(`Choices sent to ${codeOf(m, n)}`)
    }
    if (!this.d.desk()) this.d.view.getState().setTyping(false)
    t.sentOff(dn, sent)
    const ticks = Object.entries(sent).map(([k, text]) => {
      const [bk, occ] = k.split('~')
      return { key: bk, occ: Number(occ) || 0, text }
    })
    const ok = await this.send(slug, { op: 'dticks', d: dn, ticks }, `sending choices in D${dn}`)
    this.d.ticks.getState().done(dn, sent, ok)
  }

  // ---- the editor: the first line is the title; leaving it without saving keeps the text as a draft

  /** Documents being written, kept in this browser ("taska.docs.<project>": {"D12" | "new 4": text}). */
  drafts(slug: string): Record<string, string> {
    return this.d.kv.getJson<Record<string, string>>('taska.docs.' + slug) || {}
  }

  setDraft(slug: string, key: string, md: string | null): void {
    const all = this.drafts(slug)
    if (md) all[key] = md
    else delete all[key]
    this.d.kv.setJson('taska.docs.' + slug, all)
  }

  /** Edit it: in the pane on the desktop, in a sheet on the phone; a draft kept from before comes back. */
  edit(dn: number): void {
    const h = this.here()
    if (!h) return
    const was = this.drafts(h.slug)[`D${dn}`]
    this.d.view.getState().edit(true, was ?? null)
    if (!this.d.desk()) this.d.sheets.open({ kind: 'doc-edit', d: dn }, { focus: false, tall: true })
    if (was) this.d.toasts.show('Draft restored')
  }

  /** A new document on item `n`, in a sheet. */
  create(n: number): void {
    const h = this.here()
    if (!h) return
    const was = this.drafts(h.slug)[`new ${n}`] || ''
    this.d.view.getState().edit(true, was, n)
    this.d.sheets.open({ kind: 'doc-edit', n }, { focus: false, tall: true })
    if (was) this.d.toasts.show('Draft restored')
  }

  private editing(): { slug: string; m: ProjectModel; dn: number | null; n: number | null; md: string; was: string; key: string } | null {
    const h = this.here()
    const v = this.d.view.getState()
    if (!h || !v.editing) return null
    const doc = v.newFor == null && v.d != null ? h.m.docs.find((x) => x.d === v.d) : undefined
    const was = doc ? noteText(doc).trim() : ''
    const md = (v.text ?? (doc ? noteText(doc) : '')).trim()
    return { slug: h.slug, m: h.m, dn: doc?.d ?? null, n: v.newFor, md, was, key: doc ? `D${doc.d}` : `new ${v.newFor}` }
  }

  /** Leaving the editor without Save: the text is kept as a draft, which Edit (or New doc) brings back. */
  keep(): void {
    this.d.mic?.stop()
    const e = this.editing()
    this.d.view.getState().edit(false)
    if (!e) return
    const changed = !!e.md && e.md !== e.was
    this.setDraft(e.slug, e.key, changed ? e.md : null)
    if (changed) this.d.toasts.show(e.dn != null ? 'Draft saved: Edit brings it back' : `Draft saved: ${this.d.desk() ? '⇧D' : 'New doc'} brings it back`)
    if (!this.d.desk() || e.dn == null) this.d.sheets.close()
  }

  discard(): void {
    const e = this.editing()
    if (e) this.d.mic?.discard(e.key)
    this.d.view.getState().edit(false)
    if (e) this.setDraft(e.slug, e.key, null)
    if (!this.d.desk() || !e || e.dn == null) this.d.sheets.close()
  }

  /** Save (or Create); an empty new one is dropped. Not saved: the editor comes back with your text. */
  async save(): Promise<void> {
    if (this.d.mic && !(await this.d.mic.settled())) return // the words still coming go in first
    const e = this.editing()
    if (!e) return
    this.d.view.getState().edit(false)
    this.setDraft(e.slug, e.key, null)
    if (!this.d.desk() || e.dn == null) this.d.sheets.close()
    if (!e.md || (e.dn != null && e.md === e.was)) return
    const doc = e.dn != null ? e.m.docs.find((x) => x.d === e.dn) : undefined
    const before = new Set(e.m.docs.map((x) => x.d))
    const command = doc ? { op: 'doc', d: doc.d, md: e.md, ...(doc.fmt === 'html' ? { fmt: 'html' } : {}) } : { op: 'doc', ref: codeOf(e.m, e.n as number), md: e.md }
    const ok = await this.send(e.slug, command, doc ? `saving D${doc.d}` : 'creating a document')
    if (!ok) {
      this.d.view.getState().edit(true, e.md, e.n)
      if (!this.d.desk() || !doc) this.d.sheets.open({ kind: 'doc-edit', ...(doc ? { d: doc.d } : { n: e.n as number }) }, { focus: false, tall: true })
      return
    }
    this.d.toasts.show(doc ? 'Saved' : 'Document created')
    if (doc) return
    // the new one opens once it is here
    for (let i = 0; i < 30; i++) {
      const made = this.d.model(e.slug)?.docs.find((x) => !before.has(x.d) && x.n === e.n)
      if (made) return this.open(made.d)
      await new Promise((ok2) => setTimeout(ok2, 100))
    }
  }

  /** Delete it (a second press within 3 seconds); Undo brings it back. */
  remove(dn: number): void {
    const h = this.here()
    if (!h || !this.d.sheets.confirm('doc-delete ' + dn)) return
    void this.send(h.slug, { op: 'ddel', d: dn }, `deleting D${dn}`, [{ d: dn, gone: true }])
    this.close()
    this.d.toasts.show(
      `Deleted D${dn}`,
      this.d.toasts.undoable(`D${dn} deleted`, async () => {
        const ok = await this.send(h.slug, { op: 'ddel', d: dn, on: false }, `restoring D${dn}`)
        if (ok) this.d.toasts.show(`D${dn} is back`)
        return ok
      }),
    )
  }

  /** On another item. */
  moveTo(dn: number, to: string): void {
    const h = this.here()
    const doc = h?.m.docs.find((x) => x.d === dn)
    if (!h || !doc) return
    const was = { code: codeOf(h.m, doc.n), n: doc.n }
    // on its new item at once
    const put = (ref: string, n: number) => this.send(h.slug, { op: 'dmove', d: dn, to: ref }, `moving D${dn} to ${ref}`, [{ d: dn, f: { n } }])
    void put(to, Number(/\d+/.exec(to)?.[0]) || doc.n)
    this.d.toasts.show(
      `D${dn} is now on ${to}`,
      this.d.toasts.undoable(`D${dn} moved`, async () => {
        const ok = await put(was.code, was.n)
        if (ok) this.d.toasts.show(`D${dn} is back on ${was.code}`)
        return ok
      }),
    )
  }

  /** A comment to another paragraph (`from`: where it was), or to the whole document: there once Taska has it, its
   * thread open there. */
  async moveComment(dn: number, id: number, key: string, from: string): Promise<void> {
    const h = this.here()
    if (!h || !(await this.send(h.slug, { op: 'dcmove', d: dn, id, key }, `moving a comment on D${dn}`))) return
    this.d.view.getState().openThread(key)
    this.d.toasts.show('Comment moved', this.d.toasts.undoable('Move a comment', () => this.send(h.slug, { op: 'dcmove', d: dn, id, key: from }, `moving a comment on D${dn}`)))
  }

  /** Gone at once, saved behind you; Undo puts it back where it was. */
  deleteComment(dn: number, id: number): void {
    const h = this.here()
    if (!h) return
    void this.send(h.slug, { op: 'dcdel', d: dn, id }, `deleting a comment on D${dn}`, [{ d: dn, commentGone: id }])
    this.d.toasts.show(
      'Comment deleted',
      this.d.toasts.undoable(`Delete a comment on D${dn}`, async () => {
        const ok = await this.send(h.slug, { op: 'dcundel', d: dn, id }, `restoring a comment on D${dn}`)
        if (ok) this.d.toasts.show('Comment back')
        return ok
      }),
    )
  }

  /** A file of yours off a comment (a second press within 3 seconds). */
  takeOff(dn: number, id: number, f: string): void {
    const h = this.here()
    if (!h || !this.d.sheets.confirm(`unfile ${dn} ${id} ${f}`)) return
    void this.send(h.slug, { op: 'unfile', d: dn, id, f }, `taking a file off a comment on D${dn}`)
  }
}
