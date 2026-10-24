// Voice notes and files not up yet are kept in this browser, with their audio, until Taska has them: what is in the
// drafts and the outbox is written to the vault as it changes (and taken out when it is sent or removed), and when a
// project opens what this browser kept comes back: into the draft it was recorded in, never the one open now, and
// what had been sent goes out again under the same id, so Taska takes it once. While a page has a note, the other
// tabs leave it alone.

import type { ProjectModel } from '../model/project'
import { codeOf, liveN } from '../model/project'
import type { BoxStore, DraftFile } from '../stores/box'
import type { KeptNote, NoteVault } from '../stores/noteVault'
import type { OutboxStore } from '../stores/outbox'
import type { OutFile } from '../model/outgoing'
import type { KeyValueStore } from '../stores/storage'
import { plural } from '../model/words'
import type { InputSender } from './inputSender'
import type { Toasts } from './toasts'
import { draftKey, draftTarget, NEW_DRAFT, replyDraft, scopeDraft, type DraftKey } from '../model/draftTarget'

type Rec = Omit<KeptNote, 'data'>

export interface KeptNotesDeps {
  vault: NoteVault
  kv: KeyValueStore
  box: BoxStore
  outbox: OutboxStore
  inputs: InputSender
  toasts: Toasts
  /** a kept note's words or upload go on (voice: up, then its words; a file: up) */
  resume(slug: string, key: DraftKey, f: DraftFile, blob: Blob, scope: string | null): void
  /** its words go into its draft */
  place(slug: string, key: DraftKey, f: DraftFile): void
  /** a draft's name, as the box says it ("New input", "B12") */
  draftName(key: DraftKey): string
  goDraft(key: DraftKey): void
  boxKey(): DraftKey
}

const locks = (): LockManager | null => (typeof navigator !== 'undefined' && navigator.locks) || null

export class KeptNotes {
  private readonly d: KeptNotesDeps
  private readonly blobs = new Map<string, Blob>()
  /** what was written for each note, and where it was */
  private readonly known = new Map<string, { sig: string; project: string; sent: boolean }>()
  private readonly held = new Map<string, () => void>()
  private queued = false
  private slug = ''
  private restored = ''
  private n = 0
  constructor(d: KeptNotesDeps) {
    this.d = d
    d.box.subscribe(() => this.soon())
    d.outbox.subscribe(() => this.soon())
  }

  /** A new note's id in the vault. */
  id(): string {
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + ++this.n
  }

  /** A new note's audio (or a file) kept under a new id -> the id. */
  keep(blob: Blob): string {
    const rid = this.id()
    this.hold(rid, blob)
    return rid
  }

  /** Its audio (or the file), kept with what is known of it. */
  hold(rid: string, blob: Blob): void {
    this.blobs.set(rid, blob)
    this.soon()
  }

  private soon(): void {
    if (this.queued) return
    this.queued = true
    queueMicrotask(() => {
      this.queued = false
      void this.write()
    })
  }

  private rec(project: string, key: string | null, f: DraftFile | OutFile, job: KeptNote['job']): Rec {
    const d = f as DraftFile
    const scope = key && /^[A-Z]\d+$/.test(key) ? key : null
    return {
      id: f.rid as string,
      project,
      key,
      scope,
      name: f.name,
      mime: f.mime || '',
      ms: d.ms || 0,
      t: d.t || 0,
      f: f.f || null,
      tr: d.transcribing ? null : d.tr || '',
      tr_error: d.trError || '',
      doubts: [...(d.doubts || [])],
      added: d.trAdded || null,
      job,
      vc: null,
      ...(d.plain ? { plain: true } : {}),
    }
  }

  /** What is in the drafts and on its way now, written; what went, taken out. */
  private async write(): Promise<void> {
    const box = this.d.box.getState()
    if (box.slug !== this.slug) {
      // another project's drafts are not in the box any more: still kept, they come back there
      for (const [rid, k] of this.known)
        if (!k.sent && k.project === this.slug) {
          this.known.delete(rid)
          this.blobs.delete(rid)
          this.release(rid)
        }
      this.slug = box.slug
    }
    const live = new Map<string, Rec>()
    for (const [key, fs] of Object.entries(box.files)) for (const f of fs) if (f.rid && !f.failed) live.set(f.rid, this.rec(box.slug, key, f, null))
    for (const o of this.d.outbox.getState().list)
      for (const f of o.files) if (f.rid && !f.failed && !o.unsent) live.set(f.rid, this.rec(o.slug, o.scope || 'new', f, { id: o.q, text: o.text }))
    for (const [rid, r] of live) {
      const sig = JSON.stringify(r)
      if (this.known.get(rid)?.sig === sig) continue
      const blob = this.blobs.get(rid)
      if (!blob) continue
      this.known.set(rid, { sig, project: r.project, sent: !!r.job })
      this.lock(rid)
      let data: ArrayBuffer
      try {
        data = await blob.arrayBuffer()
      } catch {
        continue
      }
      if (this.known.get(rid)?.sig === sig) await this.d.vault.put({ ...r, data })
    }
    for (const rid of [...this.known.keys()])
      if (!live.has(rid)) {
        this.known.delete(rid)
        this.blobs.delete(rid)
        this.release(rid)
        await this.d.vault.del(rid) // sent, or removed from its draft: this browser lets it go
      }
  }

