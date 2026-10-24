// The box you write in, beyond its words (those are drafts): what it writes to when that is not the place you are
// (an edit of something you said, details added to it, a correction of a misheard word), the files waiting in each
// draft (pictures and files kept over a reload of this tab, as taska.draftfiles.<project>), and what you just sent
// that you can still take back.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { OutFile } from './outbox'
import type { Doubt } from '../model/types'
import type { VcMark } from '../model/voiceComments'
import type { KeyValueStore } from './storage'
import { NEW_DRAFT, type DraftKey } from '../model/draftTarget'

export type BoxMode =
  | { kind: 'amend'; id: string; mode: 'edit' | 'append'; v: number; /** its words when the edit began */ base?: string }
  /** words of a voice note's input being corrected (`v`: the input's version); `bySel`: started from a selection */
  | { kind: 'correct'; id: string; wrong: string; v: number; bySel?: boolean }
  /** a comment of yours on a document, being edited */
  | { kind: 'comment'; d: number; id: number; was: string }
  /** the transcription preferences, being edited (every project's) */
  | { kind: 'prefs'; was: string }
  | null

export interface DraftFile extends OutFile {
  /** the page's own id for it (it has no "f" until it is up) */
  key: string
  /** a voice note's length, ms */
  ms?: number
  /** a voice note whose words are still being worked out */
  transcribing?: boolean
  /** where in the draft's words it was recorded (its words go there) */
  at?: number
  /** its words as put in the draft (they are looked for there, to swap a misheard word) */
  trAdded?: string
  /** words that may be misheard */
  doubts?: Doubt[]
  /** fuller words may follow */
  more?: boolean
  /** why its words did not come */
  trError?: string
  /** when it was made (ms) */
  t?: number
  /** a picture or another file kept until it is up: no words to wait for */
  plain?: boolean
  /** a voice comment: the quote line its words go under */
  vc?: string
}

export interface JustSent {
  q: string
  slug: string
  /** the draft it was written in */
  key: DraftKey
  /** until when it can be taken back (ms) */
  until: number
  /** the input it became, once Taska has it */
  rid?: string
}

export interface BoxState {
  slug: string
  mode: BoxMode
  files: Readonly<Record<string, readonly DraftFile[]>>
  sent: readonly JustSent[]
  /** the draft the box shows now, and the item it writes to (a voice note stopped elsewhere knows where it goes) */
  shown: { key: DraftKey; scope: string | null }
  setShown(key: DraftKey, scope: string | null): void
  /** the phone: the words show in the box with the versions of misheard words to pick from */
  showWords: boolean
  setShowWords(on: boolean): void
  /** what each quote line of a voice comment is about */
  marks: readonly VcMark[]
  setMarks(m: readonly VcMark[]): void
  show(slug: string): void
  setMode(m: BoxMode): void
  addFile(key: DraftKey, f: DraftFile): void
  updateFile(fileKey: string, patch: Partial<DraftFile>): void
  removeFile(key: DraftKey, fileKey: string): void
  /** the draft's files go (with what it sends) */
  takeFiles(key: DraftKey): DraftFile[]
  putFiles(key: DraftKey, files: DraftFile[]): void
  sentNow(j: JustSent): void
  sentAs(q: string, rid: string): void
  forgetSent(q: string): void
}

export type BoxStore = StoreApi<BoxState>

const KEY = 'taska.draftfiles.'

export function createBoxStore(session: KeyValueStore): BoxStore {
  const keep = (slug: string, files: Record<string, readonly DraftFile[]>) => {
    const out: Record<string, unknown[]> = {}
    for (const [k, fs] of Object.entries(files)) {
      const ok = fs.filter((f) => f.f && !f.failed && !(f.mime || '').startsWith('audio/')).map((f) => ({ f: f.f, name: f.name, mime: f.mime, size: f.size, ...(f.rid ? { rid: f.rid } : {}) }))
      if (ok.length) out[k] = ok
    }
    session.setJson(KEY + slug, Object.keys(out).length ? out : null)
  }
  const kept = (slug: string): Record<string, DraftFile[]> => {
    const all = session.getJson<Record<string, DraftFile[]>>(KEY + slug) || {}
    const out: Record<string, DraftFile[]> = {}
    for (const [k, fs] of Object.entries(all)) out[k] = (fs || []).map((f) => ({ ...f, key: f.f }))
    return out
  }
  return createStore<BoxState>()((set, get) => {
    const files = (next: Record<string, readonly DraftFile[]>) => {
      keep(get().slug, next)
      set({ files: next })
    }
    return {
      slug: '',
      mode: null,
      files: {},
      sent: [],
      shown: { key: NEW_DRAFT, scope: null },
      showWords: false,
      setShowWords: (showWords) => set({ showWords }),
      marks: [],
      setMarks: (marks) => set({ marks }),
      setShown: (key, scope) => {
        const was = get().shown
        if (was.key !== key || was.scope !== scope) set({ shown: { key, scope } })
      },
      show: (slug) => {
        if (get().slug === slug) return
        set({ slug, mode: null, files: kept(slug) })
      },
      setMode: (mode) => set({ mode }),
      addFile: (key, f) => files({ ...get().files, [key]: [...(get().files[key] || []), f] }),
      updateFile: (fileKey, patch) => {
        const next: Record<string, readonly DraftFile[]> = {}
        for (const [k, fs] of Object.entries(get().files)) next[k] = fs.map((f) => (f.key === fileKey ? { ...f, ...patch } : f))
        files(next)
      },
      removeFile: (key, fileKey) => files({ ...get().files, [key]: (get().files[key] || []).filter((f) => f.key !== fileKey) }),
      takeFiles: (key) => {
        const out = [...(get().files[key] || [])]
        const next = { ...get().files }
        delete next[key]
        files(next)
        return out
      },
      putFiles: (key, fs) => files({ ...get().files, [key]: [...fs, ...(get().files[key] || [])] }),
      sentNow: (j) => set((s) => ({ sent: [...s.sent.filter((x) => x.q !== j.q), j] })),
      sentAs: (q, rid) => set((s) => ({ sent: s.sent.map((x) => (x.q === q ? { ...x, rid } : x)) })),
      forgetSent: (q) => set((s) => ({ sent: s.sent.filter((x) => x.q !== q) })),
    }
  })
}
