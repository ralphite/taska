// Speaking about a document: a paragraph's own mic (or the bar on selected words) records a voice comment about it;
// the same button stops it: on the desktop the quote and the voice note go into the box, on the phone it is posted.
// Send with quote lines in the box posts each one's words as a comment on its passage: each shows where it goes at
// once and the box empties; it is saved behind you once its voice notes' words are there; not saved, it all comes
// back into the box.

import { allComments } from '../model/docs'
import { codeOf, liveN, type ProjectModel } from '../model/project'
import type { Comment } from '../model/types'
import { vcCount, vcSegments } from '../model/voiceComments'
import type { BoxStore, DraftFile } from '../stores/box'
import type { ChangesStore } from '../stores/changes'
import type { DocViewStore } from '../stores/docView'
import type { RecordingStore } from '../stores/recording'
import type { Box } from './box'
import { newId, type ChangeRunner } from './changeRunner'
import type { Docs } from './docs/docs'
import type { DocComments } from './docs/comments'
import type { Toasts } from './toasts'
import type { Voice } from './voice'
import { docDraft, draftKey, type DraftKey } from '../model/draftTarget'

export interface DocVoiceDeps {
  voice: Voice
  docs: Docs
  comments: DocComments
  box: Box
  boxStore: BoxStore
  recording: RecordingStore
  view: DocViewStore
  runner: ChangeRunner
  changes: ChangesStore
  toasts: Toasts
  model(slug: string): ProjectModel | null
  desk(): boolean
  /** what the document's box holds goes as a reply to its item */
  reply(slug: string, key: DraftKey, scope: string | null): void
}

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

export class DocVoice {
  private readonly d: DocVoiceDeps
  constructor(d: DocVoiceDeps) {
    this.d = d
  }

  /** The item the document is on, for what its voice notes are heard with. */
  private host(slug: string, dn: number): string | null {
    const m = this.d.model(slug)
    const doc = m?.docs.find((x) => x.d === dn)
    return doc && m && m.byN.has(liveN(m, doc.n)) ? codeOf(m, liveN(m, doc.n)) : null
  }

  /** A paragraph's mic (or a part of a web page): speak about it; pressed again it stops (the phone posts it). */
  async say(slug: string, dn: number, key: string, quote: string, page = false): Promise<void> {
    const r = this.d.recording.getState().rec
    if (r) {
      // a part of a web page: on the phone it posts, the box open or not
      if (r.about) await this.d.voice.finish(!this.d.desk() && (page || !this.d.view.getState().typing))
      return
    }
    await this.d.voice.start(slug, docDraft(dn), this.host(slug, dn), 'main', { d: dn, key, quote: quote.slice(0, 500), bar: false })
  }

  /** The bar on selected words: speak about them (words of document `d`'s passage `key`, or words elsewhere, which
   * go into the box shown now); pressed again it stops (the phone sends it). -> it started */
  async bar(slug: string, sel: { d: number | null; key: string | null; quote: string } | null): Promise<boolean> {
    const r = this.d.recording.getState().rec
    if (r?.about?.bar) {
      await this.d.voice.finish(!this.d.desk() && !this.d.view.getState().typing)
      return false
    }
    if (r || !sel) return false
    const shown = this.d.boxStore.getState().shown
    const key = sel.d != null ? docDraft(sel.d) : shown.key
    const scope = sel.d != null ? this.host(slug, sel.d) : shown.scope
    await this.d.voice.start(slug, key, scope, 'main', { ...sel, quote: sel.quote.slice(0, 500), bar: true })
    return !!this.d.recording.getState().rec
  }

  /** The voice comment stopped: the box comments on what it was about. */
  about(dn: number | null, key: string | null, quote: string): void {
    if (dn == null || !key) return
    this.d.view.getState().pick({ quote: { key, text: quote }, sel: new Set(), reply: null })
  }

  /** Send in a document's box: its voice comments if it has quote lines, else a comment on what is picked. */
  send(slug: string, dn: number, key: DraftKey): Promise<boolean> {
    if (vcCount(this.d.box.text(slug, key))) return this.post(slug, dn, key)
    // what is picked; on the phone nothing picked is the whole document; on the desktop, a reply to its item
    const t = this.d.docs.target(dn) ?? (this.d.desk() ? null : { key: 'doc', quote: '' })
    if (t) return this.d.comments.comment(slug, dn, t, key)
    this.d.reply(slug, key, this.host(slug, dn))
    return Promise.resolve(true)
  }

