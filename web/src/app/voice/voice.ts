// Voice notes in the box: recording (the microphone as it hears, untouched: no echo cancelling, noise suppression or
// automatic gain), the note put in the draft it was started in (wherever you are when it stops), uploaded at once and
// its words worked out in the background; they go where it was recorded in the draft when they come. Stop and send
// sends it at once (sending waits only for the upload; its words join the input when they come). Esc on a new
// input's note keeps it in the inputs as cancelled, sent to no one, to listen to and send later (B627). An input's own
// Voice records more to add to it, and stopped there it is added as Add more adds (F657).

import { Delivery } from '../../api/delivery'
import { Abandoned } from '../../api/http'
import { canRecord, micTrouble, openMic } from './mic'
import { CANT_RECORD, MUTED_BY_PHONE, TOO_SHORT, cancelledKept, noSound } from '../../model/micWords'
import { clock } from '../../model/time'
import { vcLabel, vcLineEnd, withQuote } from '../../model/voiceComments'
import type { Recording } from '../../stores/recording'
import type { TaskaApi } from '../../api/taska'
import type { DraftFile } from '../../stores/box'
import type { BoxStore } from '../../stores/box'
import type { OutboxStore } from '../../stores/outbox'
import type { RecordingStore } from '../../stores/recording'
import type { Box } from '../inputs/box'
import type { Fields } from '../page/fields'
import type { Toasts } from '../page/toasts'
import { draftKey, draftName, draftTarget, keyOf, NEW_DRAFT, type DraftKey } from '../../model/draftTarget'
import type { Outgoing } from '../../model/outgoing'
import type { Doubt } from '../../model/types'
import { NOTE_STOPPED, heardEvent, noteState, noteStep, type VoiceEvent } from '../../model/voiceStates'

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
  send(slug: string, key: DraftKey): void
  /** the draft the box shows now */
  boxKey(): string
  /** what waits to be sent goes now (a file it waited for is up) */
  flush(): void
  /** into the outbox: it goes once its files are up, and a reload never loses it */
  push(o: Pick<Outgoing, 'slug' | 'text' | 'scope' | 'files' | 'kind' | 'quiet'>): void
  /** kept in this browser with its audio until Taska has it: its id there */
  keep(blob: Blob): string
  /** to the box a draft belongs to */
  goDraft(key: DraftKey): void
  /** a voice comment stopped: what it is about is what the box comments on now (a document's passage) */
  about?(a: NonNullable<Recording['about']>): void
  /** what has to reach Taska is asked until it answers (its pauses end at once when Taska may be back) */
  delivery: Delivery
}


/** More to add to an input (its own Voice records into it). */
const isAdding = (key: DraftKey) => {
  const t = draftTarget(key)
  return t.kind === 'amend' && t.mode === 'append'
}

