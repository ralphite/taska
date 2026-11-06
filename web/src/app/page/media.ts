// Voice notes play in place: one player for the page; each chip shows play or pause and the time. Pictures open in
// the viewer, one at a time with the others of the same message, fit to the screen or at 100%; Back closes it. A
// voice note's original words open in their sheet.

import type { Voice } from '../../model/types'
import type { TaskaApi } from '../../api/taska'
import type { MediaStore } from '../../stores/media'
import type { RouteStore } from '../../stores/route'
import type { Sheets } from './sheets'
import type { Toasts } from './toasts'

export interface MediaDeps {
  api: TaskaApi
  store: MediaStore
  route: RouteStore
  sheets: Sheets
  toasts: Toasts
  desk(): boolean
  /** a voice note's words: its record in the project (B682) */
  kept(slug: string, f: string): Voice | null
}

export class Media {
  private readonly d: MediaDeps
  private el: HTMLAudioElement | null = null
  constructor(d: MediaDeps) {
    this.d = d
  }

  private sync(): void {
    const a = this.el
    if (!a) return this.d.store.getState().played(null)
    const playing = !a.paused
    const len = a.duration
    // recorded webm often has no length until played through
    const t = playing || (a.currentTime && !a.ended) ? a.currentTime : isFinite(len) ? len : null
    this.d.store.getState().played({ src: this.srcOf(a), playing, t: t === null ? null : 1000 * t })
  }

  /** Play it, or pause it if it is playing. */
  play(src: string): void {
    const a = this.el
    if (a && this.srcOf(a) === src && !a.paused) return a.pause()
    if (!a || this.srcOf(a) !== src) {
      a?.pause()
      const el = new Audio(src)
      el.dataset.src = src
      this.el = el
      for (const ev of ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata']) el.addEventListener(ev, () => this.sync())
    }
    this.el?.play().catch(() => this.d.toasts.show('Could not play this recording'))
  }

  private srcOf(a: HTMLAudioElement): string {
    return a.dataset.src || ''
  }

  /** The viewer, on picture `f` of `group`. */
  view(slug: string, group: readonly string[], f: string): void {
    const all = group.length ? group : [f]
    this.d.store.getState().view({ slug, group: all, idx: Math.max(0, all.indexOf(f)), fit: true })
    if (!this.d.route.getState().layers.includes('viewer')) this.d.route.getState().openLayer('viewer')
  }

  close(): void {
    this.d.route.getState().shutLayer('viewer')
  }

  step(dir: 1 | -1): void {
    const v = this.d.store.getState().viewer
    const idx = v.idx + dir
    if (idx < 0 || idx >= v.group.length) return
    this.d.store.getState().view({ ...v, idx, fit: true })
  }

  zoom(): void {
    const v = this.d.store.getState().viewer
    this.d.store.getState().view({ ...v, fit: !v.fit })
  }

  open(): boolean {
    return this.d.route.getState().layers.includes('viewer')
  }

  /** A voice note's words in their sheet on the phone, word for word and tidied (F568; the desktop shows them under
   * the pointer, B640): the note's record; asked for only when it has no words yet. Never worked out again. */
  words(slug: string, f: string): void {
    const show = (w: { heard?: string; tr?: string }) => this.d.sheets.open({ kind: 'as-said', heard: w.heard || '', tr: w.tr || '' })
    const kept = this.d.kept(slug, f)
    if (kept?.tidied) return show({ heard: kept.said, tr: kept.tidied })
    void this.d.api.words(slug, f).then(show, () => show({}))
  }
}