  /** Each quote line's words as a comment on its passage, with the voice notes said about it. */
  async post(slug: string, dn: number, key: DraftKey): Promise<boolean> {
    const doc = this.d.model(slug)?.docs.find((x) => x.d === dn)
    if (!doc) return false
    const typed = this.d.box.text(slug, key)
    const marks = this.d.boxStore.getState().marks
    const r = vcSegments(typed, doc, marks)
    if ('err' in r) {
      this.d.toasts.show(r.err, null, { error: true })
      return false
    }
    const { segs } = r
    const all = [...(this.d.boxStore.getState().files[key] || [])]
    // each comment with the voice notes said about its quote; any other file goes with the last
    const posts = segs
      .map((s, i) => ({ s, fs: all.filter((f) => f.vc === s.label || (i === segs.length - 1 && !segs.some((x) => x.label === f.vc))) }))
      .filter(({ s, fs }) => s.text || fs.length)
    if (!posts.length) {
      this.d.toasts.show('Nothing to post yet: say or write something under a quote')
      return false
    }
    // the box empties; its files wait out of sight for their words (they are still kept and heard)
    const { files } = this.d.box.take(slug, key)
    const hold = draftKey({ kind: 'held', id: newId() })
    this.d.boxStore.getState().putFiles(hold, files)
    const live = () => [...(this.d.boxStore.getState().files[hold] || [])]
    this.d.boxStore.getState().setMarks(marks.filter((x) => x.d !== dn))
    const before = new Set(allComments(doc).map((c) => c.id))
    const stands = posts.map(({ s }, i): Comment => ({ id: -(Date.now() + i), key: s.key, th: 0, quote: s.quote, text: s.text || '…', by: 'you', t: new Date().toISOString(), files: [] }))
    const docPatches = stands.map((comment) => ({ d: dn, comment }))
    const v = this.d.view.getState()
    for (const { s } of posts) v.openThread(s.key)
    v.unpick()
    if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
    const showing = { id: 'show-' + newId(), slug, commands: [], patches: [], docPatches, said: '', t: Date.now(), showOnly: true }
    this.d.changes.getState().add(showing)
    const back = () => {
      this.d.changes.getState().remove(showing.id)
      this.d.box.putBack(slug, key, typed.trim(), this.d.boxStore.getState().takeFiles(hold))
      this.d.boxStore.getState().setMarks([...this.d.boxStore.getState().marks, ...marks.filter((x) => x.d === dn)])
      return false
    }
    // their voice notes' words go with them
    for (let i = 0; live().some((f) => f.uploading || f.transcribing) && i < 240; i++) await wait(500)
    const ups = (fs: DraftFile[]) => fs.map((f) => live().find((x) => x.key === f.key) || f).filter((f) => f.f && !f.failed).map(({ f, name, mime, size, tr }) => ({ f, name, mime, size, ...(tr ? { tr } : {}) }))
    const ops = posts.map(({ s, fs }) => ({ op: 'dc', d: dn, key: s.key, quote: s.quote, text: s.text, files: ups(fs) })).filter((o) => o.text || o.files.length)
    if (!ops.length) return back()
    this.d.changes.getState().remove(showing.id)
    const ok = await this.d.runner.send({ id: newId(), slug, commands: ops as never, patches: [], docPatches, said: `commenting on D${dn}`, t: Date.now() })
    if (!ok) return back()
    this.d.boxStore.getState().takeFiles(hold) // Taska has them: this browser lets them go
    const after = this.d.model(slug)?.docs.find((x) => x.d === dn)
    const made = after ? allComments(after).filter((c) => !before.has(c.id) && c.id > 0 && c.by === 'you').map((c) => c.id) : []
    const n = ops.length === 1 ? '1 comment' : `${ops.length} comments`
    this.d.toasts.show(
      `Posted ${n} on D${dn}${made.length && !this.d.desk() ? ' · Edit is under it' : ''}`,
      made.length
        ? async () => {
            for (const id of made) await this.d.runner.send({ id: newId(), slug, commands: [{ op: 'dcdel', d: dn, id } as never], patches: [], docPatches: [{ d: dn, commentGone: id }], said: `taking back a comment on D${dn}`, t: Date.now() })
            this.d.toasts.show('Taken back')
          }
        : null,
    )
    return true
  }
}
