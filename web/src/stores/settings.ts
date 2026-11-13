// What Settings shows that is not a project's data: the guide agents read, voice spellings and preferences, the
// deleted projects; and where you are in its forms (a new project being named, one being renamed, a row's menu open).

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Spelling, VoicePrefs } from '../model/types'

export interface DeletedProject {
  name: string
  title: string
  t: string
  items: number
}

export interface SettingsState {
  guide: { slug: string; text: string } | null
  fixes: Spelling[] | null
  prefs: VoicePrefs | null
  deleted: DeletedProject[] | null
  /** a new project's row is open (its name so far, and why it was not made) */
  pErr: string
  /** the project being renamed */
  renaming: string | null
  /** the phone's row whose actions are open ("name", or "gone:name") */
  pMenu: string | null
  /** notifications were turned on or off in this browser */
  noticeRev: number
  /** the Gemini API key being checked and saved (F765) */
  geminiSaving: boolean
  set(p: Partial<Omit<SettingsState, 'set'>>): void
}

export type SettingsStore = StoreApi<SettingsState>

export function createSettingsStore(): SettingsStore {
  return createStore<SettingsState>()((set) => ({
    guide: null,
    fixes: null,
    prefs: null,
    deleted: null,
    pErr: '',
    renaming: null,
    pMenu: null,
    noticeRev: 0,
    geminiSaving: false,
    set: (p) => set(p),
  }))
}
