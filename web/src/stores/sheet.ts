// What floats over the page, one at a time: a sheet from the bottom on the phone (a dialog on the desktop), the
// card that floats above the box, a menu at a spot on the desktop. Its request says what it is about (a kind, with
// that kind's own fields); its place, how it shows. And the asks that a second click within 3 seconds confirms ("Delete F12?"), never a browser dialog.

import { createStore, type StoreApi } from 'zustand/vanilla'
import type { VoiceStep } from '../model/types'

export type Arm = 's' | 'p' | 't'

/** What a sheet is about: one kind each, with its own fields. Each feature draws its own kinds. */
export type SheetRequest =
  /** a task's actions (`arm`: opened on its status, priority or type menu) */
  | { kind: 'task-menu'; n: number; arm: Arm | null }
  | { kind: 'task-move-parent'; n: number }
  /** what a task waits for (T857): a task picked, or picked again to stop waiting */
  | { kind: 'task-wait-for'; n: number }
  | { kind: 'task-move-project'; n: number }
  /** the inputs a task came from */
  | { kind: 'task-sources'; n: number }
  /** when a task was made and last changed, in full (T704) */
  | { kind: 'task-times'; n: number }
  | { kind: 'message-menu'; n: number; id: number }
  | { kind: 'input-menu'; id: string }
  | { kind: 'input-history'; id: string }
  | { kind: 'input-move'; id: string }
  /** put an input with another task */
  | { kind: 'input-rescope'; id: string }
  /** what an agent reading task n gets (T568) */
  | { kind: 'agent-card'; n: number }
  /** Later, until a day or with none (D115 #21) */
  | { kind: 'later'; n: number }
  /** who works on the project, how to connect one more, what they read */
  | { kind: 'agents' }
  /** how a connected agent gets work without spending tokens (T613) */
  /** a voice note's words as said, and the steps that worked them out (T697) */
  | { kind: 'as-said'; f: string; heard: string; tr: string; steps?: VoiceStep[] }
  | { kind: 'filters' }
  | { kind: 'keys' }
  | { kind: 'switch-project' }
  /** the desktop's search (T479) */
  | { kind: 'search' }
  /** a document onto another task; a comment to another paragraph */
  | { kind: 'doc-move'; d: number }
  /** one of your views of the list */
  | { kind: 'view-menu'; i: number }
  /** Taska wants its key */
  | { kind: 'sign-in' }
  /** a project's menu (the sidebar's; on the phone, Settings › Projects' ⋯); `gone`: a deleted one's, by its name */
  | { kind: 'project-menu'; slug: string; gone?: string }
  /** a new project named, opened once made (D115 #7) */
  | { kind: 'new-project' }
  /** what was not saved */
  | { kind: 'not-saved' }
  | { kind: 'comment-move'; d: number; id: number }
  /** the phone's menu of a document's comment */
  | { kind: 'comment-menu'; d: number; id: number }
  /** the phone's menu of a document (D115 #41) */
  | { kind: 'doc-menu'; d: number }
  /** a document's editor (the phone's, and a new one's): an existing one, or a new one on task n */
  | { kind: 'doc-edit'; d: number }
  | { kind: 'doc-edit'; n: number }
  /** restoring a version of the rules asks once (T693) */
  | { kind: 'rules-restore'; v: number }
  /** the rules' editor: a shared rule (or one of its sections) to put in where the caret is (T779) */
  | { kind: 'shared-insert' }
  /** Settings › Shared rules: new shared rules, by name (T779) */
  | { kind: 'new-shared' }

export type SheetKind = SheetRequest['kind']

/** How it shows. */
export interface SheetPlace {
  /** a menu at a spot on the desktop */
  pop?: boolean
  narrow?: boolean
  /** wider on the desktop */
  wide?: boolean
  tall?: boolean
  /** the desktop's search: in the top third, wide, its height fixed */
  search?: boolean
  /** its first button takes the focus */
  focus?: boolean
  /** where a desktop menu sits: at the pointer, or under the button it came from (its right edge on the button's) */
  at?: { x: number; y: number; right?: boolean; top?: number; left?: number } | null
}

export interface SheetSpec extends SheetPlace {
  req: SheetRequest
}

export interface SheetState {
  spec: SheetSpec | null
  /** what the field menus of the desktop's task menu show now (S, P, T) */
  arm: Arm | null
  /** the asks waiting for their second click, by key: when asked (ms) */
  asked: Readonly<Record<string, number>>
  open(spec: SheetSpec): void
  close(): void
  setArm(arm: Arm | null): void
  ask(key: string, at: number): void
  forget(key: string, at?: number): void
}

export type SheetStore = StoreApi<SheetState>

export function createSheetStore(): SheetStore {
  return createStore<SheetState>()((set, get) => ({
    spec: null,
    arm: null,
    asked: {},
    open: (spec) => set({ spec }),
    close: () => set({ spec: null, arm: null }),
    setArm: (arm) => set({ arm }),
    ask: (key, at) => set((s) => ({ asked: { ...s.asked, [key]: at } })),
    forget: (key, at) => {
      if (at !== undefined && get().asked[key] !== at) return
      const asked = { ...get().asked }
      delete asked[key]
      set({ asked })
    },
  }))
}
