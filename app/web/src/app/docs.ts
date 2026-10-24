// What you do with a document: open and close it (on the desktop in the pane, beside the list; on the phone over its
// item), pick what a comment goes to (a paragraph, words in one, a thread to reply in, the whole document), open and
// close its threads, resolve them, move a comment, delete, restore or move the document. Each change shows at once
// and is saved behind you, with Undo.

import { docTarget, splitThread } from '../model/docs'
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
