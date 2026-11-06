// What floats over the page, one at a time: a sheet from the bottom on the phone (a dialog on the desktop), the
// card that floats above the box, a menu at a spot on the desktop. Its request says what it is about (a kind, with
// that kind's own fields); its place, how it shows. And the asks that a second click within 3 seconds confirms ("Delete F12?"), never a browser dialog.

import { createStore, type StoreApi } from 'zustand/vanilla'

export type Arm = 's' | 'p' | 't'

/** What a sheet is about: one kind each, with its own fields. Each feature draws its own kinds. */
export type SheetRequest =
  /** an item's actions (`arm`: opened on its status, priority or type menu) */
  | { kind: 'item-menu'; n: number; arm: Arm | null }
  | { kind: 'item-move-parent'; n: number }
  | { kind: 'item-move-project'; n: number }
  /** the inputs an item came from */
  | { kind: 'item-sources'; n: number }
  | { kind: 'message-menu'; n: number; id: number }
  | { kind: 'input-menu'; id: string }
  | { kind: 'input-history'; id: string }
  | { kind: 'input-move'; id: string }
  /** put an input with another item */
  | { kind: 'input-rescope'; id: string }
  /** what an agent reading item n gets (F568) */
  | { kind: 'agent-card'; n: number }
  /** Later, until a day or with none (D115 #21) */
  | { kind: 'later'; n: number }
  /** who works on the project, how to connect one more, what they read */
  | { kind: 'agents' }
  /** how a connected agent gets work without spending tokens (F613) */
  /** a voice note's words as said */
  | { kind: 'as-said'; heard: string; tr: string }
  | { kind: 'filters' }
  | { kind: 'keys' }
  | { kind: 'switch-project' }
  /** the desktop's search (F479) */
  | { kind: 'search' }
  /** a document onto another item; a comment to another paragraph */
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
  /** a document's editor (the phone's, and a new one's): an existing one, or a new one on item n */
  | { kind: 'doc-edit'; d: number }
  | { kind: 'doc-edit'; n: number }

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
  /** what the field menus of the desktop's item menu show now (S, P, T) */
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
