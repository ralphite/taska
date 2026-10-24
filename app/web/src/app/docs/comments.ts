// A document's comments: written from the box (there at once, in the thread they will be in; their files go up
// first), edited, resolved and opened again, moved to another paragraph, deleted, a file taken off. Each change shows
// at once and is saved behind you, with Undo.

import { allComments, sameText, splitThread, type DocTarget } from '../../model/docs'
import { draftKey, type DraftKey } from '../../model/draftTarget'
import type { DocPatch } from '../../model/project'
import type { Comment } from '../../model/types'
import type { BoxStore } from '../../stores/box'
import type { ChangesStore } from '../../stores/changes'
import type { DocViewStore } from '../../stores/docView'
import type { Box } from '../box'
import { newId, type ChangeRunner } from '../changeRunner'
import type { Fields } from '../fields'
import type { Sheets } from '../sheets'
import type { Toasts } from '../toasts'
import { docHere, docSend, type DocPlace } from './shared'

export interface DocCommentsDeps extends DocPlace {
  runner: ChangeRunner
  /** a stand-in shown while what it stands for waits (its files going up) */
  changes: ChangesStore
  view: DocViewStore
  box: Box
  boxStore: BoxStore
  fields: Fields
  sheets: Sheets
  toasts: Toasts
  desk(): boolean
}

export class DocComments {
  private readonly d: DocCommentsDeps
  constructor(d: DocCommentsDeps) {
    this.d = d
  }

  resolve(dn: number, tk: string, on: boolean): void {
    const h = docHere(this.d)
    if (!h) return
    const { key, th } = splitThread(tk)
    const put = (v: boolean) => docSend(this.d, h.slug, { op: 'dcres', d: dn, key, on: v, ...(th ? { th } : {}) }, v ? 'resolving a thread' : 'reopening a thread', [{ d: dn, resolved: { tk, on: v } }])
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

  /** A comment to another paragraph (`from`: where it was), or to the whole document: there once Taska has it, its
   * thread open there. */
  async moveComment(dn: number, id: number, key: string, from: string): Promise<void> {
    const h = docHere(this.d)
    if (!h || !(await docSend(this.d, h.slug, { op: 'dcmove', d: dn, id, key }, `moving a comment on D${dn}`))) return
    this.d.view.getState().openThread(key)
    this.d.toasts.show('Comment moved', this.d.toasts.undoable('Move a comment', () => docSend(this.d, h.slug, { op: 'dcmove', d: dn, id, key: from }, `moving a comment on D${dn}`)))
  }

  /** Gone at once, saved behind you; Undo puts it back where it was. */
  deleteComment(dn: number, id: number): void {
    const h = docHere(this.d)
    if (!h) return
    void docSend(this.d, h.slug, { op: 'dcdel', d: dn, id }, `deleting a comment on D${dn}`, [{ d: dn, commentGone: id }])
    this.d.toasts.show(
      'Comment deleted',
      this.d.toasts.undoable(`Delete a comment on D${dn}`, async () => {
        const ok = await docSend(this.d, h.slug, { op: 'dcundel', d: dn, id }, `restoring a comment on D${dn}`)
        if (ok) this.d.toasts.show('Comment back')
        return ok
      }),
    )
  }

  /** A file of yours off a comment (a second press within 3 seconds). */
  takeOff(dn: number, id: number, f: string): void {
    const h = docHere(this.d)
    if (!h || !this.d.sheets.confirm(`unfile ${dn} ${id} ${f}`)) return
    void docSend(this.d, h.slug, { op: 'unfile', d: dn, id, f }, `taking a file off a comment on D${dn}`)
  }
}
