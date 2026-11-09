// A document's comments: written from the box (there at once, in the thread they will be in; their files go up
// first), edited, resolved and opened again, moved to another paragraph, deleted, a file taken off. Each change shows
// at once and is saved behind you, with Undo.

import { allComments, resolved, sameText, splitThread, threadsOf, type DocTarget } from '../../model/docs'
import { draftKey, type DraftKey } from '../../model/draftTarget'
import type { DocPatch } from '../../model/project'
import type { Comment } from '../../model/types'
import { draftNotes, shownNotes, splitVoices, wordsByFile } from '../../model/voices'
import type { BoxStore } from '../../stores/box'
import type { ChangesStore } from '../../stores/changes'
import type { DocViewStore } from '../../stores/docView'
import type { Box } from '../inputs/box'
import { newId, type ChangeRunner } from '../changeRunner'
import type { Fields } from '../page/fields'
import type { Sheets } from '../page/sheets'
import type { Toasts } from '../page/toasts'
import { docHere, docSend, type DocPlace } from './shared'
import { stillComing } from '../../model/voiceStates'
import { isUp } from '../../model/fileStates'

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
    if (on) this.fold(h.slug, dn, tk)
    else this.d.view.getState().openThread(tk)
    this.d.toasts.show(on ? 'Resolved' : 'Open again', this.d.toasts.undoable(on ? 'Resolve a thread' : 'Reopen a thread', () => put(!on)))
  }

  /** A thread resolved folds into its paragraph's count, ✓ 2 (D115 #40). Opened by its paragraph (the phone's count),
   * the paragraph's other threads still to resolve stay open. */
  private fold(slug: string, dn: number, tk: string): void {
    const { key } = splitThread(tk)
    const v = this.d.view.getState()
    const doc = this.d.model(slug)?.docs.find((x) => x.d === dn)
    const block = doc?.blocks.find((b) => b.key === key)
    const others = doc && block && v.threads.has(key) ? threadsOf(block.comments).map((t) => t.tk).filter((k) => k !== tk && !resolved(doc, k)) : []
    v.closeThreads(tk, key)
    for (const k of others) v.openThread(k)
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
    const showing = { id: 'show-' + newId(), slug, commands: [], patches: [], docPatches: [{ d: dn, comment: stand }], said: '', t: Date.now(), mode: 'show' as const }
    this.d.changes.getState().add(showing)
    const v = this.d.view.getState()
    const picked = { sel: v.sel, quote: v.quote, reply: v.reply }
    v.openThread(t.th ? `${t.key}#${t.th}` : t.key)
    v.unpick()
    // the phone's box came only to write this comment (B498): it goes with it
    const typing = v.typing
    if (!this.d.desk()) v.setTyping(false)
    if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
    if (this.d.desk()) this.d.fields.get('box')?.focus({ preventScroll: true })
    for (let i = 0; live().some(stillComing) && i < 240; i++) await new Promise((ok) => setTimeout(ok, 500))
    const held = files.length ? this.d.boxStore.getState().takeFiles(hold) : []
    const sent = held.filter(isUp)
    // what was typed is the comment's words; each voice note's words, as you left them, go to the note (B682)
    const said = splitVoices(typed, draftNotes(held))
    const text = said.text
    const words = wordsByFile(said.words, sent)
    this.d.changes.getState().remove(showing.id)
    if (!text && !sent.length) {
      this.d.box.putBack(slug, key, typed, held)
      if (typing) this.d.view.getState().setTyping(true)
      return false
    }
    const ok = await this.d.runner.send({
      id: newId(),
      slug,
      commands: [{ op: 'dc', d: dn, key: t.key, text, files: sent.map(({ f, name, mime, size }) => ({ f, name, mime, size })), words, ...(t.reply ? {} : { quote }), ...(t.th ? { th: t.th } : {}) }],
      patches: [],
      docPatches: [{ d: dn, comment: stand }],
      said: `commenting on D${dn}`,
      t: Date.now(),
    })
    if (!ok) {
      this.d.box.putBack(slug, key, typed, held)
      // what it was on is picked again, so Send comments there again (D83 #3), unless you picked something else since
      const now = this.d.view.getState()
      if (now.d === dn && !now.sel.size && !now.quote && !now.reply) now.pick(picked)
      if (typing) now.setTyping(true)
    }
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
    const { text: shown, files } = this.d.box.take(slug, key)
    const sent = files.filter(isUp)
    // the box began with what was said (typed, then its voice notes' words): what was typed goes as its words, each
    // note's words as you left them go to the note (B682)
    const said = splitVoices(shown, [...shownNotes(c?.files), ...draftNotes(sent)], c?.typed ?? c?.text)
    const text = said.text
    const words = { ...wordsByFile(said.words, sent), ...Object.fromEntries(Object.entries(said.words).filter(([k]) => !sent.some((f) => f.key === k))) }
    if (!shown && !sent.length && !c?.files.length) {
      this.d.box.putBack(slug, key, shown, files)
      this.d.toasts.show('Write something, or delete the comment instead')
      return false
    }
    this.d.boxStore.getState().setMode(null)
    const patch: DocPatch[] = c && shown ? [{ d: dn, commentGone: id }, { d: dn, comment: { ...c, text: shown } }] : []
    const ok = await this.d.runner.send({
      id: newId(),
      slug,
      commands: [{ op: 'dcedit', d: dn, id, text, words, ...(sent.length ? { files: sent.map(({ f, name, mime, size }) => ({ f, name, mime, size })) } : {}) }],
      patches: [],
      docPatches: patch,
      said: `editing a comment on D${dn}`,
      t: Date.now(),
    })
    if (!ok) {
      this.d.boxStore.getState().setMode({ kind: 'comment', d: dn, id, was: c?.text || '' })
      this.d.box.putBack(slug, key, shown, files)
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
