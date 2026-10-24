// The box: what it writes to, its draft there (words and files), and sending. A draft belongs to what it is written
// to: an item (a reply, "F12"), a new input ("new"), an edit of something you said ("edit r12", "append r12"), so
// unsent words never go elsewhere. A file is sent to Taska as soon as you add it; what you send waits for its files.
// What you just sent can be taken back for a while (Undo, Z); an edit or details added show at once and are saved
// behind you.

import { Refused } from '../../api/http'
import type { TaskaApi } from '../../api/taska'
import type { ProjectModel } from '../../model/project'
import { inputCode } from '../../model/words'
import { docDraft, draftKey, draftName, keyOf, NEW_DRAFT, PREFS_DRAFT, scopeDraft, type DraftKey } from '../../model/draftTarget'
import type { BoxStore, DraftFile } from '../../stores/box'
import type { BoxMode } from '../../model/boxFoot'
import type { DraftsStore } from '../../stores/drafts'
import type { OutboxStore } from '../../stores/outbox'
import type { KeyValueStore } from '../../stores/storage'
import { newId, type ChangeRunner } from '../changeRunner'
import type { InputSender } from './inputSender'
import type { Toasts } from '../page/toasts'

const UNSEND_MS = 10000

export interface BoxDeps {
  api: TaskaApi
  store: BoxStore
  drafts: DraftsStore
  outbox: OutboxStore
  inputs: InputSender
  runner: ChangeRunner
  toasts: Toasts
  /** kept in this browser until it is up and sent: its id there */
  keep?(blob: Blob): string
  /** a voice note is being recorded */
  recording?(): boolean
  /** to the box a draft belongs to */
  goDraft?(key: DraftKey): void
  /** the project's model now (Undo puts back what it says then) */
  model?(slug: string): ProjectModel | null
  /** this browser's own store: the words an input had when you began an edit of it */
  kv?: KeyValueStore
  /** the project loaded afresh */
  refresh?(slug: string): Promise<void>
  /** the other tabs: this draft went out from here */
  sent?(slug: string, key: DraftKey): void
  /** a reply to the item open on the desktop: its talk goes to its end, where the reply shows */
  replied?(slug: string, scope: string): void
}

export class Box {
  private readonly d: BoxDeps
  private n = 0
  constructor(d: BoxDeps) {
    this.d = d
    // a new input not sent stays in its draft when the box goes to write elsewhere: it says so
    d.store.subscribe((s, was) => {
      if (s.slug !== was.slug || was.shown.key !== NEW_DRAFT || s.shown.key === NEW_DRAFT || this.d.recording?.()) return
      if (!this.text(s.slug, NEW_DRAFT).trim() && !s.files[NEW_DRAFT]?.length) return
      setTimeout(() => this.d.toasts.show('Your new input is kept, not sent', () => this.d.goDraft?.(NEW_DRAFT), { label: 'Open' }))
    })
  }

  /** The draft the box shows: what it writes to (`doc`: a comment on that document). */
  key(scope: string | null, mode: BoxMode = this.d.store.getState().mode, doc: number | null = null): DraftKey {
    if (mode?.kind === 'correct') return draftKey({ kind: 'correct', id: mode.id })
    if (mode?.kind === 'amend') return draftKey({ kind: 'amend', mode: mode.mode, id: mode.id })
    if (mode?.kind === 'comment') return draftKey({ kind: 'comment', d: mode.d, id: mode.id })
    if (mode?.kind === 'prefs') return PREFS_DRAFT
    if (doc != null) return docDraft(doc)
    return scopeDraft(scope)
  }

  /** What the draft holds, taken out of the box (its files once they are up). */
  take(slug: string, key: DraftKey): { text: string; files: DraftFile[] } {
    const text = this.text(slug, key).trim()
    const files = [...(this.d.store.getState().files[key] || [])]
    this.write(slug, key, '')
    this.d.store.getState().takeFiles(key)
    return { text, files }
  }

  /** It was not saved: the words come back to the draft, before what was written since. */
  putBack(slug: string, key: DraftKey, text: string, files: DraftFile[] = []): void {
    const now = this.text(slug, key).trim()
    this.write(slug, key, [text, now].filter(Boolean).join('\n'))
    if (files.length) this.d.store.getState().putFiles(key, files)
  }

