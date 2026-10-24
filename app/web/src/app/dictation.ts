// Speaking into a document being edited: the microphone puts its words where the caret is. A mark holds the place
// while you speak and while the words are worked out; the words take the mark's place when they come (in the editor,
// or in the draft it was left as). Save waits for them. Leaving the editor stops the microphone.

import type { TaskaApi } from '../api/taska'
import { clock } from '../model/time'
import { codeOf, liveN, type ProjectModel } from '../model/project'
import type { DictationStore } from '../stores/dictation'
import type { DocViewStore } from '../stores/docView'
import type { RouteStore } from '../stores/route'
import type { DocEditor } from './docs/editor'
import type { Fields } from './fields'
import { canRecord, micTrouble, openMic } from './mic'
import type { Toasts } from './toasts'
import { noteText } from '../model/docs'

export interface DictationDeps {
  api: TaskaApi
  store: DictationStore
  view: DocViewStore
  route: RouteStore
  /** the documents being written, kept in this browser */
  editor: DocEditor
  fields: Fields
  toasts: Toasts
  model(slug: string): ProjectModel | null
  /** a voice note is being recorded for the box */
  recording(): boolean
}

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

interface Note {
  key: string | null
  mark: string
  ms: number
  scope: string | null
  done?: Promise<void>
}

export class Dictation {
  private readonly d: DictationDeps
  private n = 0
  private live: { rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; t0: number; tick: number; slug: string; scope: string | null } | null = null
  private stopping: Promise<void> | null = null
  private notes: Note[] = []
  constructor(d: DictationDeps) {
    this.d = d
  }

  private slug(): string | null {
    const r = this.d.route.getState().route
    return r.page === 'project' ? r.slug : null
  }

  /** The draft the editor writes ("D12", "new 4") and the item it is on. */
  private editing(slug: string): { key: string; scope: string | null } | null {
    const v = this.d.view.getState()
    const m = this.d.model(slug)
    if (!v.editing || !m) return null
    const doc = v.newFor == null && v.d != null ? m.docs.find((x) => x.d === v.d) : undefined
    const n = doc ? liveN(m, doc.n) : v.newFor
    return { key: doc ? `D${doc.d}` : `new ${v.newFor}`, scope: n != null && m.byN.has(n) ? codeOf(m, n) : null }
  }

  /** The editor's text now. */
  private text(slug: string): string {
    const v = this.d.view.getState()
    if (v.text != null) return v.text
    const doc = v.newFor == null && v.d != null ? this.d.model(slug)?.docs.find((x) => x.d === v.d) : undefined
    return doc ? noteText(doc) : ''
  }

  toggle(): void {
    if (this.live) this.stop()
    else void this.start()
  }

  async start(): Promise<void> {
    const slug = this.slug()
    if (this.live || !slug || !this.editing(slug)) return
    if (this.d.recording()) return this.d.toasts.show('Stop the current recording first')
    if (!canRecord()) return this.d.toasts.show('This browser cannot record here')
    let stream: MediaStream
    try {
      stream = await openMic()
    } catch (e) {
      return this.d.toasts.show(micTrouble(e), null, { error: true })
    }
    const at = this.editing(slug)
    const t = this.d.fields.get('doc') as HTMLTextAreaElement | null
    if (!at || !t || this.live) return stream.getTracks().forEach((x) => x.stop()) // the editor closed meanwhile
    // like dictation: what you selected is what you speak over
    const mark = `⟦🎙 ${++this.n}⟧`
    const v = this.text(slug)
    const a = t.selectionStart
    const b = t.selectionEnd
    this.d.view.getState().setText(v.slice(0, a) + mark + v.slice(b))
    t.focus({ preventScroll: true })
    requestAnimationFrame(() => t.setSelectionRange(a + mark.length, a + mark.length))
    const rec = new MediaRecorder(stream)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    rec.start(1000)
    const t0 = Date.now()
    this.live = { rec, stream, chunks, t0, slug, scope: at.scope, tick: window.setInterval(() => this.d.store.getState().tick(Date.now() - t0), 500) }
    this.d.store.getState().start(mark, at.key)
  }

