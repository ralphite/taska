// A voice note's words in the draft, before it is sent: one of two versions of a misheard word picked (everywhere it
// was heard), the other model's words used instead (Undo puts them back), and words corrected by hand inside them,
// which Taska remembers for every voice note after (Undo forgets it again).

import { fixIn, pickSide, unpicked, type HeardFile } from '../model/doubts'
import { Refused } from '../api/http'
import type { TaskaApi } from '../api/taska'
import type { BoxStore } from '../stores/box'
import type { Box } from './box'
import type { Fields } from './fields'
import type { Toasts } from './toasts'
import type { DraftKey } from '../model/draftTarget'

export interface VoiceWordsDeps {
  api: TaskaApi
  box: Box
  store: BoxStore
  toasts: Toasts
  fields: Fields
}

export class VoiceWords {
  private readonly d: VoiceWordsDeps
  constructor(d: VoiceWordsDeps) {
    this.d = d
  }

  private file(key: DraftKey, fk: string): HeardFile | undefined {
    return (this.d.store.getState().files[key] || []).find((f) => f.key === fk)
  }

  /** One side of a doubt picked; true when the words changed. */
  pick(slug: string, key: DraftKey, fk: string, k: number, side: 'was' | 'alt'): boolean {
    const f = this.file(key, fk)
    if (!f) return false
    const r = pickSide(this.d.box.text(slug, key), f, k, side)
    if (r.changed) this.d.box.write(slug, key, r.text)
    this.d.store.getState().updateFile(fk, { doubts: r.doubts, trAdded: r.trAdded })
    return r.changed
  }

  /** The other model's words, with Undo. */
  use(slug: string, key: DraftKey, fk: string, k: number): void {
    const x = this.file(key, fk)?.doubts?.[k]
    if (!x || !this.pick(slug, key, fk, k, 'alt')) return
    this.d.toasts.show(`Changed to “${(x.show || [])[1] || x.alt}”`, () => {
      this.pick(slug, key, fk, k, 'was')
      const f = this.file(key, fk)
      if (f) this.d.store.getState().updateFile(fk, { doubts: unpicked(f, k) })
    })
  }

  /** The phone: the words with the versions show in the box, or it is back to typing. */
  show(on: boolean): void {
    this.d.store.getState().setShowWords(on)
    if (!on) this.d.fields.focus('box')
  }

  /** Words corrected by hand: into the draft, and remembered (Undo puts the words back and forgets it). */
  async fix(slug: string, key: DraftKey, at: { s: number; e: number; wrong: string }, right: string, item: string | null): Promise<void> {
    const files = this.d.store.getState().files[key] || []
    const before = this.d.box.text(slug, key)
    const r = fixIn(before, files, at, right)
    if (!r) return
    this.d.box.write(slug, key, r.text)
    for (const f of r.files) this.d.store.getState().updateFile(f.key, { trAdded: f.trAdded })
    let had: { wrong?: string; right: string } | null = null
    try {
      had = (await this.d.api.corrections()).find((c) => c.wrong === at.wrong) || null
    } catch {
      /* none known */
    }
    const file = files.find((f) => r.files.some((x) => x.key === f.key))?.f || ''
    try {
      // the server keeps the fix for the developers too, with where it was heard
      await this.d.api.setCorrection({ wrong: at.wrong, right, project: slug, item: item || '', file })
    } catch (ex) {
      return this.d.toasts.show(ex instanceof Refused ? ex.message || 'Not saved' : 'Connection lost; try again', null, { error: true }) // the draft keeps your words
    }
    this.d.toasts.show(`Remembered: “${at.wrong}” → “${right}”`, async () => {
      const cur = this.d.box.text(slug, key)
      if (cur.slice(at.s, at.s + right.length) === right) this.d.box.write(slug, key, cur.slice(0, at.s) + at.wrong + cur.slice(at.s + right.length))
      await this.d.api.setCorrection(had?.wrong ? { wrong: at.wrong, right: had.right, undo: true } : { wrong: at.wrong }).catch(() => {})
    })
  }
}
