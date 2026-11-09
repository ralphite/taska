// The search (F479). The phone: the magnifier opens its page and its box records at once; the up arrow stops, the
// words are written out (the voice notes' own way: up, then their words, with the words two models heard
// differently), and it searches every project (by meaning, then by the words: one step). Saying more puts the new
// words at the end and searches all of them again; a misheard word set right, or words typed, search again. The
// desktop: ⌘K, / or the sidebar's magnifier open its dialog on the last words (selected), not listening; what you
// type searches a moment after you stop; the mic runs the phone's way, and what you say takes the words' place when
// they were all selected. While Taska is out of reach it keeps trying, and goes on by itself when it answers.

import type { Delivery } from '../../api/delivery'
import { Abandoned } from '../../api/http'
import type { TaskaApi } from '../../api/taska'
import { pickSide, type HeardFile } from '../../model/doubts'
import { heardWords, saidMore, type FindKind } from '../../model/find'
import { clock } from '../../model/time'
import type { FindState, FindStore } from '../../stores/find'
import { canRecord, openMic } from '../voice/mic'
import { levelOf } from '../voice/voice'

export interface FinderDeps {
  api: TaskaApi
  store: FindStore
  /** the project you are in ('' none) */
  slug(): string
  /** the search opens over the page, or closes (a step Back undoes) */
  layer(on: boolean): void
  /** the desktop's dialog opens, or closes */
  dialog(on: boolean): void
  /** the project a voice note is put in (the home page has none: the first listed) */
  voiceSlug(): string
  /** what has to reach Taska is asked until it answers (its pauses end at once when Taska may be back) */
  delivery: Delivery
}

/** how long typing pauses before the desktop searches what was typed (ms) */
export const TYPE_PAUSE = 300

interface Live {
  rec: MediaRecorder
  stream: MediaStream
  chunks: Blob[]
  t0: number
  tick: number
  ctx: AudioContext | null
}

export class Finder {
  private readonly d: FinderDeps
  private live: Live | null = null
  /** bumps whenever what is under way stops mattering (discarded, cleared, left): its answer goes nowhere */
  private gen = 0
  private typing = 0
  constructor(d: FinderDeps) {
    this.d = d
  }

  private get s() {
    return this.d.store.getState()
  }

  /** The magnifier: the search opens, afresh, and listens at once. */
  open(): void {
    this.stopMic()
    this.gen++
    this.s.reset()
    this.d.layer(true)
    void this.listen()
  }

  /** The back arrow at the top: the search closes, and the next one starts afresh. */
  leave(): void {
    this.quit()
    this.s.reset()
    this.d.layer(false)
  }

  /** The search page went (Back): the microphone stops, nothing under way goes on. */
  quit(): void {
    this.stopMic()
    this.gen++
    clearTimeout(this.typing)
  }

  /** The desktop's dialog: on the last words, all selected (typing starts over), with what they found and no filter;
   * none: Recent. It does not listen. */
  openDesk(): void {
    this.quit()
    if (!this.s.words.trim()) this.s.reset()
    else this.s.set({ phase: this.s.answer ? 'found' : 'ready', added: '', heard: [], typed: true, replace: true, kind: 'all', project: null, status: null, sel: 0 })
    this.d.dialog(true)
  }

  /** The dialog closes (Esc, a click outside, ⌘K again, a result opened): the microphone stops; the words and what
   * they found stay for the next time. */
  closeDesk(): void {
    this.leaveDesk()
    this.d.dialog(false)
  }

  /** The dialog went: nothing under way goes on. */
  leaveDesk(): void {
    const busy = this.s.phase === 'listening' || this.s.phase === 'writing' || this.s.phase === 'searching'
    this.quit()
    if (busy) this.s.set({ phase: this.s.answer ? 'found' : 'ready' })
  }

