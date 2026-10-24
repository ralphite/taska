// What the page tells you: the one toast (what just happened, with Undo or another button), your own actions that
// can be undone (Z, the drawer's Undo), and the changes that could not be saved (the red "N not saved").

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { KeyValueStore } from './storage'

export interface Toast {
  id: number
  text: string
  /** the button, and what it does */
  action: { label: string; run: () => unknown } | null
  error: boolean
  /** stays until you act on it or close it */
  sticky: boolean
}

export interface UndoStep {
  id: number
  label: string
  run: () => Promise<boolean>
}

export interface NotSaved {
  sid: string
  what: string
  why: string
  at: number
  slug: string
  /** where it belongs, to go and see it */
  go?: string
  said?: string
  /** it goes again by itself when the server is back */
  retry?: () => unknown
}

export interface FeedbackState {
  toast: Toast | null
  /** a sticky toast another one covers comes back after it */
  kept: Toast | null
  undo: UndoStep[]
  notSaved: NotSaved[]
  showToast(t: Toast): void
  hideToast(id?: number): void
  pushUndo(step: UndoStep): void
  dropUndo(id: number): void
  addNotSaved(f: NotSaved): void
  dropNotSaved(sid?: string): void
}

export type FeedbackStore = StoreApi<FeedbackState>
const FAILED_KEY = 'taska.failed'

export function createFeedbackStore(kv: KeyValueStore): FeedbackStore {
  const kept = (kv.getJson<Omit<NotSaved, 'retry'>[]>(FAILED_KEY) || []).map((f) => ({ ...f, slug: f.slug || slugOf((f as { p?: string }).p) }))
  const save = (list: NotSaved[]) =>
    kv.setJson(
      FAILED_KEY,
      list.length ? list.slice(0, 50).map(({ sid, what, why, at, slug, go, said }) => ({ sid, what, why, at, p: `/p/${encodeURIComponent(slug)}/`, go, said })) : null,
    )
  return createStore<FeedbackState>()((set, get) => ({
    toast: null,
    kept: null,
    undo: [],
    notSaved: kept,
    showToast: (t) =>
      set((s) => ({
        toast: t,
        kept: t.sticky ? null : s.toast?.sticky ? s.toast : s.kept,
      })),
    hideToast: (id) =>
      set((s) => {
        if (id != null && s.toast?.id !== id) return s
        if (s.kept && id != null) return { toast: s.kept, kept: null }
        return { toast: null, kept: null }
      }),
    pushUndo: (step) => set((s) => ({ undo: [...s.undo, step].slice(-30) })),
    dropUndo: (id) => set((s) => ({ undo: s.undo.filter((u) => u.id !== id) })),
    addNotSaved: (f) => {
      set((s) => ({ notSaved: [f, ...s.notSaved] }))
      save(get().notSaved)
    },
    dropNotSaved: (sid) => {
      set((s) => ({ notSaved: sid == null ? [] : s.notSaved.filter((f) => f.sid !== sid) }))
      save(get().notSaved)
    },
  }))
}

const slugOf = (p: string | undefined) => decodeURIComponent(String(p || '').replace(/^\/p\//, '').replace(/\/$/, ''))