  /** Edit a comment of yours: the box writes there, beginning with its words. */
  commentStart(slug: string, d: number, id: number, was: string): void {
    this.d.store.getState().setMode({ kind: 'comment', d, id, was })
    const key = draftKey({ kind: 'comment', d, id })
    if (!this.text(slug, key).trim()) this.write(slug, key, was)
  }

  text(slug: string, key: DraftKey): string {
    return this.d.drafts.getState().of(slug)[key] || ''
  }

  write(slug: string, key: DraftKey, text: string): void {
    this.d.drafts.getState().set(slug, key, text)
  }

  /** Files added to the draft: each goes up at once. */
  attach(slug: string, key: DraftKey, list: File[]): void {
    for (const file of list) {
      const fk = `local-${Date.now().toString(36)}-${++this.n}`
      const image = (file.type || '').startsWith('image/')
      const rid = this.d.keep?.(file)
      const f: DraftFile = { key: fk, f: '', name: file.name || 'file', mime: file.type || 'application/octet-stream', size: file.size, uploading: true, t: Date.now(), plain: true, ...(rid ? { rid } : {}), ...(image && typeof URL !== 'undefined' ? { preview: URL.createObjectURL(file) } : {}) }
      this.d.store.getState().addFile(key, f)
      void this.upload(slug, fk, file)
    }
  }

  /** A kept file not up before the reload: up now. */
  resume(slug: string, fk: string, blob: Blob, name: string): void {
    void this.upload(slug, fk, blob, name)
  }

  /** Up to Taska, tried again with growing pauses for as long as it cannot be reached; refused (too big), it leaves
   * the draft (what was sent goes without it) and says so. */
  private async upload(slug: string, fk: string, file: Blob, name = (file as File).name || 'file', tries = 0): Promise<void> {
    try {
      const up = await this.d.api.upload(slug, file, name)
      const patch = { f: up.f, name: up.name, mime: up.mime, size: up.size, uploading: false, failed: false }
      this.d.store.getState().updateFile(fk, patch)
      this.d.outbox.getState().updateFile(fk, patch)
      void this.d.inputs.flush()
    } catch (ex) {
      const st = this.d.store.getState()
      const key = Object.keys(st.files).find((k) => st.files[k].some((f) => f.key === fk))
      const inOutbox = this.d.outbox.getState().list.some((o) => o.files.some((f) => f.key === fk))
      if (!key && !inOutbox) return // taken off the draft meanwhile
      if (!(ex instanceof Refused)) {
        await new Promise((ok) => setTimeout(ok, Math.min(30000, 2000 * 2 ** Math.min(tries, 4))))
        return this.upload(slug, fk, file, name, tries + 1)
      }
      if (key) st.removeFile(keyOf(key), fk)
      this.d.outbox.getState().updateFile(fk, { uploading: false, failed: true })
      void this.d.inputs.flush()
      this.d.toasts.show(`Failed to upload ${name}`)
    }
  }

  /** A file off the draft; a voice note takes the words it put there with it, and both come back with Undo. */
  removeFile(slug: string, key: DraftKey, fk: string): void {
    const st = this.d.store.getState()
    const files = st.files[key] || []
    const i = files.findIndex((f) => f.key === fk)
    const f = files[i]
    if (!f) return
    const before = this.text(slug, key)
    st.removeFile(key, fk)
    if (!f.trAdded || !before.includes(f.trAdded)) return
    this.write(slug, key, before.replace(f.trAdded, '').replace(/\n{3,}/g, '\n\n').trim())
    this.d.toasts.show('Removed the voice note and its words', () => {
      const rest = this.d.store.getState().takeFiles(key)
      this.d.store.getState().putFiles(key, [...rest.slice(0, i), f, ...rest.slice(i)])
      this.write(slug, key, before)
    })
  }

  /** The draft `key` went out from this tab: the other tabs drop it from their box. */
  markSent(slug: string, key: DraftKey): void {
    this.d.sent?.(slug, key)
  }

