// What you do with a document: open and close it (on the desktop in the pane, beside the list; on the phone over its
// item), pick what a comment goes to (a paragraph, words in one, a thread to reply in, the whole document), open and
// close its threads, resolve them, move a comment, delete, restore or move the document. Each change shows at once
// and is saved behind you, with Undo.

import { allComments, docTarget, noteText, sameText, splitThread, type DocTarget } from '../model/docs'
import type { KeyValueStore } from '../stores/storage'
import type { Comment } from '../model/types'
import type { Box } from './box'
import type { BoxStore } from '../stores/box'
import { codeOf, liveN, type DocPatch, type ProjectModel } from '../model/project'
import type { Tab } from '../model/words'
import type { DocViewStore } from '../stores/docView'
import type { RouteStore } from '../stores/route'
import { newId, type ChangeRunner } from './changeRunner'
import type { Fields } from './fields'
import type { Navigation } from './navigation'
import type { Sheets } from './sheets'
import type { Toasts } from './toasts'

export interface DocsDeps {
  runner: ChangeRunner
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
}

export class Docs {
  private readonly d: DocsDeps
  constructor(d: DocsDeps) {
    this.d = d
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
  async comment(slug: string, dn: number, t: DocTarget, key: string): Promise<boolean> {
    const m = this.d.model(slug)
    const doc = m?.docs.find((x) => x.d === dn)
    if (!doc) return false
    const up = () => (this.d.boxStore.getState().files[key] || []).some((f) => f.uploading)
    for (let i = 0; up() && i < 300; i++) await new Promise((ok) => setTimeout(ok, 200))
    const { text, files } = this.d.box.take(slug, key)
    const sent = files.filter((f) => f.f && !f.failed)
    if (!text && !sent.length) return false
    const quote = t.reply ? '' : t.quote
    const same = t.key === 'doc' ? doc.whole : doc.blocks.find((b) => b.key === t.key)?.comments || []
    const th = t.th ?? same.find((x) => x.th === x.id && sameText(x.quote, quote))?.th
    const stand: Comment = { id: -Date.now(), key: t.key, th: th ?? 0, quote, text: text || '…', by: 'you', t: new Date().toISOString(), files: [] }
    const v = this.d.view.getState()
    v.openThread(t.th ? `${t.key}#${t.th}` : t.key)
    v.unpick()
    if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
    if (this.d.desk()) this.d.fields.get('box')?.focus({ preventScroll: true })
    const ok = await this.d.runner.send({
      id: newId(),
      slug,
      commands: [{ op: 'dc', d: dn, key: t.key, text, files: sent.map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) })), ...(t.reply ? {} : { quote }), ...(t.th ? { th: t.th } : {}) } as never],
      patches: [],
      docPatches: [{ d: dn, comment: stand }],
      said: `commenting on D${dn}`,
      t: Date.now(),
    })
    if (!ok) this.d.box.putBack(slug, key, text, files)
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
  async saveComment(slug: string, dn: number, id: number, key: string): Promise<boolean> {
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

  // ---- the editor: the first line is the title; leaving it without saving keeps the text as a draft

  private drafts(slug: string): Record<string, string> {
    return this.d.kv.getJson<Record<string, string>>('taska.docs.' + slug) || {}
  }

  private setDraft(slug: string, key: string, md: string | null): void {
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
    this.d.view.getState().edit(false)
    if (e) this.setDraft(e.slug, e.key, null)
    if (!this.d.desk() || !e || e.dn == null) this.d.sheets.close()
  }

  /** Save (or Create); an empty new one is dropped. Not saved: the editor comes back with your text. */
  async save(): Promise<void> {
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
    if (h) void this.send(h.slug, { op: 'dmove', d: dn, to }, `moving D${dn} to ${to}`)
  }

  /** A comment to another paragraph, or to the whole document. */
  moveComment(dn: number, id: number, key: string): void {
    const h = this.here()
    if (h) void this.send(h.slug, { op: 'dcmove', d: dn, id, key }, `moving a comment on D${dn}`)
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
