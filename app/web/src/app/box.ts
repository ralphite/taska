// The box: what it writes to, its draft there (words and files), and sending. A draft belongs to what it is written
// to: an item (a reply, "F12"), a new input ("new"), an edit of something you said ("edit r12", "append r12"), so
// unsent words never go elsewhere. A file is sent to Taska as soon as you add it; what you send waits for its files.
// What you just sent can be taken back for a while (Undo, Z); an edit or details added show at once and are saved
// behind you.

import type { TaskaApi } from '../api/taska'
import type { ProjectModel } from '../model/project'
import { inputCode } from '../model/words'
import type { BoxMode, BoxStore, DraftFile } from '../stores/box'
import type { DraftsStore } from '../stores/drafts'
import type { OutboxStore } from '../stores/outbox'
import { newId, type ChangeRunner } from './changeRunner'
import type { InputSender } from './inputSender'
import type { Toasts } from './toasts'

const UNSEND_MS = 10000

export interface BoxDeps {
  api: TaskaApi
  store: BoxStore
  drafts: DraftsStore
  outbox: OutboxStore
  inputs: InputSender
  runner: ChangeRunner
  toasts: Toasts
}

export class Box {
  private readonly d: BoxDeps
  private n = 0
  constructor(d: BoxDeps) {
    this.d = d
  }

  /** The draft the box shows: what it writes to. */
  key(scope: string | null, mode: BoxMode = this.d.store.getState().mode): string {
    if (mode?.kind === 'correct') return `correct ${mode.id}`
    if (mode?.kind === 'amend') return `${mode.mode} ${mode.id}`
    return scope || 'new'
  }

  text(slug: string, key: string): string {
    return this.d.drafts.getState().of(slug)[key] || ''
  }

  write(slug: string, key: string, text: string): void {
    this.d.drafts.getState().set(slug, key, text)
  }

  /** Files added to the draft: each goes up at once. */
  attach(slug: string, key: string, list: File[]): void {
    for (const file of list) {
      const fk = `local-${Date.now().toString(36)}-${++this.n}`
      const image = (file.type || '').startsWith('image/')
      const f: DraftFile = { key: fk, f: '', name: file.name || 'file', mime: file.type || 'application/octet-stream', size: file.size, uploading: true, ...(image && typeof URL !== 'undefined' ? { preview: URL.createObjectURL(file) } : {}) }
      this.d.store.getState().addFile(key, f)
      void this.upload(slug, fk, file)
    }
  }

  private async upload(slug: string, fk: string, file: File, tries = 0): Promise<void> {
    try {
      const up = await this.d.api.upload(slug, file, file.name || 'file')
      const patch = { f: up.f, name: up.name, mime: up.mime, size: up.size, uploading: false, failed: false }
      this.d.store.getState().updateFile(fk, patch)
      this.d.outbox.getState().updateFile(fk, patch)
      void this.d.inputs.flush()
    } catch {
      if (tries < 4) {
        await new Promise((ok) => setTimeout(ok, 2000 * (tries + 1)))
        return this.upload(slug, fk, file, tries + 1)
      }
      this.d.store.getState().updateFile(fk, { uploading: false, failed: true })
      this.d.outbox.getState().updateFile(fk, { uploading: false, failed: true })
      void this.d.inputs.flush()
    }
  }

  removeFile(key: string, fk: string): void {
    this.d.store.getState().removeFile(key, fk)
  }

  /** Send what the box has, to what it writes to. -> whether anything went */
  send(slug: string, m: ProjectModel | null, scope: string | null): boolean {
    const st = this.d.store.getState()
    const mode = st.mode
    const key = this.key(scope, mode)
    const text = this.text(slug, key).trim()
    const files = st.files[key] || []
    if (!text && !files.length) return false
    if (mode?.kind === 'amend') return this.amend(slug, m, mode, key, text)
    this.write(slug, key, '')
    st.takeFiles(key)
    const o = this.d.inputs.push({ slug, text, scope, files: files.map(({ key: k, ...f }) => ({ ...f, key: k })) })
    st.sentNow({ q: o.q, slug, key, until: Date.now() + UNSEND_MS })
    const step = this.d.toasts.undoable(`Send to ${scope || 'New input'}`, async () => (this.unsend(o.q), true))
    setTimeout(() => {
      this.d.toasts.forget(step)
      this.d.store.getState().forgetSent(o.q)
    }, UNSEND_MS)
    return true
  }

  /** An edit of something you said, or details added: it shows at once and is saved behind you. */
  private amend(slug: string, m: ProjectModel | null, mode: Extract<BoxMode, { kind: 'amend' }>, key: string, text: string): boolean {
    const st = this.d.store.getState()
    const drafts = st.takeFiles(key)
    this.write(slug, key, '')
    st.setMode(null)
    const r = m?.byId.get(mode.id)
    const now = r ? (mode.mode === 'edit' ? text : r.text.endsWith(text) ? r.text : [r.text, text].filter(Boolean).join('\n\n')) : text
    this.d.toasts.show(mode.mode === 'edit' ? `${inputCode(mode.id)} updated` : `Added to ${inputCode(mode.id)}`)
    const files = drafts.filter((f) => f.f && !f.failed).map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size, ...(f.tr ? { tr: f.tr } : {}) }))
    void this.d.runner.send({
      id: newId(),
      slug,
      commands: [{ op: 'amend', id: mode.id, mode: mode.mode, v: mode.v, text, files }],
      patches: [],
      inputPatches: text ? [{ id: mode.id, f: { text: now } }] : [],
      said: mode.mode === 'edit' ? `editing ${inputCode(mode.id)}` : `adding to ${inputCode(mode.id)}`,
      t: Date.now(),
    })
    return true
  }

  /** Take back what you just sent: its words come back to the box (there, or to the draft it was written in). */
  unsend(q: string): void {
    const st = this.d.store.getState()
    const j = st.sent.find((x) => x.q === q)
    const o = this.d.outbox.getState().list.find((x) => x.q === q)
    if (!j) return
    st.forgetSent(q)
    if (o && o.state !== 'sending') this.d.outbox.getState().remove(q)
    else if (o) this.d.outbox.getState().update(q, { unsent: true })
    const was = this.text(j.slug, j.key)
    const text = o?.text ?? ''
    this.write(j.slug, j.key, was.trim() ? text + '\n\n' + was : text)
    if (o) st.putFiles(j.key, o.files.filter((f) => !f.failed).map((f) => ({ ...f, key: f.key || f.f })) as DraftFile[])
    this.d.toasts.show('Not sent. Text restored')
  }

  /** Whether what you sent can still be taken back. */
  canUnsend(q: string, now: number): boolean {
    return this.d.store.getState().sent.some((x) => x.q === q && x.until > now)
  }

  /** Edit or add details to something you said: the box writes there (an edit begins with its words). */
  amendStart(slug: string, m: ProjectModel | null, id: string, mode: 'edit' | 'append'): void {
    const r = m?.byId.get(id)
    if (!r || r.moved) return
    this.d.store.getState().setMode({ kind: 'amend', id, mode, v: r.v || 0 })
    const key = `${mode} ${id}`
    if (mode === 'edit' && !this.text(slug, key).trim()) this.write(slug, key, r.text)
  }

  stop(): void {
    this.d.store.getState().setMode(null)
  }
}
