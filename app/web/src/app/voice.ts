// Voice notes in the box: recording (the microphone as it hears, untouched: no echo cancelling, noise suppression or
// automatic gain), the note put in the draft it was started in (wherever you are when it stops), uploaded at once and
// its words worked out in the background; they go where it was recorded in the draft when they come. Stop and send
// sends it at once (sending waits only for the upload; its words join the input when they come).

import { Refused } from '../api/http'
import { canRecord, micTrouble, openMic } from './mic'
import { clock } from '../model/time'
import { vcLabel, vcLineEnd, withQuote } from '../model/voiceComments'
import { draftName } from '../model/words'
import type { Recording } from '../stores/recording'
import type { TaskaApi } from '../api/taska'
import type { DraftFile } from '../stores/box'
import type { BoxStore } from '../stores/box'
import type { OutboxStore } from '../stores/outbox'
import type { RecordingStore } from '../stores/recording'
import type { Box } from './box'
import type { Fields } from './fields'
import type { Toasts } from './toasts'

export interface VoiceDeps {
  api: TaskaApi
  store: RecordingStore
  box: Box
  boxStore: BoxStore
  outbox: OutboxStore
  toasts: Toasts
  fields: Fields
  desk(): boolean
  /** send what the draft holds now (it goes to what the draft writes to) */
  send(slug: string, key: string): void
  /** the draft the box shows now */
  boxKey(): string
  /** what waits to be sent goes now (a file it waited for is up) */
  flush(): void
  /** kept in this browser with its audio until Taska has it: its id there */
  keep(blob: Blob): string
  /** to the box a draft belongs to */
  goDraft(key: string): void
  /** a voice comment stopped: what it is about is what the box comments on now (a document's passage) */
  about?(a: NonNullable<Recording['about']>): void
}


/** How loud a moment of sound is, 0 to 1, from its samples as bytes (128 = silence). */
export function levelOf(buf: Uint8Array): number {
  let sum = 0
  for (const v of buf) sum += (v - 128) ** 2
  return Math.min(1, Math.sqrt(sum / buf.length) / 40)
}

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

export class Voice {
  private readonly d: VoiceDeps
  private rec: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private t0 = 0
  private tick = 0
  private ctx: AudioContext | null = null
  private typing = false
  private muted = false
  private n = 0
  constructor(d: VoiceDeps) {
    this.d = d
  }

  can(): boolean {
    return canRecord()
  }

  recording(): boolean {
    return !!this.d.store.getState().rec
  }

  /** Why the microphone did not start, and what to do (told to the developers' log too). */
  private why(slug: string, e: unknown): string {
    const name = (e as Error)?.name || ''
    void this.d.api.pageLog(slug, [{ kind: 'mic', level: 'warn', msg: String((e as Error)?.message || e || ''), name, where: 'start', secure: String(window.isSecureContext), ua: navigator.userAgent }]).catch(() => {})
    return micTrouble(e)
  }

