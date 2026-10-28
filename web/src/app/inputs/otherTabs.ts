// The other tabs of this browser: a draft they change shows here too (the box follows it), and what one of them sent
// from the box shown here leaves it, with a word saying so.

import type { BoxStore } from '../../stores/box'
import type { DraftsStore } from '../../stores/drafts'
import type { KeyValueStore } from '../../stores/storage'
import type { Toasts } from '../page/toasts'
import { draftTarget, type DraftKey } from '../../model/draftTarget'

const DRAFTS = 'taska.drafts.'
const SENT = 'taska.sent.'

export interface OtherTabsDeps {
  kv: KeyValueStore
  drafts: DraftsStore
  box: BoxStore
  toasts: Toasts
  slug(): string
  /** a voice note is being recorded (its draft stays as it is meanwhile) */
  recording(): boolean
}

export class OtherTabs {
  private readonly d: OtherTabsDeps
  /** the box shown here was emptied by another tab: which draft, when */
  private gone: { k: string; t: number } | null = null
  constructor(d: OtherTabsDeps) {
    this.d = d
    d.kv.onChange?.((key) => this.changed(key))
  }

  /** This tab sent the draft `key`: the other tabs drop it from their box. */
  sent(slug: string, key: DraftKey): void {
    this.d.kv.setJson(SENT + slug, { k: key, t: Date.now() })
  }

  private changed(key: string): void {
    const slug = this.d.slug()
    if (!slug) return
    const shown = this.d.box.getState().shown.key
    if (key === DRAFTS + slug && !this.d.recording()) {
      const was = this.d.drafts.getState().of(slug)[shown] || ''
      this.d.drafts.getState().reload(slug)
      const now = this.d.drafts.getState().of(slug)[shown] || ''
      if (was.trim() && !now.trim()) this.gone = { k: shown, t: Date.now() }
    } else if (key === SENT + slug) {
      const x = this.d.kv.getJson<{ k: string; t: number }>(key)
      const text = this.d.drafts.getState().of(slug)[shown] || ''
      if (!x || x.k !== shown || !(text.trim() || (this.gone?.k === x.k && Date.now() - this.gone.t < 3000))) return
      const t = draftTarget(x.k)
      this.d.toasts.show(`${t.kind === 'reply' ? `Your reply to ${t.code}` : t.kind === 'new' ? 'Your new input' : 'What you wrote'} was sent from another tab`)
    }
  }
}