  /** Words typed in the dialog (or in the home page's field): what they find comes a moment after you stop (two
   * letters at least; fewer: Recent, or nothing on the home page). */
  typeLive(words: string): void {
    this.gen++
    clearTimeout(this.typing)
    this.s.set({ words, added: '', heard: [], typed: true, replace: false, sel: 0, ...(this.s.phase === 'unheard' || this.s.phase === 'listening' || this.s.phase === 'writing' ? { phase: this.s.answer ? ('found' as const) : ('ready' as const) } : {}) })
    if (this.live) void this.stopMic()
    if (words.trim().length < 2) return this.s.set({ phase: 'ready', answer: null })
    this.typing = window.setTimeout(() => void this.search(++this.gen, true), TYPE_PAUSE)
  }

  /** The dialog's mic: what you say takes the words' place when they are all selected, else goes after them. */
  listenDesk(replace: boolean): Promise<void> {
    clearTimeout(this.typing)
    this.s.set({ replace, typed: false })
    return this.listen()
  }

  /** The dialog's filters and highlighted row. */
  narrow(p: Partial<Pick<FindState, 'kind' | 'project' | 'status'>>): void {
    this.s.set({ ...p, sel: 0 })
  }

  select(i: number): void {
    if (i !== this.s.sel) this.s.set({ sel: i })
  }