  /** Send what the box has, to what it writes to. -> whether anything went */
  send(slug: string, m: ProjectModel | null, scope: string | null, draft?: DraftKey): boolean {
    const st = this.d.store.getState()
    const mode = st.mode
    const key = draft ?? this.key(scope, mode)
    const text = this.text(slug, key).trim()
    const files = st.files[key] || []
    if (mode?.kind === 'correct') return this.correct(slug, m, mode, key)
    if (!text && !files.length) return false
    if (mode?.kind === 'amend') return this.amend(slug, m, mode, key, text)
    this.write(slug, key, '')
    st.takeFiles(key)
    const o = this.d.inputs.push({ slug, text, scope, files: files.map(({ key: k, ...f }) => ({ ...f, key: k })) })
    st.sentNow({ q: o.q, slug, key, until: Date.now() + UNSEND_MS })
    this.markSent(slug, key)
    if (scope) this.d.replied?.(slug, scope)
    const step = this.d.toasts.undoable(`Send to ${scope || 'New input'}`, async () => (this.unsend(o.q), true))
    setTimeout(() => {
      this.d.toasts.forget(step)
      this.d.store.getState().forgetSent(o.q)
    }, UNSEND_MS)
    return true
  }

  /** An edit of something you said, or details added: it shows at once and is saved behind you. */
  private amend(slug: string, m: ProjectModel | null, mode: Extract<BoxMode, { kind: 'amend' }>, key: DraftKey, text: string): boolean {
    const st = this.d.store.getState()
    const drafts = st.takeFiles(key)
    this.write(slug, key, '')
    st.setMode(null)
    const r = m?.byId.get(mode.id)
    const now = r ? (mode.mode === 'edit' ? text : r.text.endsWith(text) ? r.text : [r.text, text].filter(Boolean).join('\n\n')) : text
    this.d.toasts.show(mode.mode === 'edit' ? `${inputCode(mode.id)} updated` : `Added to ${inputCode(mode.id)}`)
    const files = drafts.filter((f) => f.f && !f.failed).map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size, ...(f.tr ? { tr: f.tr } : {}) }))
    const said = mode.mode === 'edit' ? `editing ${inputCode(mode.id)}` : `adding to ${inputCode(mode.id)}`
    void (async () => {
      const ok = await this.d.runner.send({
        id: newId(),
        slug,
        commands: [{ op: 'amend', id: mode.id, mode: mode.mode, v: mode.v, text, files }],
        patches: [],
        inputPatches: text ? [{ id: mode.id, f: { text: now } }] : [],
        said,
        t: Date.now(),
        ownRefusal: true,
      })
      if (!ok) await this.editedElsewhere(slug, mode, key, text, files, drafts, said)
    })()
    return true
  }

  /** Your edit was refused because the input changed in another window (another tab added to it, its voice note's
   * words came): when that only added words after the ones you began from, they go on after yours and it is saved;
   * otherwise your words come back in the box with what it says now, and Save puts yours in its place. */
  private async editedElsewhere(slug: string, mode: Extract<BoxMode, { kind: 'amend' }>, key: DraftKey, text: string, files: unknown[], drafts: DraftFile[], said: string): Promise<void> {
    await this.d.refresh?.(slug)
    const r = this.d.model?.(slug)?.byId.get(mode.id)
    if (!r) return
    const code = inputCode(mode.id)
    if (mode.mode === 'edit' && mode.base != null && r.text !== mode.base && r.text.startsWith(mode.base)) {
      const merged = text + r.text.slice(mode.base.length)
      const ok = await this.d.runner.send({ id: newId(), slug, commands: [{ op: 'amend', id: mode.id, mode: 'edit', v: r.v || 0, text: merged, files }], patches: [], inputPatches: [{ id: mode.id, f: { text: merged } }], said, t: Date.now() })
      if (ok) this.d.toasts.show(`${code} updated with changes from another window`)
      return
    }
    this.d.store.getState().setMode({ ...mode, v: r.v || 0, base: r.text })
    this.write(slug, key, text)
    if (drafts.length) this.d.store.getState().putFiles(key, drafts)
    this.d.toasts.show(`${code} changed elsewhere. Text restored; save to apply`, null, { error: true, sticky: true }) // the box's line shows what it says now
  }

  /** What did not go out yet, back in the box to change (the box must be empty). -> it came back */
  editOutgoing(slug: string, key: DraftKey): boolean {
    const o = this.d.outbox.getState().list.find((x) => x.slug === slug && !x.unsent)
    if (!o) return false
    if (this.text(slug, key).trim() || (this.d.store.getState().files[key] || []).length) {
      this.d.toasts.show('Send or clear the box first')
      return false
    }
    this.d.outbox.getState().remove(o.q)
    this.write(slug, key, o.text)
    if (o.files.length) this.d.store.getState().putFiles(key, o.files.map((f) => ({ ...f, key: f.key || f.f })))
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
    this.d.toasts.show(j.key === st.shown.key ? 'Not sent. Text restored' : `Not sent. Text restored to ${draftName(j.key)}`)
  }

  /** Whether what you sent can still be taken back. */
  canUnsend(q: string, now: number): boolean {
    return this.d.store.getState().sent.some((x) => x.q === q && x.until > now)
  }

  /** Edit or add details to something you said: the box writes there (an edit begins with its words). */
  amendStart(slug: string, m: ProjectModel | null, id: string, mode: 'edit' | 'append'): void {
    const r = m?.byId.get(id)
    if (!r || r.moved) return
    this.d.store.getState().setMode({ kind: 'amend', id, mode, v: r.v || 0, base: r.text })
    const key = draftKey({ kind: 'amend', mode, id })
    const base = this.editBase(slug, key)
    if (mode === 'edit' && !this.text(slug, key).trim()) this.write(slug, key, r.text)
    else if (mode === 'edit' && base != null && base !== r.text) {
      // your edit not saved began before it changed elsewhere: what was added since goes on after your words
      if (r.text.startsWith(base)) {
        this.write(slug, key, this.text(slug, key) + r.text.slice(base.length))
        this.d.toasts.show(`${inputCode(id)}: merged new text from another window`)
      } else this.d.toasts.show(`${inputCode(id)} changed in another window since you began`, null, { error: true, sticky: true }) // the box's line shows what it says now
    }
    this.editBase(slug, key, r.text)
  }

  /** The words an input had when you began an edit of it (kept with the draft, in this browser). */
  private editBase(slug: string, key: DraftKey, set?: string): string | null {
    const kv = this.d.kv
    if (!kv) return null
    const all = kv.getJson<Record<string, string>>('taska.editbase.' + slug) || {}
    if (set === undefined) return all[key] ?? null
    kv.setJson('taska.editbase.' + slug, { ...all, [key]: set })
    return null
  }

  /** Words selected in a voice note's input: corrected in the box (the input changes, Taska remembers the spelling). */
  correctStart(id: string, wrong: string, v: number, bySel = true): void {
    this.d.store.getState().setMode({ kind: 'correct', id, wrong, v, bySel })
  }

  /** The right words: the input shows them at once and they are saved behind you, with Undo (words and spelling). */
  private correct(slug: string, m: ProjectModel | null, mode: Extract<BoxMode, { kind: 'correct' }>, key: DraftKey): boolean {
    const right = this.text(slug, key).replace(/\s+/g, ' ').trim()
    if (!right) return false
    const r = m?.byId.get(mode.id)
    const before = r?.text
    this.write(slug, key, '')
    this.d.store.getState().setMode(null)
    if (typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
    void (async () => {
      const had = await this.d.api.corrections().then((l) => l.find((x) => x.wrong === mode.wrong), () => undefined)
      const ok = await this.d.runner.send({
        id: newId(),
        slug,
        commands: [{ op: 'correct', id: mode.id, wrong: mode.wrong, right, v: mode.v } as never],
        patches: [],
        inputPatches: r ? [{ id: mode.id, f: { text: r.text.split(mode.wrong).join(right) } }] : [],
        said: `correcting ${inputCode(mode.id)}`,
        t: Date.now(),
      })
      if (!ok) {
        this.d.store.getState().setMode(mode)
        this.putBack(slug, key, right)
        return
      }
      this.d.toasts.show(`Fixed ${mode.id}. Voice notes will use \u201c${right}\u201d`, async () => {
        // the words come back, and the spelling is forgotten (or the one before comes back)
        const now = this.d.model?.(slug)?.byId.get(mode.id)
        if (now && before != null && now.text !== before) await this.d.runner.send({ id: newId(), slug, commands: [{ op: 'amend', id: mode.id, mode: 'edit', v: now.v || 0, text: before } as never], patches: [], inputPatches: [{ id: mode.id, f: { text: before } }], said: `putting back ${inputCode(mode.id)}`, t: Date.now() })
        await this.d.api.setCorrection(had?.wrong ? { wrong: mode.wrong, right: had.right, undo: true } : { wrong: mode.wrong }).catch(() => {})
        this.d.toasts.show(`Put back \u201c${mode.wrong}\u201d in ${mode.id}${had ? '' : ', and forgot the spelling'}`)
      })
    })()
    return true
  }

  stop(): void {
    if (this.d.store.getState().mode?.kind === 'correct' && typeof getSelection !== 'undefined') getSelection()?.removeAllRanges()
    this.d.store.getState().setMode(null)
  }
}