/** How loud a moment of sound is, 0 to 1, from its samples as bytes (128 = silence). */
export function levelOf(buf: Uint8Array): number {
  let sum = 0
  for (const v of buf) sum += (v - 128) ** 2
  return Math.min(1, Math.sqrt(sum / buf.length) / 40)
}

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
    return micTrouble(e, this.d.desk())
  }

  /** Record a voice note for draft `key` (it belongs where it was started, whatever is open when it stops). */
  async start(slug: string, key: DraftKey, scope: string | null, from: 'main' | 'aux', about: Recording['about'] = null): Promise<void> {
    if (this.rec) return
    if (!this.can()) return this.d.toasts.show(CANT_RECORD, null, { error: true })
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

  /** An input's own Voice (F657): more to add to input `id`, recorded at once; pressed again it stops and is added
   * there as Add more adds. One recording at a time: one going on elsewhere stops first, as its own Stop would (one
   * for another input is added there; any other goes into its draft). */
  async addTo(slug: string, id: string, scope: string | null): Promise<void> {
    const key = draftKey({ kind: 'amend', mode: 'append', id })
    const r = this.d.store.getState().rec
    if (r && r.slug === slug && r.key === key) return this.finish(true)
    if (r) await this.finish(isAdding(r.key) && r.key !== this.d.boxKey())
    await this.start(slug, key, scope, 'main')
  }

  private stopped(): Promise<Blob | null> {
    return new Promise((done) => {
      const rec = this.rec
      if (!rec) return done(null)
      rec.onstop = () => done(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }))
      rec.stop()
      if (this.muted) this.d.toasts.show(MUTED_BY_PHONE, null, { error: true })
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
  async finish(andSend: boolean, kept?: { blob: Blob; ms: number; slug: string; key: DraftKey; scope: string | null; about: Recording['about'] }): Promise<void> {
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
      // too short is yours to say again; no sound at all is the microphone failing, as its other failures say
      return blob.size ? this.d.toasts.show(TOO_SHORT) : this.d.toasts.show(noSound(this.d.desk()), null, { error: true })
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
    const f = this.noteFile(blob, ms, this.d.box.text(slug, key).length, label)
    this.d.boxStore.getState().addFile(key, f)
    void this.hear(slug, key, f, blob, scope)
    if (key !== this.d.boxKey()) {
      // you moved on while recording: the note is in the box where you started it
      const to = draftTarget(key).kind
      if (andSend && isAdding(key)) this.d.send(slug, key) // added to its input, which says so
      else if (andSend && (to === 'new' || to === 'reply')) {
        this.d.send(slug, key)
        this.d.toasts.show(`Sent to ${draftName(key)}`)
      } else this.d.toasts.show(`Voice note added to ${draftName(key)}`, () => this.d.goDraft(key), { label: 'Go there' })
    } else if (andSend) this.d.send(slug, key)
    else if (this.d.desk() && !kept) this.d.fields.get('box')?.focus({ preventScroll: true })
  }

  /** Esc. A new input's note of a second or more is kept in the inputs as cancelled, sent to no one (B627); any other
   * is discarded, and Undo brings it back for a few seconds. */
  async cancel(): Promise<void> {
    const r = this.d.store.getState().rec
    const ms = Date.now() - this.t0
    const blob = await this.stopped()
    if (!r || !blob || ms < 800 || !blob.size) return
    if (r.key === NEW_DRAFT && !r.about && ms >= 1000) return this.keepCancelled(r.slug, blob, ms)
    this.d.toasts.show('Recording discarded', () => this.finish(false, { blob, ms, slug: r.slug, key: r.key, scope: r.scope, about: r.about ?? null }))
  }

  /** A cancelled note goes up and gets its words as a sent one does, and into the inputs marked cancelled, through
   * the outbox (kept in this browser until Taska has it); the box stays as it was. */
  private keepCancelled(slug: string, blob: Blob, ms: number): void {
    const f = this.noteFile(blob, ms, 0)
    this.d.push({ slug, text: '', scope: null, kind: 'cancelled', quiet: true, files: [f] })
    void this.hear(slug, NEW_DRAFT, f, blob, null, true)
    this.d.toasts.show(cancelledKept(this.d.desk()))
  }

  private noteFile(blob: Blob, ms: number, at: number, label: string | null = null): DraftFile {
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    return {
      key: `voice-${Date.now().toString(36)}-${++this.n}`,
      f: '',
      name: `voice ${clock(ms).replace(':', '-')}.${ext}`,
      mime: blob.type || 'audio/webm',
      size: blob.size,
      ms,
      ...NOTE_STOPPED,
      at,
      t: Date.now(),
      rid: this.d.keep(blob),
      ...(label ? { vc: label } : {}),
    }
  }

  private patch(fk: string, p: Partial<DraftFile>): void {
    this.d.boxStore.getState().updateFile(fk, p)
    this.d.outbox.getState().updateFile(fk, p)
  }

  /** What is kept of a note now (in its draft, or on its way), `f` once neither holds it. */
  private now(f: DraftFile): DraftFile {
    return this.draftOf(f.key)?.f ?? (this.d.outbox.getState().list.flatMap((o) => o.files).find((x) => x.key === f.key) as DraftFile | undefined) ?? f
  }

  /** The note moved on by `on` (model/voiceStates: the one way its state changes), with `also` (its words), and the
   * toast that says so; false when it cannot go that way from where it is. `cancelled`: a note kept as cancelled. */
  private step(f: DraftFile, on: VoiceEvent, cancelled: boolean, also: Partial<DraftFile> = {}): boolean {
    const at = cancelled ? 'cancelled' : this.draftOf(f.key) ? 'draft' : 'sent'
    const s = noteStep(this.now(f), at, on)
    if (!s) return false
    this.patch(f.key, { ...s.change, ...also })
    if (s.toast) this.d.toasts.show(s.toast)
    return true
  }

  /** Still in a draft or on its way (not taken off meanwhile). */
  private wanted(fk: string): boolean {
    return !!this.draftOf(fk) || this.d.outbox.getState().list.some((o) => o.files.some((x) => x.key === fk))
  }

  /** Up to Taska, then its words: tried again with growing pauses for as long as Taska can't be reached (it is kept
   * in this browser meanwhile, r512), at once when the network is back; refused, it says so (`cancelled`: a note
   * kept as cancelled, B627). */
  private async hear(slug: string, key: DraftKey, f: DraftFile, blob: Blob, scope: string | null, cancelled = false): Promise<void> {
    const delivery = this.d.delivery
    let fid = f.f
    if (!fid)
      try {
        const up = await delivery.until(() => this.d.api.upload(slug, blob, f.name, { voice: true, scope }), {
          failed: () => void (this.wanted(f.key) && this.step(f, 'uploadOffline', cancelled)),
          again: () => this.wanted(f.key), // taken off its draft meanwhile
        })
        fid = up.f
        this.step(f, 'uploaded', cancelled, { f: up.f, size: up.size })
        this.d.flush()
      } catch (ex) {
        if (ex instanceof Abandoned || !this.wanted(f.key)) return
        this.step(f, 'uploadRefused', cancelled)
        return this.d.flush()
      }
    let d: Awaited<ReturnType<TaskaApi['words']>> | null = null
    for (let n = 0, tries = 0, waits = 0; n < 40; n++) {
      try {
        d = await delivery.until(() => this.d.api.words(slug, fid, true, { scope, again: tries > 0 }))
      } catch {
        break // Taska said no
      }
      if (!heardEvent(d) && ++waits < 20) continue // still working: the server answers after 45 s for another ask
      if (d.state === 'failed' && ++tries < 4) {
        // the models had trouble: a few more tries, with growing pauses
        await delivery.wait(Delivery.pause(tries))
        continue
      }
      break
    }
    // no answer in all that time: it failed
    const on = (d && heardEvent(d)) || 'failed'
    const tr = on === 'failed' || on === 'nothing' ? '' : d?.tr || ''
    if (!this.step(f, on, cancelled, { tr, doubts: d?.doubts || [] })) return
    if (!cancelled && !this.d.desk() && d?.doubts?.some((x) => x.alt)) this.d.boxStore.getState().setShowWords(true) // the words to check show in the box on the phone
    if (!cancelled && tr) this.place(slug, key, f.key, tr)
    if (on === 'fast') void this.hearMore(slug, f.key, fid)
  }

  private draftOf(fk: string): { key: DraftKey; f: DraftFile } | null {
    for (const [key, fs] of Object.entries(this.d.boxStore.getState().files)) {
      const f = fs.find((x) => x.key === fk)
      if (f) return { key: keyOf(key), f }
    }
    return null
  }

  /** The note's fast words came (T687): the strong model's words follow, while it is in its draft. */
  private async hearMore(slug: string, fk: string, fid: string): Promise<void> {
    const fast = () => {
      const at = this.draftOf(fk)
      return at && noteState(at.f) === 'fastWords' ? at : null
    }
    for (let t0 = Date.now(); Date.now() - t0 < 5 * 60000 && fast(); ) {
      let d: Awaited<ReturnType<TaskaApi['words']>>
      try {
        d = await this.d.delivery.until(() => this.d.api.words(slug, fid, true, { more: true }), { again: () => !!fast() })
      } catch {
        break // out of its draft meanwhile, or Taska said no: the fast words stay
      }
      if (d.more) continue
      const at = fast()
      if (!at) return
      // the strong model's own words, or (it failed, or said the same) the fast words stay
      const strong = d.state === 'done' && !!d.tr && d.tr !== at.f.tr
      if (this.step(at.f, strong ? 'strong' : 'fastKept', false) && strong) this.fuller(slug, at.key, at.f, d.tr, d.doubts || [])
      return
    }
    const at = fast()
    if (at) this.step(at.f, 'fastKept', false)
  }

  /** The final words take the place of the first ones in the draft (or go after it), with what may be misheard in
   * them (B724): on the phone the words to check show in the box, as for first words. */
  private fuller(slug: string, key: DraftKey, f: DraftFile, words: string, doubts: Doubt[]): void {
    const was = f.trAdded || f.tr
    const v = this.d.box.text(slug, key)
    this.d.box.write(slug, key, was && v.includes(was) ? v.replace(was, words) : (v.trim() ? v.trimEnd() + '\n' : '') + words)
    this.d.boxStore.getState().updateFile(f.key, { tr: words, trAdded: words, doubts })
    if (!this.d.desk() && doubts.some((x) => x.alt)) this.d.boxStore.getState().setShowWords(true)
  }

  /** A kept note from before a reload: up, if it was not, then its words. */
  resume(slug: string, key: DraftKey, f: DraftFile, blob: Blob, scope: string | null): void {
    void this.hear(slug, key, f, blob, scope)
  }

  /** A kept note's words, worked out before the reload, into its draft. */
  placeKept(slug: string, key: DraftKey, f: DraftFile): void {
    if (f.tr) this.place(slug, key, f.key, f.tr)
  }

  /** Its words go where it was recorded in its draft, around what was typed since (sent meanwhile: they are the
   * note's, nothing to put). */
  private place(slug: string, key: DraftKey, fk: string, tr: string): void {
    const inDraft = (this.d.boxStore.getState().files[key] || []).find((x) => x.key === fk)
    if (!inDraft) return
    const text = this.d.box.text(slug, key)
    const q = inDraft.vc ? vcLineEnd(text, inDraft.vc) : -1 // a voice comment's words: under its quote, wherever that is now
    const at = q >= 0 ? q : Math.min(inDraft.at ?? text.length, text.length)
    const before = text.slice(0, at)
    const after = text.slice(at)
    this.d.box.write(slug, key, before + (before.trim() && !before.endsWith('\n') ? '\n' : '') + tr + (after.trim() && !after.startsWith('\n') ? '\n' : '') + after)
    this.d.boxStore.getState().updateFile(fk, { trAdded: tr, around: [before, after] })
  }
}