  /** Stop: its words go at its mark (`keep` false: the editor was discarded, they go nowhere). */
  stop(keep = true): void {
    const r = this.live
    const on = this.d.store.getState().rec
    if (!r || !on) return
    this.live = null
    clearInterval(r.tick)
    this.d.store.getState().stop()
    const note: Note = { key: keep ? on.key : null, mark: on.mark, ms: Date.now() - r.t0, scope: r.scope }
    this.stopping = new Promise<void>((done) => {
      r.rec.onstop = () => {
        this.stopping = null
        done()
        const blob = new Blob(r.chunks, { type: r.rec.mimeType || 'audio/webm' })
        if (note.ms < 800 || !blob.size) {
          this.put(r.slug, note, '')
          return this.d.toasts.show('Too short, discarded')
        }
        this.notes.push(note)
        this.d.store.getState().wait(note.mark, note.key)
        note.done = this.hear(r.slug, note, blob).then((words) => {
          this.notes.splice(this.notes.indexOf(note), 1)
          this.d.store.getState().done(note.mark)
          if (words == null) this.d.toasts.show('Transcription failed')
          this.put(r.slug, note, words || '')
        })
      }
    })
    r.rec.stop()
    r.stream.getTracks().forEach((x) => x.stop())
  }

  /** The editor discarded: the microphone stops and the words still to come go nowhere. */
  discard(key: string): void {
    this.stop(false)
    for (const v of this.notes) if (v.key === key) v.key = null
    this.d.store.getState().drop(key)
  }

  /** Up, then its words (tried again with growing pauses for up to ten minutes); none: null. */
  private async hear(slug: string, note: Note, blob: Blob): Promise<string | null> {
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    let f = ''
    for (let n = 0, tries = 0, waits = 0, t0 = Date.now(); Date.now() - t0 < 10 * 60000; ) {
      try {
        if (!f) f = (await this.d.api.upload(slug, blob, `voice ${clock(note.ms).replace(':', '-')}.${ext}`, { voice: true, scope: note.scope })).f
        const d = await this.d.api.words(slug, f, true, { scope: note.scope, again: tries > 0 })
        if (d.tr_error === 'no such voice note') {
          f = ''
          throw new Error()
        }
        if (!d.done && ++waits < 20) continue
        if (d.done && d.tr_error && ++tries < 4) throw new Error()
        return d.done ? d.tr || '' : null
      } catch {
        await wait(Math.min(30000, 2000 * 2 ** Math.min(n++, 4)))
      }
    }
    return null
  }

  /** The words take the mark's place: in the editor, or in the draft it was left as. */
  private put(slug: string, note: Note, words: string): void {
    const at = this.editing(slug)
    if (at && at.key === note.key) {
      const v = this.text(slug)
      const i = v.indexOf(note.mark)
      if (i < 0) {
        if (words) {
          this.d.view.getState().setText(v.trimEnd() + '\n\n' + words)
          this.d.toasts.show('Mark was gone: words added at the end')
        }
        return
      }
      this.d.view.getState().setText(v.slice(0, i) + words + v.slice(i + note.mark.length))
      return
    }
    if (!note.key) return
    const v = this.d.editor.drafts(slug)[note.key]
    if (v == null) return
    this.d.editor.setDraft(slug, note.key, v.includes(note.mark) ? v.replace(note.mark, words) : words ? v.trimEnd() + '\n\n' + words : v)
    if (words) this.d.toasts.show('Words added to draft')
  }

  /** Before Save: the microphone stops and the words still coming are waited for. -> still editing the same */
  async settled(): Promise<boolean> {
    const slug = this.slug()
    const key = slug ? this.editing(slug)?.key : null
    this.stop()
    if (this.stopping) await this.stopping
    const mine = this.notes.filter((v) => v.key === key)
    if (mine.length) {
      this.d.toasts.show('Saving when words are ready…')
      await Promise.all(mine.map((v) => v.done))
    }
    return !!slug && this.editing(slug)?.key === key
  }
}