  private lock(rid: string): void {
    const l = locks()
    if (!l || this.held.has(rid)) return
    let let_go: () => void = () => {}
    const p = new Promise<void>((r) => (let_go = r))
    this.held.set(rid, let_go)
    void l.request('taska-voice-' + rid, () => p).catch(() => {})
  }

  private release(rid: string): void {
    this.held.get(rid)?.()
    this.held.delete(rid)
  }

  /** The draft a kept note goes back to: the one it was recorded in, if that is still there. */
  private keyFor(m: ProjectModel, key: string | null): DraftKey {
    const t = draftTarget(key || 'new')
    if (t.kind === 'reply') {
      const n = Number(/\d+/.exec(t.code)?.[0])
      return m.byN.has(n) ? replyDraft(codeOf(m, liveN(m, n))) : NEW_DRAFT
    }
    if (((t.kind === 'amend' || t.kind === 'correct') && m.byId.has(t.id)) || (t.kind === 'doc' && m.docs.some((x) => x.d === t.d))) return draftKey(t)
    return NEW_DRAFT
  }

  /** The project opened: what this browser kept that did not go out comes back. */
  async restore(slug: string, m: ProjectModel): Promise<void> {
    if (this.restored === slug) return
    this.restored = slug
    const box = this.d.box.getState()
    const out = this.d.outbox.getState().list
    const here = new Set([...Object.values(box.files).flat(), ...out.flatMap((o) => o.files)].map((f) => f.rid).filter(Boolean))
    const going = new Set(out.flatMap((o) => o.files.map((x) => x.f)).filter(Boolean))
    const goingQ = new Set(out.map((o) => o.q))
    const sent = new Set(m.inputs.flatMap((r) => r.files.map((x) => x.f)))
    const resend = new Map<string, { slug: string; text: string; scope: string | null; t: number; files: DraftFile[] }>()
    const back: { key: DraftKey; f: DraftFile }[] = []
    for (const r of (await this.d.vault.all()).sort((a, b) => a.t - b.t)) {
      if ((r.project !== slug && !r.job) || here.has(r.id)) continue
      if ((r.f && going.has(r.f)) || (r.job && goingQ.has(r.job.id))) continue // on its way already
      if (r.project === slug && r.f && sent.has(r.f)) {
        void this.d.vault.del(r.id) // it went out already
        continue
      }
      const l = locks()
      if (l && !(await l.request('taska-voice-' + r.id, { ifAvailable: true }, (x) => !!x))) continue // another tab has it
      const blob = new Blob([r.data], { type: r.mime })
      const image = r.plain && r.mime.startsWith('image/')
      const f: DraftFile = {
        key: r.id,
        rid: r.id,
        f: r.f || '',
        name: r.name,
        mime: r.mime,
        size: r.data.byteLength,
        ms: r.ms,
        t: r.t,
        uploading: !r.f,
        transcribing: !r.plain && r.tr == null && !r.tr_error,
        tr: r.tr || '',
        trError: r.tr_error || '',
        doubts: r.doubts || [],
        ...(r.added ? { trAdded: r.added } : {}),
        ...(r.plain ? { plain: true } : {}),
        ...(image && typeof URL !== 'undefined' ? { preview: URL.createObjectURL(blob) } : {}),
      }
      this.blobs.set(r.id, blob)
      if (r.job) {
        // sent, but Taska did not have it yet: it goes on to the project it was sent in, under the same id
        const j = resend.get(r.job.id) || { slug: r.project, text: r.job.text, scope: r.scope, t: r.t, files: [] }
        j.files.push(f)
        resend.set(r.job.id, j)
        continue
      }
      const key = this.keyFor(m, r.key)
      back.push({ key, f })
    }
    for (const [q, j] of resend) {
      this.d.inputs.push({ q, slug: j.slug, text: j.text, scope: j.scope, files: j.files, t: j.t, back: true })
      for (const f of j.files) if (!f.f) this.d.resume(j.slug, scopeDraft(j.scope), f, this.blobs.get(f.rid as string) as Blob, j.scope)
    }
    for (const { key, f } of back) {
      this.d.box.getState().addFile(key, f)
      if (f.transcribing || !f.f) this.d.resume(slug, key, f, this.blobs.get(f.rid as string) as Blob, (() => { const t = draftTarget(key); return t.kind === 'reply' ? t.code : null })())
      else if (!f.plain && f.tr && !f.trAdded) this.d.place(slug, key, f)
    }
    this.soon()
    if (!back.length) return
    // each kept note or file is told about once, not on every page load
    const told = this.d.kv.getJson<string[]>('taska.toldKept') || []
    const fresh = back.filter((b) => !told.includes(b.f.rid as string))
    this.d.kv.setJson('taska.toldKept', [...told, ...fresh.map((b) => b.f.rid)].slice(-200))
    if (!fresh.length) return
    const away = back.find((b) => b.key !== this.d.boxKey())?.key
    const voice = fresh.filter((b) => !b.f.plain).length
    const files = fresh.length - voice
    const what = [voice ? (voice === 1 ? 'Voice note' : `${voice} voice notes`) : '', files ? plural(files, 'file') : ''].filter(Boolean).join(' and ')
    const say = `${what} kept${away ? ` for ${this.d.draftName(away)}` : ''}`
    if (away) this.d.toasts.show(say, () => this.d.goDraft(away), { label: 'Go there' })
    else this.d.toasts.show(say)
  }

  /** A project opens again: what it kept can come back. */
  reset(): void {
    this.restored = ''
  }
}
