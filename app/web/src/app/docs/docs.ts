// A document as you read it: opened and closed (on the desktop in the pane, beside the list; on the phone over its
// item), the one shown following the address; what a comment goes to picked (a paragraph, words in one, a thread to
// reply in, the whole document); its threads opened and closed.

import { docTarget, splitThread } from '../../model/docs'
import { codeOf, liveN } from '../../model/project'
import type { Tab } from '../../model/words'
import type { DocViewStore } from '../../stores/docView'
import type { Fields } from '../fields'
import type { Navigation } from '../navigation'
import type { Toasts } from '../toasts'
import { docHere, type DocPlace } from './shared'

export interface DocsDeps extends DocPlace {
  view: DocViewStore
  nav: Navigation
  fields: Fields
  toasts: Toasts
  desk(): boolean
  /** leaving a document being edited (on the desktop, in the pane): its text is kept as a draft */
  leaveEditor(): void
}

export class Docs {
  private readonly d: DocsDeps
  readonly stop: () => void
  constructor(d: DocsDeps) {
    this.d = d
    this.follow()
    this.stop = d.route.subscribe(() => this.follow())
  }

  /** The document shown is the address's: another one (or none) starts afresh. */
  private follow(): void {
    const r = this.d.route.getState().route
    const d = r.page === 'project' && r.place.kind === 'doc' ? r.place.d : null
    const v = this.d.view.getState()
    if (v.editing && v.newFor == null && d !== v.d) this.d.leaveEditor()
    v.show(d)
  }

  /** A document: in the tab its item is in (from the Documents list the list stays); Back comes back. */
  open(dn: number): void {
    const h = docHere(this.d)
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
    const h = docHere(this.d)
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
    const doc = docHere(this.d)?.m.docs.find((x) => x.d === dn)
    const v = this.d.view.getState()
    return doc ? docTarget(doc, v) : null
  }

  unpick(): void {
    const v = this.d.view.getState()
    if (!this.d.desk() && v.typing) return v.setTyping(false)
    v.unpick()
    if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
  }
}
