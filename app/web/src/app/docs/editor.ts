// The document itself: edited (in the pane on the desktop, in a sheet on the phone; the first line is the title) and
// saved, or left without saving, which keeps the text as a draft that Edit (or New doc) brings back; a new one made
// on an item; deleted and moved to another item, with Undo.

import { noteText } from '../../model/docs'
import { codeOf, type ProjectModel } from '../../model/project'
import type { DocViewStore } from '../../stores/docView'
import type { KeyValueStore } from '../../stores/storage'
import type { ChangeRunner } from '../changeRunner'
import type { Sheets } from '../page/sheets'
import type { Toasts } from '../page/toasts'
import { docHere, docSend, type DocPlace } from './shared'

export interface DocEditorDeps extends DocPlace {
  runner: ChangeRunner
  view: DocViewStore
  sheets: Sheets
  toasts: Toasts
  kv: KeyValueStore
  desk(): boolean
  /** the document, opened (a new one once it is here) */
  open(dn: number): void
  /** back from the document (it was deleted) */
  close(): void
  /** the editor's microphone: stopped (its words still go to the draft, or nowhere), and waited for before Save */
  mic?: { stop(): void; discard(key: string): void; settled(): Promise<boolean> }
}

export class DocEditor {
  private readonly d: DocEditorDeps
  readonly stop: () => void
  constructor(d: DocEditorDeps) {
    this.d = d
    // Back closed the phone's editor: its text is kept as a draft
    this.stop = d.sheets.onGone((req) => req.kind === 'doc-edit' && d.view.getState().editing && this.keep())
  }

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
    const h = docHere(this.d)
    if (!h) return
    const was = this.drafts(h.slug)[`D${dn}`]
    this.d.view.getState().edit(true, was ?? null)
    if (!this.d.desk()) this.d.sheets.open({ kind: 'doc-edit', d: dn }, { focus: false, tall: true })
    if (was) this.d.toasts.show('Draft restored')
  }

  /** A new document on item `n`, in a sheet. */
  create(n: number): void {
    const h = docHere(this.d)
    if (!h) return
    const was = this.drafts(h.slug)[`new ${n}`] || ''
    this.d.view.getState().edit(true, was, n)
    this.d.sheets.open({ kind: 'doc-edit', n }, { focus: false, tall: true })
    if (was) this.d.toasts.show('Draft restored')
  }

  private editing(): { slug: string; m: ProjectModel; dn: number | null; n: number | null; md: string; was: string; key: string } | null {
    const h = docHere(this.d)
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
    const ok = await docSend(this.d, e.slug, command, doc ? `saving D${doc.d}` : 'creating a document')
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
      if (made) return this.d.open(made.d)
      await new Promise((ok2) => setTimeout(ok2, 100))
    }
  }

  /** Delete it (a second press within 3 seconds); Undo brings it back. */
  remove(dn: number): void {
    const h = docHere(this.d)
    if (!h || !this.d.sheets.confirm('doc-delete ' + dn)) return
    void docSend(this.d, h.slug, { op: 'ddel', d: dn }, `deleting D${dn}`, [{ d: dn, gone: true }])
    this.d.close()
    this.d.toasts.show(
      `Deleted D${dn}`,
      this.d.toasts.undoable(`D${dn} deleted`, async () => {
        const ok = await docSend(this.d, h.slug, { op: 'ddel', d: dn, on: false }, `restoring D${dn}`)
        if (ok) this.d.toasts.show(`D${dn} is back`)
        return ok
      }),
    )
  }

  /** On another item. */
  moveTo(dn: number, to: string): void {
    const h = docHere(this.d)
    const doc = h?.m.docs.find((x) => x.d === dn)
    if (!h || !doc) return
    const was = { code: codeOf(h.m, doc.n), n: doc.n }
    // on its new item at once
    const put = (ref: string, n: number) => docSend(this.d, h.slug, { op: 'dmove', d: dn, to: ref }, `moving D${dn} to ${ref}`, [{ d: dn, f: { n } }])
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
}