  /** Record a voice note for draft `key` (it belongs where it was started, whatever is open when it stops). */
  async start(slug: string, key: string, scope: string | null, from: 'main' | 'aux', about: Recording['about'] = null): Promise<void> {
    if (this.rec) return
    if (!this.can()) return this.d.toasts.show('This browser can’t record voice notes')
    const box = this.d.fields.get('box')
    this.typing = !!box && box === box.ownerDocument.activeElement
    try {
      this.stream = await openMic()
    } catch (e) {
      return this.d.toasts.show(this.why(slug, e), null, { error: true })
    }
    if (this.typing) box?.blur()
    this.chunks = []
    this.muted = false
    for (const t of this.stream.getAudioTracks()) t.onmute = t.onended = () => (this.muted = true)
    const rec = new MediaRecorder(this.stream)
    this.rec = rec
    rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data)
    }
    rec.start(1000)
    this.t0 = Date.now()
    let meter = () => 0.2
    try {
      const ac = new AudioContext()
      this.ctx = ac
      const an = ac.createAnalyser()
      an.fftSize = 512
      ac.createMediaStreamSource(this.stream).connect(an)
      const buf = new Uint8Array(an.fftSize)
      meter = () => (an.getByteTimeDomainData(buf), levelOf(buf))
    } catch {
      /* no meter: the bars stay even */
    }
    this.d.store.getState().start({ slug, key, scope, from, about })
    this.tick = window.setInterval(() => this.d.store.getState().tick(Date.now() - this.t0, meter()), 100)
  }

  private stopped(): Promise<Blob | null> {
    return new Promise((done) => {
      const rec = this.rec
      if (!rec) return done(null)
      rec.onstop = () => done(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }))
      rec.stop()
      if (this.muted) this.d.toasts.show("Phone muted the microphone; later speech wasn't recorded", null, { error: true })
      clearInterval(this.tick)
      this.stream?.getTracks().forEach((t) => t.stop())
      this.stream = null
      void this.ctx?.close()
      this.ctx = null
      this.rec = null
      this.d.store.getState().stop()
      if (this.typing) {
        this.typing = false
        this.d.fields.focus('box') // you were typing when you started: go on typing
      }
    })
  }

  /** Stop: the note goes into its draft (and is sent, with `andSend`). */
  async finish(andSend: boolean, kept?: { blob: Blob; ms: number; slug: string; key: string; scope: string | null; about: Recording['about'] }): Promise<void> {
    const r = this.d.store.getState().rec
    const slug = kept?.slug ?? r?.slug
    const key = kept?.key ?? r?.key
    const scope = kept ? kept.scope : (r?.scope ?? null)
    const about = kept ? kept.about : (r?.about ?? null)
    const ms = kept?.ms ?? Date.now() - this.t0
    const blob = kept?.blob ?? (await this.stopped())
    if (!blob || !slug || key == null) return
    if (ms < 800 || !blob.size) {
      void this.d.api.pageLog(slug, [{ kind: 'mic', level: 'warn', msg: `${ms} ms, ${blob.size} bytes`, name: blob.size ? 'short' : 'empty', where: 'stop' }]).catch(() => {})
      return this.d.toasts.show(blob.size ? 'Too short, discarded' : 'Nothing was recorded: the microphone gave no sound. Try again, or check Settings › Apps › Safari › Microphone')
    }
    // a voice comment: the quote first, then its words
    const label = about ? vcLabel(about.quote) : null
    if (about && label) {
      this.d.box.write(slug, key, withQuote(this.d.box.text(slug, key), label))
      const marks = this.d.boxStore.getState().marks.filter((x) => x.label !== label)
      this.d.boxStore.getState().setMarks(about.d != null && about.key ? [...marks, { label, d: about.d, key: about.key, quote: about.quote }] : marks)
      this.d.about?.(about)
      if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
    }
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    const f: DraftFile = {
      key: `voice-${Date.now().toString(36)}-${++this.n}`,
      f: '',
      name: `voice ${clock(ms).replace(':', '-')}.${ext}`,
      mime: blob.type || 'audio/webm',
      size: blob.size,
      ms,
      uploading: true,
      transcribing: true,
      at: this.d.box.text(slug, key).length,
      t: Date.now(),
      rid: this.d.keep(blob),
      ...(label ? { vc: label } : {}),
    }
    this.d.boxStore.getState().addFile(key, f)
    void this.hear(slug, key, f, blob, scope)
    if (key !== this.d.boxKey()) {
      // you moved on while recording: the note is in the box where you started it
      if (andSend && (key === 'new' || /^[A-Z]\d+$/.test(key))) {
        this.d.send(slug, key)
        this.d.toasts.show(`Sent to ${draftName(key)}`)
      } else this.d.toasts.show(`Voice note is in the box for ${draftName(key)}`, () => this.d.goDraft(key), { label: 'Go there' })
    } else if (andSend) this.d.send(slug, key)
    else if (this.d.desk() && !kept) this.d.fields.get('box')?.focus({ preventScroll: true })
  }

  /** Discard it; Undo brings it back for a few seconds. */
  async cancel(): Promise<void> {
    const r = this.d.store.getState().rec
    const ms = Date.now() - this.t0
    const blob = await this.stopped()
    if (!r || !blob || ms < 800 || !blob.size) return
    this.d.toasts.show('Recording discarded', () => this.finish(false, { blob, ms, slug: r.slug, key: r.key, scope: r.scope, about: r.about ?? null }))
  }

  private patch(fk: string, p: Partial<DraftFile>): void {
    this.d.boxStore.getState().updateFile(fk, p)
    this.d.outbox.getState().updateFile(fk, p)
  }

  /** Up to Taska, then its words, tried again with growing pauses while Taska can't be reached. */
  private async hear(slug: string, key: string, f: DraftFile, blob: Blob, scope: string | null): Promise<void> {
    let fid = f.f
    for (let n = 0; !fid; n++) {
      try {
        const up = await this.d.api.upload(slug, blob, f.name, { voice: true, scope })
        fid = up.f
        this.patch(f.key, { f: up.f, size: up.size, uploading: false, failed: false })
        this.d.flush()
      } catch (ex) {
        if (n >= 6 || ex instanceof Refused) {
          this.patch(f.key, { uploading: false, failed: true, transcribing: false })
          this.d.flush()
          return this.d.toasts.show('Recording upload failed')
        }
        await wait(Math.min(30000, 2000 * 2 ** Math.min(n, 4)))
      }
    }
    let d: Awaited<ReturnType<TaskaApi['words']>> | null = null
    for (let n = 0, tries = 0, waits = 0; n < 40; n++) {
      try {
        d = await this.d.api.words(slug, fid, true, { scope, again: tries > 0 })
        if (!d.done && ++waits < 20) continue // still working: the server answers after 45 s for another ask
        if (d.done && d.tr_error && ++tries < 4) {
          // the models had trouble: a few more tries, with growing pauses
          await wait(Math.min(30000, 2000 * 2 ** Math.min(n, 4)))
          continue
        }
        break
      } catch {
        await wait(Math.min(30000, 2000 * 2 ** Math.min(n, 4)))
      }
    }
    const tr = d?.tr || ''
    const err = d?.tr_error || (d?.done ? '' : 'no answer')
    this.patch(f.key, { transcribing: false, tr, doubts: d?.doubts || [], more: !!d?.more, trError: err })
    if (!this.d.desk() && d?.doubts?.some((x) => x.alt)) this.d.boxStore.getState().setShowWords(true) // the words to check show in the box on the phone
    this.place(slug, key, f.key, tr, err)
    if (d?.more) void this.hearMore(slug, f.key, fid)
  }

  private draftOf(fk: string): { key: string; f: DraftFile } | null {
    for (const [key, fs] of Object.entries(this.d.boxStore.getState().files)) {
      const f = fs.find((x) => x.key === fk)
      if (f) return { key, f }
    }
    return null
  }

  /** The strong model ran out of time on this note: its fuller words may come within a few minutes. */
  private async hearMore(slug: string, fk: string, fid: string): Promise<void> {
    for (let n = 0, t0 = Date.now(); Date.now() - t0 < 5 * 60000 && this.draftOf(fk)?.f.more; n++) {
      let d: Awaited<ReturnType<TaskaApi['words']>>
      try {
        d = await this.d.api.words(slug, fid, true, { more: true })
      } catch {
        await wait(Math.min(30000, 2000 * 2 ** Math.min(n, 4)))
        continue
      }
      if (d.more) continue
      const at = this.draftOf(fk)
      this.patch(fk, { more: false })
      if (at && d.tr && d.tr !== at.f.tr) this.fuller(slug, at.key, at.f, d.tr)
      return
    }
    this.patch(fk, { more: false })
  }

  /** The fuller words take the place of the first ones in the draft (or go after it). */
  private fuller(slug: string, key: string, f: DraftFile, words: string): void {
    const was = f.trAdded || f.tr
    const v = this.d.box.text(slug, key)
    this.d.box.write(slug, key, was && v.includes(was) ? v.replace(was, words) : (v.trim() ? v.trimEnd() + '\n' : '') + words)
    this.d.boxStore.getState().updateFile(f.key, { tr: words, trAdded: words, doubts: [] })
    this.d.toasts.show('More complete transcription added')
  }

  /** A kept note from before a reload: up, if it was not, then its words. */
  resume(slug: string, key: string, f: DraftFile, blob: Blob, scope: string | null): void {
    void this.hear(slug, key, f, blob, scope)
  }

  /** A kept note's words, worked out before the reload, into its draft. */
  placeKept(slug: string, key: string, f: DraftFile): void {
    this.place(slug, key, f.key, f.tr || '', f.trError || '')
  }

  /** Its words go where it was recorded in its draft, around what was typed since; none: it says so. */
  private place(slug: string, key: string, fk: string, tr: string, err: string): void {
    const inDraft = (this.d.boxStore.getState().files[key] || []).find((x) => x.key === fk)
    if (!inDraft) {
      if (!tr) this.d.toasts.show(err ? 'Transcription failed. Audio sent as is' : 'No words heard. Audio sent as is')
      return
    }
    if (!tr) return this.d.toasts.show(err ? 'Transcription failed. Audio is ready to send' : 'No words heard. Audio is ready to send')
    const text = this.d.box.text(slug, key)
    const q = inDraft.vc ? vcLineEnd(text, inDraft.vc) : -1 // a voice comment's words: under its quote, wherever that is now
    const at = q >= 0 ? q : Math.min(inDraft.at ?? text.length, text.length)
    const before = text.slice(0, at)
    const after = text.slice(at)
    this.d.box.write(slug, key, before + (before.trim() && !before.endsWith('\n') ? '\n' : '') + tr + (after.trim() && !after.startsWith('\n') ? '\n' : '') + after)
    this.d.boxStore.getState().updateFile(fk, { trAdded: tr })
  }
}
