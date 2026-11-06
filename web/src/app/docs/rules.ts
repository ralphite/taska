// The project's rules (I693, r1116/r1118/r1128): the document edited whole with an optional why (every save is a
// version), a version restored (it asks once; the restore is a new version, Undo in the toast takes it back), an
// agent's proposal approved or declined, the rules' own pages opened (history, a version, a proposal). Each change
// shows at once and is saved behind you.

import { rulesDoc, rulesSeg, type RulesView } from '../../model/rules'
import type { DocViewStore } from '../../stores/docView'
import type { KeyValueStore } from '../../stores/storage'
import type { ChangeRunner } from '../changeRunner'
import type { Navigation } from '../page/navigation'
import type { Sheets } from '../page/sheets'
import type { Toasts } from '../page/toasts'
import { copyText } from '../page/clipboard'
import { docHere, docSend, type DocPlace } from './shared'

export interface RulesDeps extends DocPlace {
  runner: ChangeRunner
  view: DocViewStore
  nav: Navigation
  sheets: Sheets
  toasts: Toasts
  kv: KeyValueStore
}


export class Rules {
  private readonly d: RulesDeps
  constructor(d: RulesDeps) {
    this.d = d
  }

  private here() {
    const h = docHere(this.d)
    return h ? { ...h, doc: rulesDoc(h.m) } : null
  }

  /** One of the rules' pages: the document, its history, a version, a proposal (a step Back comes back). */
  go(v: RulesView, push = true): void {
    this.d.nav.rules(rulesSeg(v), push)
  }

  /** The text being written, kept in this browser until it is saved or discarded, as a document's draft is
   * ("taska.docs.<project>": "D<its number>", "rules" before there is one). */
  private drafts(slug: string): Record<string, string> {
    return this.d.kv.getJson<Record<string, string>>('taska.docs.' + slug) || {}
  }

  private draftKey(): string {
    const doc = this.here()?.doc
    return doc ? `D${doc.d}` : 'rules'
  }

  private setDraft(slug: string, md: string | null): void {
    const all = this.drafts(slug)
    if (md) all[this.draftKey()] = md
    else delete all[this.draftKey()]
    this.d.kv.setJson('taska.docs.' + slug, all)
  }

  /** Edit the whole document (a draft kept from before comes back). */
  edit(): void {
    const h = this.here()
    if (!h) return
    const was = this.drafts(h.slug)[this.draftKey()]
    if (h.doc) this.d.view.getState().show(h.doc.d)
    this.d.view.getState().edit(true, was ?? h.doc?.md ?? '')
    if (was) this.d.toasts.show('Draft restored')
  }

  /** Left without Save: the text stays as a draft Edit brings back. */
  keep(): void {
    const h = this.here()
    const v = this.d.view.getState()
    if (!v.editing) return
    v.edit(false)
    if (!h) return
    const md = (v.text ?? '').trim()
    const changed = !!md && md !== (h.doc?.md ?? '').trim()
    this.setDraft(h.slug, changed ? md : null)
    if (changed) this.d.toasts.show('Draft saved: Edit brings it back')
  }

  discard(): void {
    const h = this.here()
    this.d.view.getState().edit(false)
    if (h) this.setDraft(h.slug, null)
  }

  /** Save: a new version, with why (optional). Not saved: the editor comes back with your text. */
  async save(why: string): Promise<void> {
    const h = this.here()
    const v = this.d.view.getState()
    if (!h || !v.editing) return
    const md = (v.text ?? h.doc?.md ?? '').trim()
    v.edit(false)
    this.setDraft(h.slug, null)
    if (md === (h.doc?.md ?? '').trim()) return
    const patch = h.doc ? [{ d: h.doc.d, f: { md } }] : []
    const ok = await docSend(this.d, h.slug, { op: 'rules', md, why: why.trim() }, 'saving the rules', patch)
    if (!ok) return void this.d.view.getState().edit(true, md)
    this.d.toasts.show('Saved')
  }

  /** Restore a version, after asking once (the sheet `rules-restore`): it becomes the next version; Undo takes it back. */
  ask(v: number): void {
    this.d.sheets.open({ kind: 'rules-restore', v }, { focus: false, narrow: true })
  }

  async restore(v: number): Promise<void> {
    const h = this.here()
    this.d.sheets.close()
    if (!h?.doc) return
    const was = h.doc.history?.find((x) => x.v === v)
    const ok = await docSend(this.d, h.slug, { op: 'rrestore', v }, `restoring v${v}`, was ? [{ d: h.doc.d, f: { md: was.md } }] : [])
    if (!ok) return
    this.go({ kind: 'read' })
    this.d.toasts.show(
      `Restored v${v}`,
      this.d.toasts.undoable(`Restore v${v}`, async () => {
        const now = this.here()?.doc?.history?.at(-1)
        if (!now?.restored) return false
        return docSend(this.d, h.slug, { op: 'rundo', seq: now.seq }, `taking back the restore of v${v}`)
      }),
    )
  }

  /** An agent's proposal: approved (it becomes the next version) or declined. */
  decide(p: number, ok: boolean): void {
    const h = this.here()
    if (!h?.doc) return
    void docSend(this.d, h.slug, { op: 'rdecide', p, ok }, ok ? 'approving a change to the rules' : 'declining a change to the rules')
    this.d.toasts.show(ok ? 'Approved' : 'Declined')
  }

  copy(): void {
    const doc = this.here()?.doc
    if (doc) void copyText(doc.md).then(() => this.d.toasts.show('Copied'))
  }
}