  /** The mic: say what to find, or say more (the words and the results stay while you speak). */
  async listen(): Promise<void> {
    if (this.live) return
    if (!canRecord()) return this.s.set({ phase: 'nomic' })
    const was = this.s.phase
    this.s.set({ phase: 'listening', added: '', ms: 0, levels: [] })
    const gen = ++this.gen // a search under way stops mattering: you say more
    let stream: MediaStream
    try {
      stream = await openMic()
    } catch {
      if (gen === this.gen) this.s.set({ phase: 'nomic' })
      return
    }
    if (gen !== this.gen || this.s.phase !== 'listening' || this.live) {
      stream.getTracks().forEach((t) => t.stop())
      if (gen === this.gen && this.s.phase === 'listening') this.s.set({ phase: was })
      return
    }
    const rec = new MediaRecorder(stream)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    rec.start(1000)
    let meter = () => 0.2
    let ctx: AudioContext | null = null
    try {
      ctx = new AudioContext()
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.fftSize)
      meter = () => (an.getByteTimeDomainData(buf), levelOf(buf))
    } catch {
      /* no meter: the bars stay even */
    }
    const t0 = Date.now()
    this.live = { rec, stream, chunks, t0, ctx, tick: window.setInterval(() => this.s.tick(Date.now() - t0, meter()), 100) }
  }

  /** The recording stops: -> its sound and how long it ran (none: nothing was recording). */
  private stopMic(): Promise<{ blob: Blob; ms: number } | null> {
    const r = this.live
    if (!r) return Promise.resolve(null)
    this.live = null
    clearInterval(r.tick)
    const ms = Date.now() - r.t0
    const done = new Promise<{ blob: Blob; ms: number }>((ok) => {
      r.rec.onstop = () => ok({ blob: new Blob(r.chunks, { type: r.rec.mimeType || 'audio/webm' }), ms })
    })
    r.rec.stop()
    r.stream.getTracks().forEach((t) => t.stop())
    void r.ctx?.close()
    return done
  }

  /** The x while it records or writes out: what you said goes; the page is as it was. */
  discard(): void {
    void this.stopMic()
    this.gen++
    this.s.set({ phase: this.s.answer ? 'found' : 'ready' })
  }

  /** The up arrow while it records: stop, write out what you said, search all the words. */
  async stop(): Promise<void> {
    const gen = ++this.gen
    const slug = this.d.voiceSlug()
    const before = this.s.answer
    this.s.set({ phase: 'writing' })
    const got = await this.stopMic()
    if (gen !== this.gen) return
    if (!got || got.ms < 800 || !got.blob.size || !slug) return this.s.set({ phase: before ? 'found' : 'unheard' })
    const heard = await this.hear(slug, got.blob, got.ms, gen)
    if (gen !== this.gen) return
    const tr = heard ? heardWords(heard.tr) : ''
    if (!heard || !tr) return this.s.set({ phase: before ? 'found' : 'unheard' })
    const replace = this.s.replace
    const { words, added } = replace ? { words: tr, added: '' } : saidMore(this.s.words, tr)
    const file: HeardFile = { key: heard.f, trAdded: tr, doubts: heard.doubts }
    this.s.set({ words, added, heard: replace ? [file] : [...this.s.heard, file], typed: false, replace: false })
    void this.search(gen)
  }

  /** Up, then its words (tried again with growing pauses while Taska is out of reach); none: null. */
  private async hear(slug: string, blob: Blob, ms: number, gen: number): Promise<{ f: string; tr: string; doubts: HeardFile['doubts'] } | null> {
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
    // out of reach once the page is sure (model/reach): one try without an answer still says it is writing
    const on = { again: () => gen === this.gen, waiting: () => void (gen === this.gen && this.s.set({ phase: 'offline' })) }
    let f = ''
    try {
      for (let tries = 0, waits = 0; gen === this.gen; ) {
        if (!f) f = (await this.d.delivery.until(() => this.d.api.upload(slug, blob, `search ${clock(ms).replace(':', '-')}.${ext}`, { voice: true }), on)).f
        const w = await this.d.delivery.until(() => this.d.api.words(slug, f, true, { again: tries > 0 }), on)
        if (this.s.phase === 'offline' && gen === this.gen) this.s.set({ phase: 'writing' })
        if (w.tr_error === 'no such voice note') {
          f = ''
          continue
        }
        if (!w.done && ++waits < 20) continue
        if (w.done && w.tr_error && ++tries < 4) continue
        return w.done && !w.tr_error ? { f, tr: w.tr || '', doubts: w.doubts } : null
      }
    } catch {
      /* Taska said no, or another search began */
    }
    return null
  }

  /** Search the words in the box (the results before stay, faded, until the new ones come); `keep`: the desktop's
   * typing, its filters and the words' place stay. */
  async search(gen = ++this.gen, keep = false): Promise<void> {
    const q = this.s.words.trim()
    if (!q) return
    this.s.set(keep ? { phase: 'searching', sel: 0 } : { phase: 'searching', typed: false, kind: 'all', sel: 0 })
    try {
      // out of reach once the page is sure (model/reach): until then it is still searching
      const a = await this.d.delivery.until(() => this.d.api.find(q, this.d.slug()), { again: () => gen === this.gen, waiting: () => void (gen === this.gen && this.s.set({ phase: 'offline', answer: null })) })
      if (gen !== this.gen) return
      this.s.set(a.found.length ? { phase: 'found', answer: a, sel: 0 } : { phase: 'nothing', answer: null })
    } catch (e) {
      if (gen !== this.gen || e instanceof Abandoned) return
      this.s.set({ phase: 'failed', answer: null })
    }
  }

  /** The x beside the words: they and the results go. */
  clear(): void {
    this.gen++
    this.s.set({ phase: 'ready', words: '', added: '', heard: [], answer: null, kind: 'all', typed: false })
  }

  /** Words typed (or the words tapped to type): the up arrow searches them. */
  type(words: string): void {
    // what it did not hear goes once you type
    this.s.set({ words, added: '', heard: [], typed: true, ...(this.s.phase === 'unheard' ? { phase: 'ready' as const } : {}) })
  }

  /** One version of a word that may be misheard: the words take it, and it searches again. */
  pick(fk: string, k: number, side: 'was' | 'alt'): void {
    const files = this.s.heard
    const f = files.find((x) => x.key === fk)
    if (!f) return
    const r = pickSide(this.s.words, f, k, side)
    this.s.set({ words: r.text, heard: files.map((x) => (x === f ? { ...x, trAdded: r.trAdded, doubts: r.doubts } : x)) })
    void this.search()
  }

  kind(k: FindKind | 'all'): void {
    this.s.set({ kind: k })
  }
}
