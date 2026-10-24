// Voice notes in the box: recording (the microphone as it hears, untouched: no echo cancelling, noise suppression or
// automatic gain), the note put in the draft it was started in (wherever you are when it stops), uploaded at once and
// its words worked out in the background; they go where it was recorded in the draft when they come. Stop and send
// sends it at once (sending waits only for the upload; its words join the input when they come).

import { Refused } from '../api/http'
import { clock } from '../model/time'
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
    return typeof window !== 'undefined' && window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.MediaRecorder === 'function'
  }

  recording(): boolean {
    return !!this.d.store.getState().rec
  }

  /** Why the microphone did not start, and what to do. */
  private why(slug: string, e: unknown): string {
    const name = (e as Error)?.name || ''
    void this.d.api.pageLog(slug, [{ kind: 'mic', level: 'warn', msg: String((e as Error)?.message || e || ''), name, where: 'start', secure: String(window.isSecureContext), ua: navigator.userAgent }]).catch(() => {})
    if (!window.isSecureContext) return 'Microphone requires HTTPS: open Taska using its https link.'
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access denied. Allow it for this site (Safari: aA › Website Settings › Microphone), then try again.'
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found'
    if (name === 'NotReadableError' || name === 'AbortError') return 'Microphone busy (call, app, or tab). Stop the other use and try again'
    return `The microphone did not start (${name || 'unknown error'}). Try again.`
  }

  private async mic(): Promise<MediaStream> {
    const md = navigator.mediaDevices
    try {
      return await md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    } catch (e) {
      if ((e as Error)?.name === 'NotAllowedError' || (e as Error)?.name === 'SecurityError') throw e
      return md.getUserMedia({ audio: true })
    }
  }

  /** Record a voice note for draft `key` (it belongs where it was started, whatever is open when it stops). */
  async start(slug: string, key: string, scope: string | null, from: 'main' | 'aux'): Promise<void> {
    if (this.rec) return
    if (!this.can()) return this.d.toasts.show('This browser can’t record voice notes')
    const box = this.d.fields.get('box')
    this.typing = !!box && box === box.ownerDocument.activeElement
    try {
      this.stream = await this.mic()
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
    this.d.store.getState().start({ slug, key, scope, from })
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
  async finish(andSend: boolean, kept?: { blob: Blob; ms: number; slug: string; key: string; scope: string | null }): Promise<void> {
    const r = this.d.store.getState().rec
    const slug = kept?.slug ?? r?.slug
    const key = kept?.key ?? r?.key
    const scope = kept ? kept.scope : (r?.scope ?? null)
    const ms = kept?.ms ?? Date.now() - this.t0
    const blob = kept?.blob ?? (await this.stopped())
    if (!blob || !slug || key == null) return
    if (ms < 800 || !blob.size) {
      void this.d.api.pageLog(slug, [{ kind: 'mic', level: 'warn', msg: `${ms} ms, ${blob.size} bytes`, name: blob.size ? 'short' : 'empty', where: 'stop' }]).catch(() => {})
      return this.d.toasts.show(blob.size ? 'Too short, discarded' : 'Nothing was recorded: the microphone gave no sound. Try again, or check Settings › Apps › Safari › Microphone')
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
    }
    this.d.boxStore.getState().addFile(key, f)
    void this.hear(slug, key, f, blob, scope)
    if (andSend) {
      if (key === this.d.boxKey()) this.d.send(slug, key)
      else {
        this.d.send(slug, key)
        this.d.toasts.show(`Sent to ${scope || 'New input'}`)
      }
    } else if (this.d.desk() && !kept) this.d.fields.get('box')?.focus({ preventScroll: true })
  }

  /** Discard it; Undo brings it back for a few seconds. */
  async cancel(): Promise<void> {
    const r = this.d.store.getState().rec
    const ms = Date.now() - this.t0
    const blob = await this.stopped()
    if (!r || !blob || ms < 800 || !blob.size) return
    this.d.toasts.show('Recording discarded', () => this.finish(false, { blob, ms, slug: r.slug, key: r.key, scope: r.scope }))
  }

  private patch(fk: string, p: Partial<DraftFile>): void {
    this.d.boxStore.getState().updateFile(fk, p)
    this.d.outbox.getState().updateFile(fk, p)
  }

  /** Up to Taska, then its words, tried again with growing pauses while Taska can't be reached. */
  private async hear(slug: string, key: string, f: DraftFile, blob: Blob, scope: string | null): Promise<void> {
    let fid = ''
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
        if (d.done && d.tr_error && ++tries < 4) continue // the models had trouble: a few more tries
        break
      } catch {
        await wait(Math.min(30000, 2000 * 2 ** Math.min(n, 4)))
      }
    }
    const tr = d?.tr || ''
    const err = d?.tr_error || (d?.done ? '' : 'no answer')
    this.patch(f.key, { transcribing: false, tr, doubts: d?.doubts || [], more: !!d?.more, trError: err })
    this.place(slug, key, f.key, tr, err)
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
    const at = Math.min(inDraft.at ?? text.length, text.length)
    const before = text.slice(0, at)
    const after = text.slice(at)
    this.d.box.write(slug, key, before + (before.trim() && !before.endsWith('\n') ? '\n' : '') + tr + (after.trim() && !after.startsWith('\n') ? '\n' : '') + after)
    this.d.boxStore.getState().updateFile(fk, { trAdded: tr })
  }
}
